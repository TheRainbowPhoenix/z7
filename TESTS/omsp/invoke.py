"""Registered Invoke: bounded parsing, host dispatch and native client roundtrip."""
import argparse
import ctypes as C
from contextlib import closing
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading

from mapped import Store
from wire import frame, vlq


class Invocation(C.Structure):
    _fields_ = [(name, C.c_uint32) for name in ('target', 'method', 'session', 'client', 'role')]


Handler = C.CFUNCTYPE(C.c_uint64, C.c_void_p, C.POINTER(Invocation), C.c_void_p,
                     C.c_size_t, C.c_void_p, C.c_size_t, C.POINTER(C.c_size_t))
METHOD = 0x50000001


def check(library, native=None, reference=None, credentials=None):
    with tempfile.TemporaryDirectory() as folder:
        with closing(Store(library, Path(folder) / 'objects.shm')) as store:
            store.object(201, 0, 213)
            store.object(1000, 201, 213)
            store.object(1001, 1000, 213)
            store.object(2000, 201, 9001)
            assert store.set(201, 233, b'\0\x15\x04Root') == 0
            assert store.set(1000, 233, b'\0\x15\x06Parent') == 0
            assert store.set(1001, 233, b'\0\x15\x05Child') == 0
            assert store.set(2000, 42, b'\0\x04\x01') == 0
            calls, mode = [], ['valid']
    
            @Handler
            def handler(user, call, arguments, length, output, capacity, output_length):
                try:
                    info = call.contents
                    assert (info.target, info.method) == (2000, METHOD)
                    assert info.session and info.client and info.role in (2, 32)
                    data = C.string_at(arguments, length)
                    calls.append(data)
                    assert capacity == 8192
                    if mode[0] == 'invalid':
                        output_length[0] = capacity + 1
                        return 0
                    if mode[0] == 'error':
                        output_length[0] = capacity + 1  # Failure payload must be ignored.
                        return 0xa03388000088ffe0
                    assert data in (b'\0\0', bytes.fromhex('01000405000100040700'))
                    result = b'\0\x04\x2a' + (b'\0\0' if data == b'\0\0' else bytes.fromhex('01000406000100040800'))
                    assert store.set(2000, 42, b'\0\x04\x2a') == 0
                    C.memmove(output, result, len(result))
                    output_length[0] = len(result)
                    return 0
                except BaseException:
                    output_length[0] = 0
                    return 0x8020ab00199afff4
    
            lib = store.lib
            lib.zomsp_method.argtypes = [C.c_void_p, C.c_uint32, C.c_uint32, Handler, C.c_void_p]
            lib.zomsp_method.restype = C.c_int32
            lib.zomsp_session_open.argtypes, lib.zomsp_session_open.restype = [C.c_void_p], C.c_void_p
            lib.zomsp_session_close.argtypes = [C.c_void_p]
            lib.zomsp_dispatch.argtypes = [C.c_void_p, C.c_void_p, C.c_size_t, C.c_void_p, C.c_size_t]
            lib.zomsp_dispatch.restype = C.c_ssize_t
            assert lib.zomsp_method(store.handle, 9999, METHOD, handler, None) == -2
            assert lib.zomsp_method(store.handle, 2000, METHOD, handler, None) == 0
            assert lib.zomsp_method(store.handle, 2000, METHOD, handler, None) == -1
            lib.zomsp_transactions.argtypes, lib.zomsp_transactions.restype = [C.c_void_p, C.c_uint8], C.c_int32
            assert lib.zomsp_transactions(store.handle, 1) == 0
            session = lib.zomsp_session_open(store.handle)
            assert session
            output = C.create_string_buffer(65535)
            def dispatch(request):
                raw = C.create_string_buffer(request)
                size = lib.zomsp_dispatch(session, raw, len(request), output, len(output))
                return output.raw[14:size] if size > 0 else size
            try:
                assert lib.zomsp_method(store.handle, 2000, METHOD + 1, handler, None) == -6
                fixtures = json.loads(Path(__file__).with_name('native_requests.json').read_text())['requests']
                assert isinstance(dispatch(bytes.fromhex(fixtures['peer0_2'])), bytes)
                assert isinstance(dispatch(bytes.fromhex(fixtures['peer0_3']).replace(bytes.fromhex('7000103d'), bytes.fromhex('70001001'))), bytes)
                def request(counter, arguments=b'\0\0'):
                    return frame(0x56b, 2000, METHOD.to_bytes(4, 'big') + arguments + vlq(counter) + b'\0' * 4)
                raw = request(4)
                assert dispatch(raw[:-1] + b'\x01') == -1
                assert dispatch(request(4, b'\x01\0\0\x01\0\0\0\0')) == -1
                assert calls == [] and store.get(2000, 42) == b'\0\x04\x01'
                assert dispatch(request(4, bytes.fromhex('01000405000100040700'))) == bytes.fromhex('0000042a010004060001000408000800000000')
                assert store.get(2000, 42) == b'\0\x04\x2a'
                mode[0] = 'invalid'
                assert dispatch(request(5)) == -1
                mode[0] = 'error'
                actual = dispatch(request(5))
                assert actual == bytes.fromhex('d08cf180808291ffe0000000000a00000000'), actual.hex()
                mode[0] = 'valid'
                assert dispatch(request(6)) == bytes.fromhex('0000042a00000c00000000')
            finally:
                lib.zomsp_session_close(session)
            try:
                if native:
                    cert = Path(credentials)
                    port = store.start(cert / 'server-cert.pem', cert / 'server-key.pem', reference)
                    env = dict(os.environ, LD_PRELOAD=str(Path(native).resolve().with_name('native_socket_trace.so')),
                               OMSP_TEST_PORT=str(port), OMSP_INVOKE='1', OMSP_INVOKE_TARGET='2000',
                               OMSP_INVOKE_METHOD=str(METHOD))
                    for name in ('OMSP_OBJECT_OPS', 'OMSP_EXTENDED', 'OMSP_SUBSCRIPTIONS', 'OMSP_SEQUENCE'):
                        env.pop(name, None)
                    process = subprocess.run([str(Path(native).resolve()), str(Path(reference).resolve()),
                        '::127.0.0.1:SIMATIC-ROOT-ES:6.0'], cwd=Path(credentials).parent.parent,
                        env=env, capture_output=True, text=True, timeout=12)
                    assert process.returncode == 0, process.stdout + process.stderr
                    assert 'application.invoke.value=42' in process.stdout, process.stdout
                    assert store.get(2000, 42) == b'\0\x04\x2a'
                    assert lib.zomsp_method(store.handle, 2000, METHOD + 1, handler, None) == -6
                    print('Native client -> registered Python/mmap Invoke: passed')
                    env.update(OMSP_OBJECT_OPS='1', OMSP_EXPLORE_RID='1001', OMSP_EXPLORE_PARENT='1', OMSP_FILTER='1')
                    for miss in (False, True):
                        if miss: env['OMSP_FILTER_MISS'] = '1'
                        else: env.pop('OMSP_FILTER_MISS', None)
                        process = subprocess.run([str(Path(native).resolve()), str(Path(reference).resolve()),
                            '::127.0.0.1:SIMATIC-ROOT-ES:6.0'], cwd=Path(credentials).parent.parent,
                            env=env, capture_output=True, text=True, timeout=12)
                        assert process.returncode == 0, process.stdout + process.stderr
                        assert 'application.explore.status=0x0000000000000000' in process.stdout, process.stdout
                        assert ('count=0' if miss else 'count=1') in process.stdout, process.stdout
                    print('Native client -> mapped ancestor Explore and matching/nonmatching filters: passed')
                    upload_env = dict(env, OMSP_SEQUENCE='1', OMSP_UPLOAD_RID='1000')
                    for name in ('OMSP_OBJECT_OPS','OMSP_FILTER','OMSP_FILTER_MISS'):
                        upload_env.pop(name,None)
                    process = subprocess.run([str(Path(native).resolve()), str(Path(reference).resolve()),
                        '::127.0.0.1:SIMATIC-ROOT-ES:6.0'], cwd=Path(credentials).parent.parent,
                        env=upload_env,capture_output=True,text=True,timeout=12)
                    assert process.returncode == 0,process.stdout+process.stderr
                    assert 'sequence.upload.status=0x0000000000000000' in process.stdout,process.stdout
                    print('Native client -> sequenced mapped object upload: passed')
                    for abort in (False, True):
                        env.update(OMSP_SEQUENCE='1', OMSP_COLLECTIVE='1', OMSP_TRANSACTION_WRITE='2000')
                        for name in ('OMSP_OBJECT_OPS', 'OMSP_FILTER', 'OMSP_FILTER_MISS'):
                            env.pop(name, None)
                        if abort: env['OMSP_ABORT'] = '1'
                        else: env.pop('OMSP_ABORT', None)
                        process = subprocess.Popen([str(Path(native).resolve()), str(Path(reference).resolve()),
                            '::127.0.0.1:SIMATIC-ROOT-ES:6.0'], cwd=Path(credentials).parent.parent,
                            env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
                        lines, ready = [], threading.Event()
                        def collect():
                            for line in process.stdout:
                                lines.append(line)
                                if 'sequence.write.status=' in line: ready.set()
                            ready.set()
                        reader = threading.Thread(target=collect, daemon=True)
                        reader.start()
                        try:
                            assert ready.wait(8), ''.join(lines)
                            assert 'sequence.write.status=0x0000000000000000' in ''.join(lines), ''.join(lines)
                            assert store.get(2000, 42) == b'\0\x04\x2a', 'transaction leaked uncommitted value'
                            assert process.wait(timeout=12) == 0, ''.join(lines)
                        finally:
                            if process.poll() is None: process.kill(); process.wait(timeout=3)
                            reader.join(2)
                        assert 'sequence.end.status=0x0000000000000000' in ''.join(lines), ''.join(lines)
                        assert store.get(2000, 42) == (b'\0\x04\x2a' if abort else b'\0\x04\x0b')
                    print('Native client -> collective isolated write, commit and abort: passed')
            finally:
                store.close()
        print('Registered Invoke bounds, malformed rollback, output/inout values and error recovery: passed')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('library')
    parser.add_argument('--native')
    parser.add_argument('--reference')
    parser.add_argument('--credentials')
    args = parser.parse_args()
    check(args.library, args.native, args.reference, args.credentials)
