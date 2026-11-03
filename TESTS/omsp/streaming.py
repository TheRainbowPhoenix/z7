"""Streamed-file bounds, integrity rollback, abort, conflicts and host-update isolation."""
import ctypes as C
import json
from pathlib import Path
import sys
import tempfile
from invoke import Invocation
from mapped import Store
from transactions import sequence
from wire import frame,vlq,QUALIFIER

Validator=C.CFUNCTYPE(C.c_uint64,C.c_void_p,C.POINTER(Invocation),C.c_char_p,C.c_uint64)


def check(library):
    with tempfile.TemporaryDirectory() as directory:
        folder=Path(directory);store=Store(library,folder/'model.shm')
        lib=store.lib;calls=[];reject=[False]
        @Validator
        def validate(user,call,path,length):
            try:
                data=Path(path.decode()).read_bytes();assert len(data)==length==4096
                calls.append(data)
                return 0x8020ab00199afff4 if reject[0] else 0
            except Exception:return 0x8020ab00199afff4
        try:
            store.object(201,0,213);store.object(1000,201,9001);assert store.set(1000,99,b'\0\x04\0')==0
            lib.zomsp_blob.argtypes=[C.c_void_p,C.c_uint32,C.c_uint32,C.c_uint32,C.c_char_p,Validator,C.c_void_p]
            lib.zomsp_blob.restype=C.c_int32
            lib.zomsp_blob_path.argtypes=[C.c_void_p,C.c_void_p,C.c_size_t];lib.zomsp_blob_path.restype=C.c_ssize_t
            lib.zomsp_transactions.argtypes=[C.c_void_p,C.c_uint8]
            lib.zomsp_session_open.argtypes=[C.c_void_p];lib.zomsp_session_open.restype=C.c_void_p
            lib.zomsp_session_close.argtypes=[C.c_void_p]
            lib.zomsp_dispatch.argtypes=[C.c_void_p,C.c_void_p,C.c_size_t,C.c_void_p,C.c_size_t];lib.zomsp_dispatch.restype=C.c_ssize_t
            store.object(1001,201,9001)
            lib.zomsp_template.argtypes=[C.c_void_p,C.c_uint32]
            assert lib.zomsp_template(store.handle,1001)==0
            assert lib.zomsp_blob(store.handle,1001,42,4096,str(folder).encode(),validate,None)==-4
            assert lib.zomsp_blob(store.handle,1000,42,17*1024*1024,str(folder).encode(),validate,None)<0
            assert lib.zomsp_blob(store.handle,1000,42,4096,str(folder).encode(),validate,None)==0
            assert lib.zomsp_transactions(store.handle,1)==0
            fixtures=json.loads(Path(__file__).with_name('native_requests.json').read_text())['requests'];output=C.create_string_buffer(65535)
            def dispatch(session,raw):
                data=C.create_string_buffer(raw);length=lib.zomsp_dispatch(session,data,len(raw),output,len(output))
                return output.raw[14:length] if length>0 else length
            def connect():
                session=lib.zomsp_session_open(store.handle);assert session
                assert isinstance(dispatch(session,bytes.fromhex(fixtures['peer0_2'])),bytes)
                assert isinstance(dispatch(session,bytes.fromhex(fixtures['peer0_3']).replace(bytes.fromhex('7000103d'),bytes.fromhex('70001001'))),bytes)
                return session
            def begin(counter=4):return sequence(0x556,b'\x02\0\x01\0'+vlq(counter)+b'\xa1\x7f\xff\xc0\x01'+vlq(1700)+b'\0\0\xa2'+b'\0'*4)
            def end(counter,abort=False):return sequence(0x560,bytes([int(abort),1])+vlq(counter)+b'\0'*4)
            def chunk(counter,offset,data):return frame(0x57c,1000,b'\x20\x04\x03\x2a'+vlq(offset)+vlq(len(data))+QUALIFIER+b'\0\x01\0\x14\0'+vlq(len(data))+data+vlq(counter)+b'\0'*4)
            def current():
                path=C.create_string_buffer(4096);length=lib.zomsp_blob_path(store.handle,path,len(path));return Path(path.value.decode()) if length>0 else None
            first=connect()
            try:
                assert lib.zomsp_blob(store.handle,1000,42,4096,str(folder).encode(),validate,None)==-6
                assert dispatch(first,begin())[0]==0
                assert dispatch(first,chunk(5,1,b'a'*1024))<0
                assert not list(folder.glob('.zomsp-*'))
                raw=chunk(5,0,b'a'*1024)
                assert dispatch(first,raw[:-1]+b'\1')<0
                assert not list(folder.glob('.zomsp-*'))
                assert dispatch(first,chunk(5,0,b'z'*4097))<0
                assert all(path.stat().st_size==0 for path in folder.glob('.zomsp-*'))
                assert dispatch(first,raw)[0]==0
                assert dispatch(first,chunk(6,0,b'a'*1024))<0
                assert dispatch(first,end(6))<0 and not calls
                assert dispatch(first,end(6,True))[0]==0
                assert not list(folder.glob('.zomsp-*')) and current() is None
            finally:lib.zomsp_session_close(first)
            reject[0]=True;first=connect()
            try:
                assert dispatch(first,begin())[0]==0
                assert dispatch(first,chunk(5,0,b'b'*4096))[0]==0
                assert dispatch(first,end(6))[0]!=0
                assert len(calls)==1 and current() is None and not list(folder.glob('.zomsp-*'))
            finally:lib.zomsp_session_close(first)
            reject[0]=False;first=connect()
            try:
                assert dispatch(first,begin())[0]==0
                for index in range(4):
                    assert dispatch(first,chunk(5+index,index*1024,bytes([index])*1024))[0]==0
                    assert store.set(1000,99,b'\0\x04'+vlq(index+1))==0
                assert dispatch(first,end(9))[0]==0
                assert store.get(1000,99)==b'\0\x04\4'
                committed=current();assert committed.read_bytes()==b''.join(bytes([i])*1024 for i in range(4))
                assert lib.zomsp_blob_path(store.handle,C.create_string_buffer(1),1)==-5
            finally:lib.zomsp_session_close(first)
            first=connect();assert dispatch(first,begin())[0]==0;assert dispatch(first,chunk(5,0,b'c'*1024))[0]==0
            lib.zomsp_session_close(first)
            assert current()==committed and list(folder.glob('.zomsp-*'))==[committed]
            held=committed.open('rb')
            first=connect();second=connect()
            try:
                for session in (first,second):
                    assert dispatch(session,begin())[0]==0
                    assert dispatch(session,chunk(5,0,b'd'*4096))[0]==0
                assert dispatch(first,end(6))[0]==0
                assert dispatch(second,end(6))==-6
                assert dispatch(second,end(6,True))[0]==0
                assert current().read_bytes()==b'd'*4096
                assert held.read()==b''.join(bytes([i])*1024 for i in range(4))
            finally:lib.zomsp_session_close(first);lib.zomsp_session_close(second);held.close()
            first=connect()
            try:
                assert dispatch(first,begin())[0]==0
                assert dispatch(first,chunk(5,0,b'e'*4096))[0]==0
                assert dispatch(first,end(6))[0]==0
                assert current().read_bytes()==b'e'*4096 and len(list(folder.glob('.zomsp-*')))==1
            finally:lib.zomsp_session_close(first)
        finally:store.close()
        assert not list(folder.glob('.zomsp-*'))
    print('File streaming: bounds, malformed rollback, order, incomplete commit, reject, abort/disconnect cleanup, live host writes and concurrent-upload conflict passed')

if __name__=='__main__':check(sys.argv[1])
