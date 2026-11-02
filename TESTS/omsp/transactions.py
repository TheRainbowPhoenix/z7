"""Collective snapshot isolation, commit, abort, conflict and disconnect cleanup."""
import ctypes as C
from contextlib import closing
import json
from pathlib import Path
import struct
import sys
import tempfile
from mapped import Store
from wire import frame, vlq, QUALIFIER


def sequence(function, payload):
    raw = frame(function, 0, b'')[:18] + payload
    return raw[:2] + (len(raw) - 4).to_bytes(2, 'big') + raw[4:]


def check(library):
    with tempfile.TemporaryDirectory() as folder, closing(Store(library, Path(folder) / 'objects.shm')) as store:
        store.object(201, 0, 213)
        store.object(1000, 201, 9001)
        assert store.set(1000, 42, b'\0\x04\x01') == 0
        lib = store.lib
        lib.zomsp_transactions.argtypes, lib.zomsp_transactions.restype = [C.c_void_p, C.c_uint8], C.c_int32
        lib.zomsp_session_open.argtypes, lib.zomsp_session_open.restype = [C.c_void_p], C.c_void_p
        lib.zomsp_session_close.argtypes = [C.c_void_p]
        lib.zomsp_dispatch.argtypes = [C.c_void_p, C.c_void_p, C.c_size_t, C.c_void_p, C.c_size_t]
        lib.zomsp_dispatch.restype = C.c_ssize_t
        fixtures = json.loads(Path(__file__).with_name('native_requests.json').read_text())['requests']
        output = C.create_string_buffer(65535)
        def dispatch(session, request):
            raw = C.create_string_buffer(request)
            length = lib.zomsp_dispatch(session, raw, len(request), output, len(output))
            return output.raw[14:length] if length > 0 else length
        def connect():
            session = lib.zomsp_session_open(store.handle)
            assert session
            assert isinstance(dispatch(session, bytes.fromhex(fixtures['peer0_2'])), bytes)
            assert isinstance(dispatch(session, bytes.fromhex(fixtures['peer0_3']).replace(bytes.fromhex('7000103d'), bytes.fromhex('70001001'))), bytes)
            return session
        def begin(counter):
            descriptor = b'\xa1\x7f\xff\xc0\x01' + vlq(1700) + b'\0\0\xa3' + vlq(233) + b'\0\x15\x0bTransaction\xa2'
            return sequence(0x556, b'\x02\0\x01\0' + vlq(counter) + descriptor + b'\0' * 4)
        def end(counter, abort=False):
            return sequence(0x560, bytes([int(abort), 1]) + vlq(counter) + b'\0' * 4)
        def write(counter, value):
            return frame(0x4f2, 1000, b'\x01\x2a\0\x04' + vlq(value) + QUALIFIER + b'\0' + vlq(counter) + b'\0' * 4)
        def read(counter):
            return frame(0x586, 1000, b'\x20\x04\x01\x2a' + QUALIFIER + b'\0\x01' + vlq(counter) + b'\0' * 4)
        first = connect()
        try:
            denied = dispatch(first, begin(4))
            assert isinstance(denied, bytes) and denied[0] != 0
            assert lib.zomsp_transactions(store.handle, 1) == -6
        finally:
            lib.zomsp_session_close(first)
        assert lib.zomsp_transactions(store.handle, 1) == 0
        first, other = connect(), connect()
        try:
            assert dispatch(first, begin(4)) == bytes.fromhex('000012700018010800000000')
            assert dispatch(first, write(5, 2)) == bytes.fromhex('000a00000000')
            assert store.get(1000, 42) == b'\0\x04\x01'
            assert dispatch(first, read(1))[4] == 2
            assert dispatch(other, read(1))[4] == 1
            assert dispatch(first, end(6)) == bytes.fromhex('000c00000000')
            assert store.get(1000, 42) == b'\0\x04\x02'
            assert dispatch(other, read(2))[4] == 2
            assert dispatch(first, begin(7))[0] == 0
            assert dispatch(first, write(8, 3))[0] == 0
            assert dispatch(first, end(9, True))[0] == 0
            assert store.get(1000, 42) == b'\0\x04\x02'
            assert dispatch(first, begin(10))[0] == 0
            assert dispatch(first, write(11, 4))[0] == 0
            assert store.set(1000, 42, b'\0\x04\x09') == 0
            assert dispatch(first, end(12)) == -6
            assert store.get(1000, 42) == b'\0\x04\x09'
            assert dispatch(first, end(12, True))[0] == 0
            assert dispatch(first, write(13, 11))[0] == 0
            assert dispatch(first, begin(14))[0] == 0
            assert dispatch(first, write(15, 12))[0] == 0
        finally:
            lib.zomsp_session_close(first)
            lib.zomsp_session_close(other)
        assert store.get(1000, 42) == b'\0\x04\x0b'
    print('Collective private reads, atomic commit, abort, conflict recovery and disconnect rollback: passed')


if __name__ == '__main__':
    check(sys.argv[1])
