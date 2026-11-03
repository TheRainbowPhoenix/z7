"""Small Python binding to the zOMSp C library; no Python OMSp implementation.

Client calls perform real OMSp/TLS requests in Zig. Server publishes mapped
values and delivers committed uploads as retained, seekable memory streams.
"""
import ctypes as C
import io
import os
from pathlib import Path
import struct
import time

ROOT = Path(__file__).resolve().parents[2]


class Invocation(C.Structure):
    _fields_ = [(name, C.c_uint32) for name in ("target", "method", "session", "client", "role")]


Validate = C.CFUNCTYPE(C.c_uint64, C.c_void_p, C.POINTER(Invocation), C.c_void_p, C.c_size_t)
Complete = C.CFUNCTYPE(None, C.c_void_p, C.POINTER(Invocation), C.c_void_p)


def vlq(number):
    result = bytearray([number & 127])
    number >>= 7
    while number:
        result.insert(0, 128 | (number & 127))
        number >>= 7
    return bytes(result)


def encode(value):
    if isinstance(value, bool):
        return b"\0\x01" + bytes([value])
    if isinstance(value, int) and 0 <= value <= 0xffffffff:
        return b"\0\x04" + vlq(value)
    if isinstance(value, float):
        return b"\0\x0e" + struct.pack(">f", value)
    if isinstance(value, str):
        data = value.encode("utf-8")
        return b"\0\x15" + vlq(len(data)) + data
    if isinstance(value, bytes):
        return b"\0\x14\0" + vlq(len(value)) + value
    raise ValueError("supported values: Bool, UDInt, REAL, WString, untyped Blob")


def decode(raw):
    if len(raw) < 2 or raw[0] != 0:
        raise ValueError("use read_raw for arrays and structured values")
    kind = raw[1]
    if kind == 1 and len(raw) == 3:
        return bool(raw[2])
    if kind in (3, 0x0c, 0x0e, 0x0f, 0x12):
        formats = {3: ">H", 0x0c: ">I", 0x0e: ">f", 0x0f: ">d", 0x12: ">I"}
        return struct.unpack(formats[kind], raw[2:])[0]
    offset = 2
    if kind == 0x14:
        if raw[offset] != 0:
            raise ValueError("typed Blob: use read_raw")
        offset += 1
    number = 0
    for _ in range(5):
        byte = raw[offset]
        offset += 1
        number = (number << 7) | (byte & 127)
        if not byte & 128:
            break
    else:
        raise ValueError("invalid VLQ")
    if kind == 4 and offset == len(raw):
        return number
    if kind in (0x14, 0x15) and len(raw) - offset == number:
        return raw[offset:].decode("utf-8") if kind == 0x15 else raw[offset:]
    raise ValueError("unsupported encoded value; use read_raw")


class Library:
    def __init__(self, path=None):
        path = path or ROOT / ("zig-out/bin/zomsp.dll" if os.name == "nt" else "zig-out/lib/libzomsp.so")
        self.dll = C.CDLL(str(Path(path).resolve()))
        pointer, size, integer = C.c_void_p, C.c_size_t, C.c_int32
        signatures = {
            "open": ([C.c_char_p, C.c_uint8], pointer),
            "close": ([pointer], None),
            "object": ([pointer, C.c_uint32, C.c_uint32, C.c_uint32], integer),
            "set": ([pointer, C.c_uint32, C.c_uint32, pointer, size, C.c_uint8], integer),
            "get": ([pointer, C.c_uint32, C.c_uint32, pointer, size], C.c_ssize_t),
            "start": ([pointer, C.c_uint16, C.c_char_p, C.c_char_p, C.c_char_p], integer),
            "port": ([pointer], C.c_uint16),
            "password": ([pointer, pointer, size], integer),
            "user_password": ([pointer, pointer, size, pointer, size], integer),
            "transactions": ([pointer, C.c_uint8], integer),
            "stream": ([pointer, C.c_uint32, C.c_uint32, C.c_uint32, Validate, Complete, pointer], integer),
            "buffer_retain": ([pointer], None),
            "buffer_release": ([pointer], None),
            "buffer_generation": ([pointer], C.c_uint64),
            "buffer_size": ([pointer], size),
            "buffer_read": ([pointer, size, pointer, size], C.c_ssize_t),
            "client_open": ([C.c_char_p, C.c_uint16, C.c_char_p, C.c_char_p], pointer),
            "client_close": ([pointer], None),
            "client_session": ([pointer], C.c_uint32),
            "client_status": ([pointer], C.c_uint64),
            "client_read": ([pointer, C.c_uint32, C.c_uint32, pointer, size], C.c_ssize_t),
            "client_write": ([pointer, C.c_uint32, C.c_uint32, pointer, size], integer),
            "client_find": ([pointer, C.c_uint32, pointer, size, C.POINTER(C.c_uint32)], integer),
            "client_begin": ([pointer], integer),
            "client_end": ([pointer, C.c_uint8], integer),
            "client_upload": ([pointer, C.c_uint32, C.c_uint32, pointer, size], integer),
            "client_authenticate": ([pointer, pointer, size, pointer, size], integer),
        }
        for name, (arguments, result) in signatures.items():
            function = getattr(self.dll, "zomsp_" + name)
            function.argtypes, function.restype = arguments, result

    @staticmethod
    def check(result):
        if result < 0:
            raise RuntimeError("zOMSp error %d" % result)
        return result


class Upload(io.RawIOBase):
    """An owned immutable upload. Safe to queue to another thread; close it there."""
    def __init__(self, library, handle):
        super().__init__()
        self.library, self.handle = library, handle
        self.length = library.dll.zomsp_buffer_size(handle)
        self.generation = library.dll.zomsp_buffer_generation(handle)
        self.position = 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        self._checkClosed()
        return self.position

    def seek(self, offset, whence=io.SEEK_SET):
        self._checkClosed()
        position = offset if whence == io.SEEK_SET else self.position + offset if whence == io.SEEK_CUR else self.length + offset if whence == io.SEEK_END else -1
        if not 0 <= position <= self.length:
            raise ValueError("seek outside upload")
        self.position = position
        return position

    def readinto(self, output):
        self._checkClosed()
        target = memoryview(output).cast("B")
        if target.readonly:
            raise ValueError("read target is immutable")
        if not target:
            return 0
        array = (C.c_ubyte * len(target)).from_buffer(target)
        count = self.library.check(self.library.dll.zomsp_buffer_read(self.handle, self.position, array, len(target)))
        self.position += count
        return count

    def read(self, size=-1):
        self._checkClosed()
        size = self.length - self.position if size < 0 else min(size, self.length - self.position)
        result = bytearray(size)
        count = self.readinto(result)
        return bytes(result[:count])

    def close(self):
        if not self.closed:
            self.library.dll.zomsp_buffer_release(self.handle)
            self.handle = None
        super().close()


class Server:
    def __init__(self, mapping, library=None):
        self.library = library or Library()
        self.dll = self.library.dll
        self.handle = self.dll.zomsp_open(os.fsencode(mapping), 1)
        if not self.handle:
            raise RuntimeError("cannot open mapped backend")
        self.names, self.callbacks, self.errors = {}, [], []
        self.writable = {}
        self.library.check(self.dll.zomsp_object(self.handle, 201, 0, 9000))

    def variable(self, name, initial, rid=None, writable=True):
        if name in self.names or not 1 <= len(name.encode("utf-8")) <= 128:
            raise ValueError("variable name must be unique and 1..128 UTF-8 bytes")
        rid = rid or 1000 + len(self.names)
        self.library.check(self.dll.zomsp_object(self.handle, rid, 201, 9001))
        self._set(rid, 233, name, False)
        self._set(rid, 42, initial, writable)
        self.names[name] = rid
        self.writable[name] = writable
        return rid

    def _call(self, operation):
        deadline = time.monotonic() + 1
        while True:
            result = operation()
            if result != -6 or time.monotonic() >= deadline:
                return self.library.check(result)
            time.sleep(0.0001)

    def _error(self, error):
        if len(self.errors) < 16:
            self.errors.append(str(error)[:1024])

    def _set(self, rid, aid, value, writable=True):
        raw = encode(value)
        self._call(lambda: self.dll.zomsp_set(self.handle, rid, aid, raw, len(raw), writable))

    def set(self, name, value):
        self._set(self.names[name], 42, value, self.writable[name])

    def password(self, password, username=None):
        secret = password.encode("utf-8")
        if username is None:
            self.library.check(self.dll.zomsp_password(self.handle, secret, len(secret)))
        else:
            user = username.encode("utf-8")
            self.library.check(self.dll.zomsp_user_password(self.handle, user, len(user), secret, len(secret)))

    def read(self, name):
        output = C.create_string_buffer(1024)
        length = self._call(lambda: self.dll.zomsp_get(self.handle, self.names[name], 42, output, len(output)))
        return decode(output.raw[:length])

    def stream(self, rid, aid, length, on_complete, validate=None):
        self.library.check(self.dll.zomsp_object(self.handle, rid, 201, 9001))
        self.library.check(self.dll.zomsp_transactions(self.handle, 1))

        @Validate
        def check(user, invocation, data, count):
            try:
                view = memoryview((C.c_ubyte * count).from_address(data)).cast("B").toreadonly()
                return validate(view) if validate else 0
            except Exception as error:
                self._error(error)
                return 0x8020ab00199afff4

        @Complete
        def complete(user, invocation, buffer):
            self.dll.zomsp_buffer_retain(buffer)
            upload = Upload(self.library, buffer)
            try:
                on_complete(upload)
            except Exception as error:
                upload.close()
                self._error(error)

        self.callbacks.extend([check, complete])
        self.library.check(self.dll.zomsp_stream(self.handle, rid, aid, length, check, complete, None))

    def start(self, certificate, key, tls_library, port=0):
        self.library.check(self.dll.zomsp_start(self.handle, port, os.fsencode(certificate), os.fsencode(key), os.fsencode(tls_library)))
        return self.dll.zomsp_port(self.handle)

    def close(self):
        if self.handle:
            self.dll.zomsp_close(self.handle)
            self.handle = None

    def __enter__(self):
        return self

    def __exit__(self, *exception):
        self.close()


class Client:
    """Persistent Zig OMSp client. Serialize calls or use one client per worker."""
    def __init__(self, host, port, certificate, tls_library, library=None, root=201):
        self.library = library or Library()
        self.dll, self.root = self.library.dll, root
        self.handle = self.dll.zomsp_client_open(host.encode(), port, os.fsencode(certificate), os.fsencode(tls_library))
        if not self.handle:
            raise RuntimeError("OMSp TLS/session login failed")

    def _check(self, result):
        if result < 0:
            status = self.dll.zomsp_client_status(self.handle)
            raise RuntimeError("zOMSp client error %d, remote status 0x%016x" % (result, status))
        return result

    @property
    def session(self):
        return self.dll.zomsp_client_session(self.handle)

    def authenticate(self, password, username=""):
        user, secret = username.encode(), password.encode()
        self._check(self.dll.zomsp_client_authenticate(self.handle, user, len(user), secret, len(secret)))

    def resolve(self, name):
        rid = C.c_uint32()
        text = name.encode("utf-8")
        self._check(self.dll.zomsp_client_find(self.handle, self.root, text, len(text), C.byref(rid)))
        return rid.value

    def read_raw(self, name, aid=42):
        rid = self.resolve(name) if isinstance(name, str) else name
        output = C.create_string_buffer(65535)
        length = self._check(self.dll.zomsp_client_read(self.handle, rid, aid, output, len(output)))
        return output.raw[:length]

    def read(self, name, aid=42):
        return decode(self.read_raw(name, aid))

    def write(self, name, value, aid=42):
        rid = self.resolve(name) if isinstance(name, str) else name
        raw = encode(value)
        self._check(self.dll.zomsp_client_write(self.handle, rid, aid, raw, len(raw)))

    def begin(self):
        self._check(self.dll.zomsp_client_begin(self.handle))

    def end(self, abort=False):
        self._check(self.dll.zomsp_client_end(self.handle, abort))

    def upload(self, rid, aid, data):
        view = memoryview(data).cast("B")
        raw = bytes(view)
        self._check(self.dll.zomsp_client_upload(self.handle, rid, aid, raw, len(raw)))

    def close(self):
        if self.handle:
            self.dll.zomsp_client_close(self.handle)
            self.handle = None

    def __enter__(self):
        return self

    def __exit__(self, *exception):
        self.close()
