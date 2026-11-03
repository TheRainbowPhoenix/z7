"""8 MiB SIN LUT upload, file compilation and execution behind the zOMSp server.
Default test uses only stdlib and platform zOMSp binaries; --clients adds oracles.
"""
import argparse
import array
import ctypes as C
import hashlib
import io
import json
import math
import mmap
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import threading
import time
from invoke import Invocation
from mapped import Store
from wire import vlq

SIZE=8*1024*1024
ENTRIES=(SIZE-64)//4
Validator=C.CFUNCTYPE(C.c_uint64,C.c_void_p,C.POINTER(Invocation),C.c_char_p,C.c_uint64)


def make_program(path):
    header=struct.pack('<8sII48s',b'ZOMSPSIN',1,ENTRIES,b'\0'*48)
    digest=hashlib.sha256()
    with open(path,'wb') as file:
        file.write(header);digest.update(header)
        for first in range(0,ENTRIES,16384):
            values=array.array('f',(math.sin(2*math.pi*i/ENTRIES) for i in range(first,min(first+16384,ENTRIES))))
            if sys.byteorder!='little':values.byteswap()
            data=values.tobytes();file.write(data);digest.update(data)
    assert Path(path).stat().st_size==SIZE
    return digest.hexdigest()


def check(args):
    reports=[]
    with tempfile.TemporaryDirectory() as directory:
        root=Path(directory);source=root/'sin.program';expected=make_program(source)
        for mode in args.clients.split(','):
            folder=root/mode;folder.mkdir();store=Store(args.library,folder/'plc.shm')
            stop=threading.Event();active=threading.Event();errors=[];worker=None;validations=[]
            try:
                store.object(201,0,213);store.object(1000,201,9001)
                assert store.set(1000,42,b'\0\x14\0\0')==0
                assert store.set(1000,44,b'\0\x04\0')==0
                assert store.set(1000,45,b'\0\x0e'+struct.pack('>f',float('nan')),writable=False)==0
                lib=store.lib
                lib.zomsp_transactions.argtypes=[C.c_void_p,C.c_uint8]
                lib.zomsp_blob.argtypes=[C.c_void_p,C.c_uint32,C.c_uint32,C.c_uint32,C.c_char_p,Validator,C.c_void_p]
                lib.zomsp_blob.restype=C.c_int32
                lib.zomsp_blob_path.argtypes=[C.c_void_p,C.c_void_p,C.c_size_t];lib.zomsp_blob_path.restype=C.c_ssize_t
                @Validator
                def compile_file(user,call,path,length):
                    try:
                        assert length==SIZE
                        # A normal file stream; no chunk handling is visible to the compiler.
                        digest=hashlib.sha256()
                        with open(os.fsdecode(path),'rb') as file:
                            header=file.read(64);digest.update(header)
                            magic,version,count,_=struct.unpack('<8sII48s',header)
                            assert magic==b'ZOMSPSIN' and version==1 and count==ENTRIES
                            while True:
                                block=file.read(65536)
                                if not block:break
                                digest.update(block)
                        assert digest.hexdigest()==expected
                        validations.append(expected)
                        return 0
                    except Exception as error:
                        errors.append(repr(error));return 0x8020ab00199afff4
                assert lib.zomsp_transactions(store.handle,1)==0
                assert lib.zomsp_blob(store.handle,1000,42,SIZE,os.fsencode(folder),compile_file,None)==0
                def runtime():
                    try:
                        path=C.create_string_buffer(4096)
                        while not stop.wait(.002):
                            if lib.zomsp_blob_path(store.handle,path,len(path))>0:break
                        else:return
                        with open(os.fsdecode(path.value),'rb') as file,mmap.mmap(file.fileno(),0,access=mmap.ACCESS_READ) as program:
                            active.set()
                            while not stop.wait(.002):
                                raw=store.get(1000,44)
                                assert raw[:2]==b'\0\x04';index=0
                                for byte in raw[2:]:index=(index<<7)|(byte&127)
                                value=struct.unpack_from('<f',program,64+(index%ENTRIES)*4)[0]
                                assert store.set(1000,45,b'\0\x0e'+struct.pack('>f',value),writable=False)==0
                    except Exception as error:errors.append(repr(error))
                worker=threading.Thread(target=runtime,daemon=True);worker.start()
                certs=Path(args.credentials).resolve()
                port=store.start(certs/'server-cert.pem',certs/'server-key.pem',Path(args.reference).resolve())
                started=time.monotonic()
                if mode=='zomsp':
                    env=dict(os.environ,ZOMSP_PROGRAM_FILE=str(source))
                    process=subprocess.run([str(Path(args.binary).resolve()),'--client','127.0.0.1',str(port),str(certs/'server-cert.pem'),str(Path(args.reference).resolve())],env=env,capture_output=True,text=True,timeout=120)
                    assert process.returncode==0,process.stdout+process.stderr
                    assert f'streamed program bytes={SIZE}' in process.stderr,process.stderr
                    assert process.stderr.count('zOMSp sine input=')==5,process.stderr
                elif mode=='native':
                    from vplc_demo import run_native
                    args.stream_file=source
                    output=run_native(args,port)
                    assert f'program.stream.status=0x0000000000000000 bytes={SIZE}' in output,output
                    assert output.count('program.sin input=')==5 and 'sequence.end.status=0x0000000000000000' in output,output
                elif mode=='python':
                    sys.path.insert(0,str(Path(args.python_path).resolve()))
                    from s7commplus.omsp.session import Session
                    from s7commplus.core.pvalue import ValueUDInt
                    with Session('127.0.0.1',port,certs/'server-cert.pem',timeout=10) as client:
                        client.start_transaction()
                        with source.open('rb') as program:assert client.write_blob(1000,42,program,SIZE)==SIZE
                        assert not active.is_set()
                        client.end_sequence()
                        for index in (0,ENTRIES//4,ENTRIES//2,ENTRIES*3//4,ENTRIES-1):
                            client.write(1000,44,ValueUDInt(index))
                            deadline=time.monotonic()+2
                            while True:
                                actual=client.read(45,1000).value
                                if math.isfinite(actual) and abs(actual-math.sin(2*math.pi*index/ENTRIES))<.00002:break
                                assert time.monotonic()<deadline,(index,actual)
                                time.sleep(.01)
                else:raise ValueError('unknown client '+mode)
                assert active.is_set() and validations==[expected] and not errors,errors
                path=C.create_string_buffer(4096);assert lib.zomsp_blob_path(store.handle,path,len(path))>0
                with open(os.fsdecode(path.value),'rb') as uploaded:
                    digest=hashlib.sha256()
                    while True:
                        block=uploaded.read(65536)
                        if not block:break
                        digest.update(block)
                assert digest.hexdigest()==expected
                report={'client':mode,'server':sys.platform,'bytes':SIZE,'sha256':expected,'seconds':round(time.monotonic()-started,3),'sine_checks':5,'passed':True}
                reports.append(report);print(json.dumps(report),flush=True)
            finally:
                stop.set()
                if worker:worker.join(3);assert not worker.is_alive()
                store.close()
                assert not list(folder.glob('.zomsp-*.blob')),'upload temporary file leaked'
    return reports

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);root=Path(__file__).resolve().parents[2];work=root/'TESTS/omsp/native/omsp_capture_analysis'
    defaults={'library':root/('zig-out/bin/zomsp.dll' if os.name=='nt' else 'zig-out/lib/libzomsp.so'),'reference':root/'zig-out/bin/libssl-1_1-x64.dll' if os.name=='nt' else work/'libwrapper_native-nx.so','credentials':work/'native_test_credentials','binary':root/('zig-out/bin/zOMSp.exe' if os.name=='nt' else 'zig-out/bin/zOMSp'),'python-path':root.parent/'tia-tools/sps7','native':work/'native_probe','native-reference':work/'libwrapper_native-nx.so'}
    if os.name!='nt':
        packaged=sorted((root/'zig-out/bin').glob('libssl.so*'))
        if packaged:defaults['reference']=packaged[0]
    for name,value in defaults.items():p.add_argument('--'+name,default=str(value))
    p.add_argument('--clients',default='zomsp');p.add_argument('--native-wsl');p.add_argument('--output',type=Path)
    args=p.parse_args();reports=check(args)
    if args.output:args.output.write_text(json.dumps(reports,indent=2))
