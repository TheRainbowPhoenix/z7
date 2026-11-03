"""CI: zOMSp client uploads a program; Python compiles/runs it behind zOMSp TLS."""
import ctypes as C
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import threading
import time
from activation import Handler, DIRECTIVES, REJECT
from mapped import Store
from wire import vlq

SOURCE=b'COUNTER register=43 step=1 period_ms=20'
PROGRAM=b'\0\x15'+vlq(len(SOURCE))+SOURCE


def check(library,reference,credentials,binary):
    with tempfile.TemporaryDirectory() as directory:
        folder=Path(directory);store=Store(library,folder/'plc.shm')
        stop=threading.Event();activated=threading.Event();compiled=threading.Event()
        errors=[];worker=None
        try:
            store.object(201,0,213);store.object(1000,201,9001)
            assert store.set(1000,42,b'\0\x15\x04STOP')==0
            assert store.set(1000,43,b'\0\x04\0',writable=False)==0
            lib=store.lib
            lib.zomsp_transactions.argtypes=[C.c_void_p,C.c_uint8]
            lib.zomsp_activation.argtypes=[C.c_void_p,Handler,C.c_void_p]
            lib.zomsp_activation.restype=C.c_int32
            @Handler
            def validate(user,call,directives,length,image,size):
                try:
                    if size!=lib.zomsp_size() or C.string_at(directives,length)!=DIRECTIVES:return REJECT
                    path=folder/'candidate.shm';path.write_bytes(C.string_at(image,size))
                    candidate=Store(library,path,create=False)
                    try:source=candidate.get(1000,42)
                    finally:candidate.close()
                    if source!=PROGRAM:return REJECT
                    compiled.set()
                    return 0
                except Exception as error:
                    errors.append(repr(error));return REJECT
            assert lib.zomsp_transactions(store.handle,1)==0
            assert lib.zomsp_activation(store.handle,validate,None)==0
            def runtime():
                count=0;deadline=None
                try:
                    while not stop.wait(.002):
                        if not compiled.is_set() or store.get(1000,42)!=PROGRAM:continue
                        if deadline is None:
                            deadline=time.monotonic()+.02;activated.set()
                        if time.monotonic()>=deadline:
                            count+=1
                            assert store.set(1000,43,b'\0\x04'+vlq(count),writable=False)==0
                            deadline=time.monotonic()+.02
                except Exception as error:errors.append(repr(error))
            worker=threading.Thread(target=runtime,daemon=True);worker.start()
            certs=Path(credentials).resolve()
            port=store.start(certs/'server-cert.pem',certs/'server-key.pem',Path(reference).resolve())
            env=dict(os.environ,ZOMSP_ACTIVATION='1',ZOMSP_APPLICATION_RID='1000',ZOMSP_PROGRAM=SOURCE.decode())
            process=subprocess.run([str(Path(binary).resolve()),'--client','127.0.0.1',str(port),str(certs/'server-cert.pem'),str(Path(reference).resolve())],env=env,capture_output=True,text=True,timeout=20)
            assert process.returncode==0,process.stdout+process.stderr
            samples=list(map(int,re.findall(r'program counter=(\d+)',process.stderr)))
            assert len(samples)==5 and all(a<b for a,b in zip(samples,samples[1:])),samples
            assert compiled.is_set() and activated.is_set() and not errors,errors
            assert store.get(1000,42)==PROGRAM
            print('Program upload/compile/commit/run via zOMSp client/server: '+json.dumps(samples))
        finally:
            stop.set()
            if worker:worker.join(2);assert not worker.is_alive()
            store.close()
