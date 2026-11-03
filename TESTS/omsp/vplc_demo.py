"""Three live counter PLC demos: Python, zOMSp executable, native SDK client.
The Python host compiles a tiny COUNTER language; zOMSp owns OMSp/TLS and mmap.
On Windows --native-wsl runs the Linux native reference through a stdio relay.
"""
import argparse
import ctypes as C
import io
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
from activation import Handler, DIRECTIVES, REJECT
from mapped import Store

SOURCE='COUNTER register=43 step=1 period_ms=20'


def compile_program(source):
    match=re.fullmatch(r'COUNTER register=43 step=([1-9][0-9]{0,3}) period_ms=([1-9][0-9]{0,3})',source)
    if not match:raise ValueError('invalid counter program')
    step,period=map(int,match.groups())
    if step>1000 or not 20<=period<=1000:raise ValueError('counter bounds')
    return step,period/1000


def linux_path(path):
    path=Path(path).resolve().as_posix()
    if len(path)>2 and path[1]==':':return '/mnt/'+path[0].lower()+path[2:]
    return path


def run_native(args,port):
    if args.native_wsl:
        command=['wsl','-d',args.native_wsl,'--','python3',linux_path(Path(__file__).with_name('native_bridge.py')),'--native',linux_path(args.native),'--reference',linux_path(args.native_reference),'--credentials',linux_path(args.credentials),'--program',SOURCE]
        process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        channel=socket.create_connection(('127.0.0.1',port),3)
        def up():
            try:
                while True:
                    data=process.stdout.read1(65536)
                    if not data:break
                    channel.sendall(data)
            except (OSError,ValueError):pass
        def down():
            try:
                while True:
                    data=channel.recv(65536)
                    if not data:break
                    process.stdin.write(data);process.stdin.flush()
            except (OSError,ValueError):pass
        workers=[threading.Thread(target=up,daemon=True),threading.Thread(target=down,daemon=True)]
        for worker in workers:worker.start()
        try:
            process.wait(timeout=25)
            error=process.stderr.read().decode(errors='replace')
            records=[line[len('NATIVE_RESULT='):] for line in error.splitlines() if line.startswith('NATIVE_RESULT=')]
            assert process.returncode==0 and records,error
            result=json.loads(records[-1]);assert result['exit']==0,result
            return result['stdout']
        finally:
            if process.poll() is None:process.kill();process.wait()
            channel.shutdown(socket.SHUT_RDWR);channel.close()
            for worker in workers:worker.join(2)
    native=Path(args.native).resolve()
    env=dict(os.environ,LD_PRELOAD=str(native.with_name('native_socket_trace.so')),OMSP_TEST_PORT=str(port),OMSP_SEQUENCE='1',OMSP_COLLECTIVE='1',OMSP_ACTIVATION='1',OMSP_TRANSACTION_WRITE='1000',OMSP_PROGRAM=SOURCE)
    process=subprocess.run([str(native),str(Path(args.native_reference).resolve()),'::127.0.0.1:SIMATIC-ROOT-ES:6.0'],cwd=Path(args.credentials).resolve().parent.parent,env=env,capture_output=True,text=True,timeout=20)
    assert process.returncode==0,process.stdout+process.stderr
    return process.stdout


def check(args):
    sys.path.insert(0,str(Path(args.python_path).resolve()))
    from s7commplus.omsp.session import Session
    from s7commplus.core.pvalue import PValue,ValueWString,ValueUDInt,ValueVariantSparseArray
    def encode(value):
        out=io.BytesIO();value.serialize(out);return out.getvalue()
    reports=[]
    for mode in ('python','zomsp','native'):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory);store=Store(args.library,folder/'plc.shm')
            stop=threading.Event();activated=threading.Event();compiled={};errors=[];worker=None
            try:
                store.object(201,0,213);store.object(1000,201,9001)
                assert store.set(1000,42,encode(ValueWString('STOP')))==0
                assert store.set(1000,43,encode(ValueUDInt(0)),writable=False)==0
                lib=store.lib
                lib.zomsp_transactions.argtypes=[C.c_void_p,C.c_uint8]
                lib.zomsp_activation.argtypes=[C.c_void_p,Handler,C.c_void_p];lib.zomsp_activation.restype=C.c_int32
                @Handler
                def validate(user,call,directives,length,image,size):
                    try:
                        if C.string_at(directives,length)!=DIRECTIVES or size!=lib.zomsp_size():return REJECT
                        path=folder/'candidate.shm';path.write_bytes(C.string_at(image,size))
                        candidate=Store(args.library,path,create=False)
                        try:raw=candidate.get(1000,42)
                        finally:candidate.close()
                        value=PValue.deserialize(io.BytesIO(raw))
                        if not isinstance(value,ValueWString):return REJECT
                        compiled[raw]=compile_program(value.value)
                        return 0
                    except Exception:return REJECT
                assert lib.zomsp_transactions(store.handle,1)==0
                assert lib.zomsp_activation(store.handle,validate,None)==0
                def runtime():
                    previous=None;count=0;deadline=0
                    try:
                        while not stop.wait(.002):
                            raw=store.get(1000,42)
                            program=compiled.get(raw)
                            if program is None:continue
                            if raw!=previous:
                                previous=raw;deadline=time.monotonic()+program[1];activated.set()
                            if time.monotonic()>=deadline:
                                count=(count+program[0])&0xffffffff
                                assert store.set(1000,43,encode(ValueUDInt(count)),writable=False)==0
                                deadline=time.monotonic()+program[1]
                    except Exception as error:errors.append(repr(error))
                worker=threading.Thread(target=runtime,daemon=True);worker.start()
                certs=Path(args.credentials).resolve()
                port=store.start(certs/'server-cert.pem',certs/'server-key.pem',Path(args.reference).resolve())
                samples=[]
                if mode=='python':
                    with Session('127.0.0.1',port,certs/'server-cert.pem') as client:
                        client.start_transaction(ValueVariantSparseArray({1:ValueUDInt(0)}))
                        client.write(1000,42,ValueWString(SOURCE))
                        assert store.get(1000,42)==encode(ValueWString('STOP')) and not activated.is_set()
                        client.end_sequence()
                        for _ in range(5):
                            time.sleep(.06);samples.append(client.read(43,1000).value)
                elif mode=='zomsp':
                    env=dict(os.environ,ZOMSP_ACTIVATION='1',ZOMSP_APPLICATION_RID='1000',ZOMSP_PROGRAM=SOURCE)
                    process=subprocess.run([str(Path(args.binary).resolve()),'--client','127.0.0.1',str(port),str(certs/'server-cert.pem'),str(Path(args.reference).resolve())],env=env,capture_output=True,text=True,timeout=15)
                    assert process.returncode==0,process.stdout+process.stderr
                    samples=list(map(int,re.findall(r'program counter=(\d+)',process.stderr)))
                else:
                    output=run_native(args,port)
                    assert 'sequence.end.status=0x0000000000000000' in output,output
                    samples=list(map(int,re.findall(r'program.counter=(\d+) status=0x0000000000000000',output)))
                assert len(samples)==5 and all(a<b for a,b in zip(samples,samples[1:])),samples
                assert activated.is_set() and not errors,errors
                assert store.get(1000,42)==encode(ValueWString(SOURCE))
                reports.append({'client':mode,'client_platform':'linux-wsl' if mode=='native' and args.native_wsl else sys.platform,'server':sys.platform,'samples':samples,'passed':True})
                print(json.dumps(reports[-1]),flush=True)
            finally:
                stop.set()
                if worker:worker.join(2);assert not worker.is_alive()
                store.close()
    return reports

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    root=Path(__file__).resolve().parents[2]
    work=root/'TESTS/omsp/native/omsp_capture_analysis'
    defaults={
        'library':root/('zig-out/bin/zomsp.dll' if os.name=='nt' else 'zig-out/lib/libzomsp.so'),
        'reference':root/'zig-out/bin/libssl-1_1-x64.dll' if os.name=='nt' else work/'libwrapper_native-nx.so',
        'credentials':work/'native_test_credentials',
        'python-path':root.parent/'tia-tools/sps7',
        'binary':root/('zig-out/bin/zOMSp.exe' if os.name=='nt' else 'zig-out/bin/zOMSp'),
        'native':work/'native_probe','native-reference':work/'libwrapper_native-nx.so',
    }
    for name,value in defaults.items():p.add_argument('--'+name,default=str(value))
    p.add_argument('--native-wsl',help='Windows only: WSL distro containing the Linux native SDK')
    p.add_argument('--output',type=Path)
    args=p.parse_args()
    if os.name=='nt' and not args.native_wsl:p.error('Windows native-reference test needs --native-wsl DISTRO; zOMSp server/client use Windows binaries')
    result=check(args)
    if args.output:args.output.write_text(json.dumps(result,indent=2))
