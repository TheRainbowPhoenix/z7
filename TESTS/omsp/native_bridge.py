"""Loopback byte relay for a Linux native SDK client testing a Windows server.
Stdout/stdin carry only socket bytes. The SDK result is emitted as JSON on stderr.
"""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading


def main():
    p=argparse.ArgumentParser();p.add_argument('--native',required=True);p.add_argument('--reference',required=True);p.add_argument('--credentials',required=True);p.add_argument('--program',required=True)
    a=p.parse_args()
    listener=socket.socket();listener.bind(('127.0.0.1',0));listener.listen(1);listener.settimeout(12)
    native=Path(a.native).resolve()
    env=dict(os.environ,LD_PRELOAD=str(native.with_name('native_socket_trace.so')),OMSP_TEST_PORT=str(listener.getsockname()[1]),OMSP_SEQUENCE='1',OMSP_COLLECTIVE='1',OMSP_ACTIVATION='1',OMSP_TRANSACTION_WRITE='1000',OMSP_PROGRAM=a.program)
    child=subprocess.Popen([str(native),str(Path(a.reference).resolve()),'::127.0.0.1:SIMATIC-ROOT-ES:6.0'],cwd=Path(a.credentials).resolve().parent.parent,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    connection=None
    try:
        connection,_=listener.accept();connection.settimeout(None)
        def outgoing():
            try:
                while True:
                    data=connection.recv(65536)
                    if not data:break
                    view=memoryview(data)
                    while view:
                        written=os.write(1,view)
                        view=view[written:]
            except (OSError,BrokenPipeError):pass
        def incoming():
            try:
                while True:
                    data=os.read(0,65536)
                    if not data:break
                    connection.sendall(data)
            except OSError:pass
        threading.Thread(target=outgoing,daemon=True).start()
        threading.Thread(target=incoming,daemon=True).start()
        output,error=child.communicate(timeout=15)
        print('NATIVE_RESULT='+json.dumps({'exit':child.returncode,'stdout':output.decode(errors='replace'),'stderr':error.decode(errors='replace')}),file=sys.stderr,flush=True)
        return child.returncode
    finally:
        if child.poll() is None:child.kill();child.wait()
        if connection:connection.close()
        listener.close()

if __name__=='__main__':raise SystemExit(main())
