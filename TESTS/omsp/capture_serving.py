"""Check a capture-derived mapping through fresh sessions, not captured reply bytes."""
import argparse
import ctypes as C
import io
import json
import os
from pathlib import Path
import subprocess
import sys
from mapped import Store


def check(library,mapping,model,reference,credentials,python_path=None,native=None):
    data=json.loads(Path(model).read_text())
    if not data['values']:raise ValueError('model has no served values')
    store=Store(library,mapping,create=False)
    certs=Path(credentials).resolve()
    try:
        port=store.start(certs/'server-cert.pem',certs/'server-key.pem',Path(reference).resolve())
        if python_path:
            sys.path.insert(0,str(Path(python_path).resolve()))
            from s7commplus.omsp.session import Session
            with Session('127.0.0.1',port,certs/'server-cert.pem') as client:
                for item in data['values']:
                    result=client.read(item['aid'],item['rid'])
                    raw=io.BytesIO();result.serialize(raw)
                    assert raw.getvalue()==bytes.fromhex(item['value']),(item['rid'],item['aid'],item['value'],raw.getvalue().hex())
            print(f'Python TLS client: {len(data["values"])} capture-derived values match byte-for-byte')
        if native:
            item=next(value for value in data['values'] if value['value'].startswith('0004'))
            raw=bytes.fromhex(item['value'])[2:];expected=0
            for byte in raw:expected=(expected<<7)|(byte&127)
            env=dict(os.environ,LD_PRELOAD=str(Path(native).resolve().with_name('native_socket_trace.so')),OMSP_TEST_PORT=str(port),OMSP_CAPTURE_RID=str(item['rid']),OMSP_CAPTURE_AID=str(item['aid']),OMSP_CAPTURE_UINT=str(expected))
            process=subprocess.run([str(Path(native).resolve()),str(Path(reference).resolve()),'::127.0.0.1:SIMATIC-ROOT-ES:6.0'],cwd=certs.parent.parent,env=env,capture_output=True,text=True,timeout=12)
            assert process.returncode==0,process.stdout+process.stderr
            assert 'capture.read.status=0x0000000000000000' in process.stdout,process.stdout
            print('Native TLS client: capture-derived UDInt matches')
    finally:store.close()


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('library');p.add_argument('mapping');p.add_argument('model');p.add_argument('--reference',required=True);p.add_argument('--credentials',required=True);p.add_argument('--python-path');p.add_argument('--native')
    a=p.parse_args();check(a.library,a.mapping,a.model,a.reference,a.credentials,a.python_path,a.native)
