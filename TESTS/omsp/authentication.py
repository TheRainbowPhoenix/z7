"""Legacy TLS password profile: nonce isolation, malformed rollback and native SDK proof."""
import argparse
import ctypes as C
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
from mapped import Store
from wire import frame, vlq, QUALIFIER

PASSWORD = b'zomsp-disposable-test'


def check(library, native=None, reference=None, credentials=None):
    with tempfile.TemporaryDirectory() as folder, closing(Store(library, Path(folder) / 'objects.shm')) as store:
        store.object(1000, 0, 9001)
        assert store.set(1000, 42, b'\0\x04\x01') == 0
        lib = store.lib
        lib.zomsp_legacy_password.argtypes = [C.c_void_p, C.c_void_p, C.c_size_t]
        lib.zomsp_legacy_password.restype = C.c_int32
        lib.zomsp_session_open.argtypes, lib.zomsp_session_open.restype = [C.c_void_p], C.c_void_p
        lib.zomsp_session_close.argtypes = [C.c_void_p]
        lib.zomsp_dispatch.argtypes = [C.c_void_p, C.c_void_p, C.c_size_t, C.c_void_p, C.c_size_t]
        lib.zomsp_dispatch.restype = C.c_ssize_t
        assert lib.zomsp_legacy_password(store.handle, None, 257) == -1
        assert lib.zomsp_legacy_password(store.handle, PASSWORD, len(PASSWORD)) == 0
        fixtures = json.loads(Path(__file__).with_name('native_requests.json').read_text())['requests']
        output = C.create_string_buffer(65535)
        def dispatch(session, request):
            raw = C.create_string_buffer(request)
            length = lib.zomsp_dispatch(session, raw, len(request), output, len(output))
            return output.raw[14:length] if length > 0 else length
        def read(target, aid, counter):
            return frame(0x586, target, b'\x20\x04\x01' + vlq(aid) + QUALIFIER + b'\0\x01' + vlq(counter) + b'\0' * 4)
        def connect():
            session = lib.zomsp_session_open(store.handle)
            assert session
            assert isinstance(dispatch(session, bytes.fromhex(fixtures['peer0_2'])), bytes)
            assert isinstance(dispatch(session, bytes.fromhex(fixtures['peer0_3']).replace(bytes.fromhex('7000103d'), bytes.fromhex('70001001'))), bytes)
            return session
        def proof(session, value, counter=4, tail=b'\0'*4):
            return dispatch(session, frame(0x4f2, 0x70001001, b'\x01' + vlq(304) + b'\x10\x02\x14' + value + QUALIFIER + b'\0' + vlq(counter) + tail))
        first, other = connect(), connect()
        try:
            assert lib.zomsp_legacy_password(store.handle, None, 0) == -6
            assert dispatch(first, read(1000, 42, 1)) == -1
            address = b'\0' + vlq(1000) + b'\x01\x2a'
            mixed_write = frame(0x542, 0x70001001, b'\x01\x04' + address + b'\x01\0\x04\x09\0' + QUALIFIER + b'\x04' + b'\0' * 4)
            assert dispatch(first, mixed_write) == -1
            assert store.get(1000, 42) == b'\0\x04\x01'
            challenge = dispatch(first, read(0x70001001, 303, 1))[5:25]
            second = dispatch(other, read(0x70001001, 303, 1))[5:25]
            assert len(challenge) == 20 and challenge != second
            digest = hashlib.sha1(PASSWORD).digest()
            answer = bytes(a ^ b for a, b in zip(digest, challenge))
            assert proof(first, answer, tail=b'\0\0\0\x01') == -1
            result = proof(first, answer)
            assert result == bytes.fromhex('000800000000'), result.hex() if isinstance(result, bytes) else result
            assert dispatch(first, read(0x70001001, 1842, 2))[2:5] == b'\0\x04\x01'
            assert dispatch(first, read(1000, 42, 3))[2:5] == b'\0\x04\x01'
            replay = proof(first, answer, 5)
            assert isinstance(replay, bytes) and replay[0] != 0
            rejected = proof(other, answer)
            assert isinstance(rejected, bytes) and rejected[0] != 0
            assert dispatch(other, read(1000, 42, 2)) == -1
        finally:
            lib.zomsp_session_close(first)
            lib.zomsp_session_close(other)
        if native:
            lib.zomsp_start.argtypes = [C.c_void_p, C.c_uint16, C.c_char_p, C.c_char_p, C.c_char_p]
            lib.zomsp_start.restype = C.c_int32
            lib.zomsp_port.argtypes, lib.zomsp_port.restype = [C.c_void_p], C.c_uint16
            lib.zomsp_stop.argtypes = [C.c_void_p]
            certs = Path(credentials).resolve()
            assert lib.zomsp_start(store.handle, 0, os.fsencode(certs/'server-cert.pem'), os.fsencode(certs/'server-key.pem'), os.fsencode(Path(reference).resolve())) == 0
            try:
                env = dict(os.environ, LD_PRELOAD=str(Path(native).resolve().with_name('native_socket_trace.so')),
                           OMSP_TEST_PORT=str(lib.zomsp_port(store.handle)), OMSP_PASSWORD=PASSWORD.decode())
                for wrong in (False, True):
                    if wrong:
                        env.update(OMSP_PASSWORD='incorrect-disposable-password', OMSP_PASSWORD_WRONG='1')
                    process = subprocess.run([str(Path(native).resolve()), str(Path(reference).resolve()),
                        '::127.0.0.1:SIMATIC-ROOT-ES:6.0'], cwd=certs.parent.parent,
                        env=env, capture_output=True, text=True, timeout=12)
                    assert process.returncode == 0, process.stdout + process.stderr
                    assert f'session.password.access={4 if wrong else 1}' in process.stdout, process.stdout
                    if not wrong:
                        assert 'session.password.status=0x0000000000000000' in process.stdout, process.stdout
                print('Native client -> legacy TLS password success and rejection: passed')
            finally:
                lib.zomsp_stop(store.handle)
    print('Password nonce isolation, single use, access gate and malformed rollback: passed')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('library')
    parser.add_argument('--native')
    parser.add_argument('--reference')
    parser.add_argument('--credentials')
    args = parser.parse_args()
    check(args.library, args.native, args.reference, args.credentials)
