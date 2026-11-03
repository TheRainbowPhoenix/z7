"""Opt-in activation policy: validation, atomic publish, rejection, abort and native SDK."""
import argparse
import ctypes as C
from contextlib import closing
import json
import os
from pathlib import Path
import subprocess
import tempfile
from mapped import Store
from wire import frame,vlq,QUALIFIER
from transactions import sequence
from invoke import Invocation

Handler=C.CFUNCTYPE(C.c_uint64,C.c_void_p,C.POINTER(Invocation),C.c_void_p,C.c_size_t,C.c_void_p,C.c_size_t)
DIRECTIVES=bytes.fromhex('40160100040000')
REJECT=0x8020ab00199afff4


def check(library,native=None,reference=None,credentials=None,python_path=None,binary=None,python_server=False):
    with tempfile.TemporaryDirectory() as directory, closing(Store(library,Path(directory)/'objects.shm')) as store:
        store.object(201,0,213);store.object(1000,201,9001)
        assert store.set(1000,42,b'\0\x04\x01')==0
        lib=store.lib
        lib.zomsp_transactions.argtypes=[C.c_void_p,C.c_uint8]
        lib.zomsp_activation.argtypes=[C.c_void_p,Handler,C.c_void_p]
        lib.zomsp_activation.restype=C.c_int32
        lib.zomsp_session_open.argtypes,lib.zomsp_session_open.restype=[C.c_void_p],C.c_void_p
        lib.zomsp_session_close.argtypes=[C.c_void_p]
        lib.zomsp_dispatch.argtypes=[C.c_void_p,C.c_void_p,C.c_size_t,C.c_void_p,C.c_size_t]
        lib.zomsp_dispatch.restype=C.c_ssize_t
        calls=[];mode=['accept']
        @Handler
        def validate(user,info,directives,length,image,size):
            try:
                call=info.contents
                assert call.method==0x560 and call.session and call.target
                assert C.string_at(directives,length)==DIRECTIVES
                assert size==store.lib.zomsp_size() and C.string_at(image,8)==b'zOMSp001'
                calls.append(mode[0])
                if mode[0]=='reject':return REJECT
                if mode[0]=='conflict':assert store.set(1000,42,b'\0\x04\x09')==0
                return 0
            except BaseException:
                return REJECT
        assert lib.zomsp_transactions(store.handle,1)==0
        fixtures=json.loads(Path(__file__).with_name('native_requests.json').read_text())['requests']
        output=C.create_string_buffer(65535)
        def dispatch(session,raw):
            buf=C.create_string_buffer(raw)
            count=lib.zomsp_dispatch(session,buf,len(raw),output,len(output))
            return output.raw[14:count] if count>0 else count
        def connect():
            session=lib.zomsp_session_open(store.handle);assert session
            assert isinstance(dispatch(session,bytes.fromhex(fixtures['peer0_2'])),bytes)
            assert isinstance(dispatch(session,bytes.fromhex(fixtures['peer0_3']).replace(bytes.fromhex('7000103d'),bytes.fromhex('70001001'))),bytes)
            return session
        def begin(counter):
            descriptor=b'\xa1\x7f\xff\xc0\x01'+vlq(1700)+b'\0\0\xa3'+vlq(1702)+DIRECTIVES+b'\xa2'
            return sequence(0x556,b'\x02\0\x01\0'+vlq(counter)+descriptor+b'\0'*4)
        def end(counter,abort=False):return sequence(0x560,bytes([int(abort),1])+vlq(counter)+b'\0'*4)
        def write(counter):return frame(0x4f2,1000,b'\x01\x2a\0\x04\x0b'+QUALIFIER+b'\0'+vlq(counter)+b'\0'*4)
        session=connect()
        try:assert dispatch(session,begin(4))==-1
        finally:lib.zomsp_session_close(session)
        assert lib.zomsp_activation(store.handle,validate,None)==0
        session=connect()
        try:
            assert lib.zomsp_activation(store.handle,validate,None)==-6
            broken=begin(4)[:-1]+b'\x01'
            assert dispatch(session,broken)==-1 and not calls
            assert dispatch(session,begin(4))[0]==0
            assert dispatch(session,write(5))[0]==0 and store.get(1000,42)==b'\0\x04\x01'
            assert dispatch(session,end(6))[0]==0 and calls==['accept']
            assert store.get(1000,42)==b'\0\x04\x0b'
            assert store.set(1000,42,b'\0\x04\x01')==0
            assert dispatch(session,begin(7))[0]==0
            assert dispatch(session,write(8))[0]==0
            assert dispatch(session,end(9,True))[0]==0 and len(calls)==1
            assert store.get(1000,42)==b'\0\x04\x01'
            mode[0]='reject'
            assert dispatch(session,begin(10))[0]==0
            assert dispatch(session,write(11))[0]==0
            assert dispatch(session,end(12)).startswith(bytes.fromhex('c08895b080e6b5fff4'))
            assert store.get(1000,42)==b'\0\x04\x01'
            mode[0]='conflict'
            assert dispatch(session,begin(13))[0]==0
            assert dispatch(session,write(14))[0]==0
            assert dispatch(session,end(15))==-6
            assert store.get(1000,42)==b'\0\x04\x09'
            assert dispatch(session,end(15,True))[0]==0
        finally:lib.zomsp_session_close(session)
        mode[0]='accept'
        if native or python_path or binary:
            certs=Path(credentials).resolve()
            lib.zomsp_start.argtypes=[C.c_void_p,C.c_uint16,C.c_char_p,C.c_char_p,C.c_char_p]
            lib.zomsp_port.argtypes,lib.zomsp_port.restype=[C.c_void_p],C.c_uint16
            lib.zomsp_stop.argtypes=[C.c_void_p]
            hosted=None
            if python_server:
                import sys
                sys.path.insert(0,str(Path(python_path).resolve()))
                from s7commplus.omsp.mapped_server import MappedServer
                def extension(request, forward):
                    assert request[0] == 0x72 and len(request) <= 65535
                    return forward(request)
                hosted=MappedServer(lib,store.handle,certs/'server-cert.pem',certs/'server-key.pem',request_handler=extension)
                port=hosted.start()
            else:
                assert lib.zomsp_start(store.handle,0,os.fsencode(certs/'server-cert.pem'),os.fsencode(certs/'server-key.pem'),os.fsencode(Path(reference).resolve()))==0
                port=lib.zomsp_port(store.handle)
            try:
                if binary:
                    env=dict(os.environ,ZOMSP_ACTIVATION='1',ZOMSP_APPLICATION_RID='1000')
                    process=subprocess.run([str(Path(binary).resolve()),'--client','127.0.0.1',str(port),str(certs/'server-cert.pem'),str(Path(reference).resolve())],env=env,capture_output=True,text=True,timeout=12)
                    assert process.returncode==0,process.stdout+process.stderr
                    assert 'mapped activation=ok' in process.stderr,process.stderr
                    assert store.get(1000,42)==b'\0\x04\x0b'
                    print('zOMSp client -> mapped activation policy: passed')
                if native:
                    env=dict(os.environ,LD_PRELOAD=str(Path(native).resolve().with_name('native_socket_trace.so')),OMSP_TEST_PORT=str(port),OMSP_SEQUENCE='1',OMSP_COLLECTIVE='1',OMSP_ACTIVATION='1',OMSP_TRANSACTION_WRITE='1000')
                    process=subprocess.run([str(Path(native).resolve()),str(Path(reference).resolve()),'::127.0.0.1:SIMATIC-ROOT-ES:6.0'],cwd=certs.parent.parent,env=env,capture_output=True,text=True,timeout=12)
                    assert process.returncode==0,process.stdout+process.stderr
                    assert 'sequence.end.status=0x0000000000000000' in process.stdout,process.stdout
                    print('Native SDK -> mapped activation policy: passed')
                if python_path:
                    import sys
                    sys.path.insert(0,str(Path(python_path).resolve()))
                    from s7commplus.omsp.session import Session
                    from s7commplus.core.pvalue import ValueVariantSparseArray,ValueUDInt
                    with Session('127.0.0.1',port,certs/'server-cert.pem') as client:
                        assert client.start_transaction(ValueVariantSparseArray({1:ValueUDInt(0)}))
                        client.write(1000,42,ValueUDInt(7))
                        client.end_sequence()
                    assert store.get(1000,42)==b'\0\x04\x07'
                    print('Python client -> mapped activation policy: passed')
            finally:
                if hosted:
                    hosted.stop()
                    assert not hosted.errors,hosted.errors
                else:lib.zomsp_stop(store.handle)
    print('Activation bounds, malformed rollback, rejection, abort and generation conflict: passed')


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('library');p.add_argument('--native');p.add_argument('--reference');p.add_argument('--credentials');p.add_argument('--python-path');p.add_argument('--binary');p.add_argument('--python-server',action='store_true')
    a=p.parse_args();check(a.library,a.native,a.reference,a.credentials,a.python_path,a.binary,a.python_server)
