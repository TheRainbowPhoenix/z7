"""Native/Python TLS credential interop. Passwords and certificates are disposable."""
import argparse
import ctypes as C
from contextlib import closing
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from mapped import Store


def check(library, reference, credentials, native=None, python_path=None, binary=None):
    if not (binary or native or python_path):
        raise ValueError('select a zOMSp binary, native client, or Python client')
    certs = Path(credentials).resolve()
    password = b'disposable-modern'
    if python_path:
        sys.path.insert(0, str(Path(python_path).resolve()))
        from s7commplus.omsp.session import Session, ProtocolError
    for profile in ('modern', 'uac'):
        with tempfile.TemporaryDirectory() as folder, closing(Store(library, Path(folder)/'objects.shm')) as store:
            lib = store.lib
            lib.zomsp_password.argtypes = [C.c_void_p,C.c_void_p,C.c_size_t]
            lib.zomsp_password.restype = C.c_int32
            lib.zomsp_user_password.argtypes = [C.c_void_p,C.c_void_p,C.c_size_t,C.c_void_p,C.c_size_t]
            lib.zomsp_user_password.restype = C.c_int32
            assert lib.zomsp_password(store.handle,None,0) == -1
            if profile == 'uac':
                assert lib.zomsp_user_password(store.handle,b'operator',8,password,len(password)) == 0
            else:
                assert lib.zomsp_password(store.handle,password,len(password)) == 0
            lib.zomsp_transactions.argtypes=[C.c_void_p,C.c_uint8]
            assert lib.zomsp_transactions(store.handle,1)==0
            store.object(201,0,213)
            store.object(1000,201,9001)
            assert store.set(1000,42,b'\0\x04\x01') == 0
            lib.zomsp_start.argtypes=[C.c_void_p,C.c_uint16,C.c_char_p,C.c_char_p,C.c_char_p]
            lib.zomsp_start.restype=C.c_int32
            lib.zomsp_port.argtypes,lib.zomsp_port.restype=[C.c_void_p],C.c_uint16
            lib.zomsp_stop.argtypes=[C.c_void_p]
            assert lib.zomsp_start(store.handle,0,os.fsencode(certs/'server-cert.pem'),os.fsencode(certs/'server-key.pem'),os.fsencode(Path(reference).resolve())) == 0
            try:
                port = lib.zomsp_port(store.handle)
                if binary:
                    cases = ('valid','password','username') if profile == 'uac' else ('valid','password')
                    for case in cases:
                        env = dict(os.environ,ZOMSP_PASSWORD='incorrect' if case == 'password' else password.decode())
                        if profile == 'uac':env['ZOMSP_USERNAME']='unknown' if case == 'username' else 'operator'
                        else:env.pop('ZOMSP_USERNAME',None)
                        process = subprocess.run([str(Path(binary).resolve()),'--client','127.0.0.1',str(port),str(certs/'server-cert.pem'),str(Path(reference).resolve())],env=env,capture_output=True,text=True,timeout=12)
                        if case == 'valid':
                            assert process.returncode == 0,process.stdout+process.stderr
                            assert 'authenticated roundtrip=ok' in process.stderr,process.stderr
                        else:
                            assert process.returncode != 0,process.stdout+process.stderr
                    print(f'zOMSp client/server {profile}: accepted and rejected credentials passed')
                if native:
                    for wrong in (False,True):
                        env = dict(os.environ,LD_PRELOAD=str(Path(native).resolve().with_name('native_socket_trace.so')),
                            OMSP_TEST_PORT=str(port),OMSP_PASSWORD='incorrect' if wrong else password.decode())
                        if profile == 'uac':env['OMSP_USERNAME']='operator'
                        else:env.pop('OMSP_USERNAME',None)
                        if wrong:env['OMSP_PASSWORD_WRONG']='1'
                        else:env.pop('OMSP_PASSWORD_WRONG',None)
                        p=subprocess.run([str(Path(native).resolve()),str(Path(reference).resolve()),'::127.0.0.1:SIMATIC-ROOT-ES:6.0'],cwd=certs.parent.parent,env=env,capture_output=True,text=True,timeout=12)
                        assert p.returncode == 0,p.stdout+p.stderr
                        assert f'session.password.access={4 if wrong else 1}' in p.stdout,p.stdout
                    print(f'Native SDK {profile}: accepted and rejected credentials passed')
                if python_path:
                    for wrong in (False,True):
                        with Session('127.0.0.1',port,certs/'server-cert.pem',tls_exporter=True) as client:
                            assert client.read(1842).get_value() == 4
                            try:
                                client.authenticate('incorrect' if wrong else password.decode(),'operator' if profile=='uac' else '')
                            except ProtocolError:
                                assert wrong
                            else:
                                assert not wrong
                                assert client.read(42,1000).get_value() == 1
                                from s7commplus.core.pvalue import ValueUDInt
                                for abort in (True,False):
                                    assert client.start_transaction()
                                    client.write(1000,42,ValueUDInt(9))
                                    assert client.read(42,1000).get_value()==9
                                    assert store.get(1000,42)==b'\0\x04\x01'
                                    client.end_sequence(abort=abort)
                                    assert store.get(1000,42)==(b'\0\x04\x01' if abort else b'\0\x04\x09')
                                assert client.upload_raw(1000)
                                assert store.set(1000,42,b'\0\x04\x01')==0
                    print(f'Python {profile}: accepted and rejected credentials passed')
            finally:
                lib.zomsp_stop(store.handle)


if __name__ == '__main__':
    p=argparse.ArgumentParser()
    p.add_argument('library');p.add_argument('--reference',required=True)
    p.add_argument('--credentials',required=True);p.add_argument('--native');p.add_argument('--python-path');p.add_argument('--binary')
    a=p.parse_args()
    check(a.library,a.reference,a.credentials,a.native,a.python_path,a.binary)
