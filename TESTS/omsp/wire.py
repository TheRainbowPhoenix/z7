"""Replay native login requests, then exercise the mapped protocol ABI without external modules."""
import ctypes as C
import json
from pathlib import Path
import struct
import sys
import tempfile
from mapped import Store

QUALIFIER = bytes.fromhex('000004e88969001200000000896a001300896b00040000')


def vlq(value):
    out = bytearray([value & 127])
    value >>= 7
    while value:
        out.insert(0, 128 | (value & 127))
        value >>= 7
    return bytes(out)


def frame(function, target, payload, seq=4):
    body = b'\x31\0\0' + struct.pack('>H', function) + b'\0\0' + struct.pack('>HI', seq, 0x70001001) + b'\x34'
    body += struct.pack('>I', target) + payload
    return b'\x72\x02' + struct.pack('>H', len(body)) + body


def check(library):
    fixture = json.loads(Path(__file__).with_name('native_requests.json').read_text())['requests']
    with tempfile.TemporaryDirectory() as folder:
        store = Store(library, Path(folder) / 'objects.shm')
        lib = store.lib
        lib.zomsp_session_open.argtypes, lib.zomsp_session_open.restype = [C.c_void_p], C.c_void_p
        lib.zomsp_session_close.argtypes = [C.c_void_p]
        lib.zomsp_dispatch.argtypes = [C.c_void_p, C.c_void_p, C.c_size_t, C.c_void_p, C.c_size_t]
        lib.zomsp_dispatch.restype = C.c_ssize_t
        lib.zomsp_template.argtypes, lib.zomsp_template.restype = [C.c_void_p, C.c_uint32], C.c_int32
        lib.zomsp_link.argtypes, lib.zomsp_link.restype = [C.c_void_p, C.c_uint32, C.c_uint32, C.POINTER(C.c_uint32), C.c_size_t], C.c_int32
        session = lib.zomsp_session_open(store.handle)
        assert session
        output = C.create_string_buffer(65535)

        def dispatch(raw, expected=None):
            data = C.create_string_buffer(raw)
            size = lib.zomsp_dispatch(session, data, len(raw), output, len(output))
            if expected is not None:
                assert size == expected, size
                return
            assert size > 0, size
            result = output.raw[:size]
            assert result[4] == 0x32 and result[7:9] == raw[7:9] and result[11:13] == raw[11:13]
            return result[14:]

        try:
            store.object(201, 0, 213)
            store.object(1000, 201, 255)
            assert store.set(1000, 42, b'\0\x04\x7b') == 0
            alarm = b'\0\x17' + struct.pack('>I', 2681) + vlq(2670) + b'\0\x04\x01' + vlq(2671) + b'\0\x04\x03\0'
            assert store.set(1000, 43, alarm) == 0
            dispatch(bytes.fromhex(fixture['peer0_2']))
            dispatch(bytes.fromhex(fixture['peer0_3']).replace(bytes.fromhex('7000103d'), bytes.fromhex('70001001')))
            read = frame(0x586, 1000, b'\x20\x04\x01\x2a' + QUALIFIER + b'\0\x01\x01' + b'\0' * 4)
            assert dispatch(read) == bytes.fromhex('000000047b0500000000')
            address = b'\0' + vlq(1000) + b'\x02\x2b' + vlq(2671)
            write = frame(0x542, 0, b'\x01\x05' + address + b'\x01\0\x04\x04\0' + QUALIFIER + b'\x04' + b'\0' * 4)
            before = store.get(1000, 43)
            broken = write[:-1] + b'\x01'
            dispatch(broken, expected=-1)
            assert store.get(1000, 43) == before
            assert dispatch(write) == bytes.fromhex('00000800000000')
            assert store.get(1000, 43) == alarm[:-2] + b'\x04\0'
            streamed = frame(0x57c, 1000, b'\x20\x04\x01\x2a' + QUALIFIER + b'\0\x01\0\x04\x09\x05' + b'\0' * 4)
            assert dispatch(streamed) == bytes.fromhex('000a00000000')
            assert store.get(1000, 42) == b'\0\x04\x09'
            dispatch(streamed, expected=-1)
            missing = frame(0x586, 999, b'\x20\x04\x01\x2a' + QUALIFIER + b'\0\x01\x02' + b'\0' * 4)
            assert dispatch(missing).startswith(bytes.fromhex('c08895b080e6b5fff4'))
            store.object(1001, 1000, 255)
            delete = frame(0x4d4, 1000, b'\0' + QUALIFIER + b'\x06' + b'\0' * 4)
            assert dispatch(delete) == b'\0' + struct.pack('>I', 1000) + b'\x0c' + b'\0' * 4
            assert lib.zomsp_object(store.handle, 1002, 1001, 255) == -2
            store.object(2000, 201, 9001)
            assert store.set(2000, 233, b'\0\x15\x07Default') == 0
            assert lib.zomsp_template(store.handle, 2000) == 0
            root = b'\xa1\x7f\xff\xc1\x00' + vlq(9001) + b'\0\0\xa3' + vlq(233) + b'\0\x15\x06Parent'
            child = b'\xa1\x7f\xff\xc1\x01' + vlq(9001) + b'\0\0\xa3' + vlq(233) + b'\0\x15\x05Child\xa2'
            create = frame(0x4ca, 201, bytes.fromhex('00040000000000') + b'\x07' + root + child + b'\xa2' + b'\0' * 4)
            reply = dispatch(create)
            assert reply[:2] == b'\0\x02'
            # Assigned IDs are monotonic and independent of reusable storage slots.
            assert store.get(0x60000000, 233) == b'\0\x15\x06Parent'
            assert store.get(0x60000001, 233) == b'\0\x15\x05Child'
            targets = (C.c_uint32 * 2)(0x60000000, 0x60000001)
            assert lib.zomsp_link(store.handle, 201, 2699, targets, 2) == 0
            link = frame(0x524, 201, vlq(2699) + b'\0\0\x03' + b'\0' * 4)
            assert dispatch(link) == b'\0\x02' + struct.pack('>II', *targets) + b'\x0d' + b'\0' * 4
            explore = frame(0x4bb, 0x60000000, bytes.fromhex('000101000000') + b'\x04' + b'\0' * 5)
            tree = dispatch(explore)
            assert b'Parent' in tree and b'Child' in tree
            assert struct.pack('>I', 9001) not in tree  # Class IDs use VLQ in the native object grammar.
            items = b'\0' + vlq(0x70001001) + b'\x01' + vlq(299) + b'\0' + vlq(0x6fffffff) + b'\x01' + vlq(299)
            mixed = frame(0x54c, 0, b'\x02\x08' + items + QUALIFIER + b'\x05' + b'\0' * 4)
            assert dispatch(mixed) == bytes.fromhex('9089f0808082c88013010004020200000002c08895b080e6b5fff4001500000000')
            begin = frame(0x556, 0, b'')[0:18] + b'\x01\0\0\x08' + b'\0' * 4
            begin = begin[:2] + (len(begin) - 4).to_bytes(2, 'big') + begin[4:]
            assert dispatch(begin) == bytes.fromhex('0000001000000000')
            end = frame(0x560, 0, b'')[0:18] + b'\0\0\x09' + b'\0' * 4
            end = end[:2] + (len(end) - 4).to_bytes(2, 'big') + end[4:]
            assert dispatch(end) == bytes.fromhex('001200000000')
            delete_created = frame(0x4d4, 0x60000000, b'\0' + QUALIFIER + b'\x0a' + b'\0' * 4)
            dispatch(delete_created)
            assert store.get(201, 2699) == b'\x10\x12\0'
            recreate = frame(0x4ca, 201, bytes.fromhex('00040000000000') + b'\x0b' + root + child + b'\xa2' + b'\0' * 4)
            dispatch(recreate)
            assert store.get(0x60000002, 233) == b'\0\x15\x06Parent'
            assert store.get(0x60000003, 233) == b'\0\x15\x05Child'
            invoke = frame(0x56b, 0x70001001, b'\xff' * 4 + b'\0\0\x0c' + b'\0' * 4)
            invalid_invoke = invoke[:-1] + b'\x01'
            dispatch(invalid_invoke, expected=-1)
            rejected = dispatch(invoke)
            assert rejected == bytes.fromhex('c08895b080e6b5fff4') + b'\0' * 4 + b'\x18' + b'\0' * 4
            parent = frame(0x4bb, 0x70001001, bytes.fromhex('000100010000') + b'\x06' + b'\0' * 5)
            assert dispatch(parent) == bytes.fromhex('000000011d1900000000')
            shallow = frame(0x4bb, 0x70001001, bytes.fromhex('000000000000') + b'\x07' + b'\0' * 5)
            assert b'\xa1' + struct.pack('>I', 0x70001001) in dispatch(shallow)
            deep = frame(0x4bb, 0x60000002, bytes.fromhex('000100000000') + b'\x08' + b'\0' * 5)
            tree = dispatch(deep)
            assert b'Parent' in tree and b'Child' in tree
            shallow = frame(0x4bb, 0x60000002, bytes.fromhex('000001000000') + b'\x09' + b'\0' * 5)
            tree = dispatch(shallow)
            assert b'Parent' in tree and b'Child' not in tree
            after_invoke = frame(0x4f2, 0x70001001, b'\x01' + vlq(299) + b'\0\x04\x20' + QUALIFIER + b'\0\x0d' + b'\0' * 4)
            assert dispatch(after_invoke) == bytes.fromhex('001a00000000')
        finally:
            lib.zomsp_session_close(session)
            store.close()
    print('OMSp native login, RID/AID paths, typed structures, streamed writes, atomic rejection and subtree deletion: passed')


if __name__ == '__main__':
    check(sys.argv[1])
