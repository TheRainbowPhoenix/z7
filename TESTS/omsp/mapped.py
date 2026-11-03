"""Headless mapped-file ABI checks; no Siemens or third-party Python dependency."""
import ctypes as C
import mmap
from pathlib import Path
import struct
import sys
import tempfile


class Store:
    def __init__(self, library, path, create=True):
        self.lib = C.CDLL(str(Path(library).resolve()))
        signatures = {
            'open': ([C.c_char_p, C.c_uint8], C.c_void_p),
            'object': ([C.c_void_p, C.c_uint32, C.c_uint32, C.c_uint32], C.c_int32),
            'link': ([C.c_void_p, C.c_uint32, C.c_uint32, C.POINTER(C.c_uint32), C.c_size_t], C.c_int32),
            'set': ([C.c_void_p, C.c_uint32, C.c_uint32, C.c_void_p, C.c_size_t, C.c_uint8], C.c_int32),
            'get': ([C.c_void_p, C.c_uint32, C.c_uint32, C.c_void_p, C.c_size_t], C.c_ssize_t),
            'size': ([], C.c_size_t),
            'start': ([C.c_void_p, C.c_uint16, C.c_char_p, C.c_char_p, C.c_char_p], C.c_int32),
            'port': ([C.c_void_p], C.c_uint16),
            'stop': ([C.c_void_p], None),
            'close': ([C.c_void_p], None),
        }
        for name, (args, result) in signatures.items():
            function = getattr(self.lib, 'zomsp_' + name)
            function.argtypes, function.restype = args, result
        self.handle = self.lib.zomsp_open(str(path).encode(), int(create))
        if not self.handle:
            raise RuntimeError('cannot open mapped store')

    def object(self, rid, parent, class_id):
        assert self.lib.zomsp_object(self.handle, rid, parent, class_id) == 0

    def set(self, rid, aid, raw, writable=True):
        data = C.create_string_buffer(raw)
        return self.lib.zomsp_set(self.handle, rid, aid, data, len(raw), int(writable))

    def link(self, rid, aid, targets):
        values = (C.c_uint32 * len(targets))(*targets)
        assert self.lib.zomsp_link(self.handle, rid, aid, values, len(targets)) == 0

    def get(self, rid, aid):
        data = C.create_string_buffer(1024)
        size = self.lib.zomsp_get(self.handle, rid, aid, data, len(data))
        if size < 0:
            raise RuntimeError('read failed: %d' % size)
        return data.raw[:size]

    def start(self, cert, key, library):
        assert self.lib.zomsp_start(self.handle, 0, str(cert).encode(), str(key).encode(), str(library).encode()) == 0
        return self.lib.zomsp_port(self.handle)

    def close(self):
        if self.handle:
            self.lib.zomsp_close(self.handle)
            self.handle = None


def check(library):
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / 'objects.shm'
        store = Store(library, path)
        other = None
        try:
            assert path.stat().st_size == store.lib.zomsp_size() == 539712
            store.object(201, 0, 213)
            store.object(1000, 201, 255)
            assert store.set(1000, 233, b'\0\x15\x07Fixture') == 0
            assert store.set(1000, 42, b'\0\x04\x7b') == 0
            packed = b'\0\x17\x90\0\0\x01' + b'\0' * 8 + b'\x02\x03abc'
            assert store.set(1000, 99, packed) == 0
            assert store.get(1000, 99) == packed
            assert store.set(1000, 99, packed[:-1]) == -1
            sparse = b'\x40\x16\x01\0\x04\x7b\0'
            assert store.set(1000, 100, sparse) == 0
            assert store.get(1000, 100) == sparse
            other = Store(library, path, create=False)
            assert other.get(1000, 42) == b'\0\x04\x7b'
            assert other.set(1000, 42, b'\0\x04\x01') == 0
            assert store.get(1000, 42) == b'\0\x04\x01'
            before = path.read_bytes()
            assert store.set(1000, 42, b'\0\x15\x05x') == -1
            assert path.read_bytes() == before
            with path.open('r+b') as file, mmap.mmap(file.fileno(), 0) as mapped:
                assert mapped[:8] == b'zOMSp001'
                assert struct.unpack_from('<II', mapped, 24) == (2, 4)
                assert mapped.find(b'\0\x15\x07Fixture') >= 0
            assert store.lib.zomsp_object(store.handle, 1000, 201, 255) == -1
            assert store.lib.zomsp_object(store.handle, 1001, 999, 255) == -2
        finally:
            if other:
                other.close()
            store.close()
        reopened = Store(library, path, create=False)
        assert reopened.get(1000, 42) == b'\0\x04\x01'
        reopened.close()
        path.write_bytes(b'invalid')
        lib = C.CDLL(str(Path(library).resolve()))
        lib.zomsp_open.argtypes, lib.zomsp_open.restype = [C.c_char_p, C.c_uint8], C.c_void_p
        assert not lib.zomsp_open(str(path).encode(), 1)
        assert path.read_bytes() == b'invalid'
    print('mapped ABI: persistence, bounds, validation and independent mappings passed')


if __name__ == '__main__':
    check(sys.argv[1])
