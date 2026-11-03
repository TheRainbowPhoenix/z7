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
class ObjectRecord(C.Structure):
    _fields_ = [(name, C.c_uint32) for name in ("kind", "rid", "class_id", "class_flags", "aid", "target", "depth", "reserved")] + [("data", C.c_void_p), ("length", C.c_size_t)]
class NotificationInfo(C.Structure):
    _fields_ = [("subscription", C.c_uint32), ("sequence", C.c_uint32), ("missed", C.c_uint16), ("ticks", C.c_uint16), ("credit", C.c_uint8), ("phase", C.c_uint8), ("reserved", C.c_uint16), ("status", C.c_uint64), ("timestamp", C.c_uint64)]
class ExploreOptions(C.Structure):
    _fields_ = [("flags", C.c_uint32), ("reserved", C.c_uint32), ("aids", C.POINTER(C.c_uint32)), ("aid_count", C.c_size_t), ("filters", C.c_void_p), ("filters_length", C.c_size_t)]
class Reference(C.Structure):
    _fields_ = [(name, C.c_uint32) for name in ("handle", "rid", "aid", "path_length")] + [("path", C.c_uint32 * 3), ("reserved", C.c_uint32)]
class Filter(C.Structure):
    _fields_ = [("operation", C.c_uint32), ("address_count", C.c_uint32), ("address", C.c_uint32 * 4), ("value", C.c_void_p), ("length", C.c_size_t)]
ObjectVisitor = C.CFUNCTYPE(None, C.c_void_p, C.POINTER(ObjectRecord))
EventVisitor = C.CFUNCTYPE(None, C.c_void_p, C.c_uint32, C.c_uint32, C.c_uint32, C.c_uint32, C.c_uint64, C.c_uint32, C.c_void_p, C.c_size_t)
ValueVisitor = C.CFUNCTYPE(None, C.c_void_p, C.c_uint32, C.c_uint32, C.c_void_p, C.c_size_t)
Method = C.CFUNCTYPE(C.c_uint64, C.c_void_p, C.POINTER(Invocation), C.c_void_p, C.c_size_t, C.c_void_p, C.c_size_t, C.POINTER(C.c_size_t))
SequenceHandler = C.CFUNCTYPE(C.c_uint64, C.c_void_p, C.POINTER(Invocation), C.c_uint8, C.c_uint8, C.c_uint32, C.c_uint8)


Validate = C.CFUNCTYPE(C.c_uint64, C.c_void_p, C.POINTER(Invocation), C.c_void_p, C.c_size_t)
Complete = C.CFUNCTYPE(None, C.c_void_p, C.POINTER(Invocation), C.c_void_p)
CreateValidate = C.CFUNCTYPE(C.c_uint64, C.c_void_p, C.POINTER(Invocation), C.c_void_p, C.c_size_t)
Created = C.CFUNCTYPE(None, C.c_void_p, C.POINTER(Invocation), C.c_uint32, C.c_void_p, C.c_size_t)


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
            "client_context": ([pointer], C.c_uint32),
            "class": ([pointer, C.c_uint32, C.c_uint32, C.c_uint32, C.c_uint32], integer),
            "sequences": ([pointer, SequenceHandler, pointer], integer),
            "client_begin_application": ([pointer, C.c_uint8, C.c_uint32], integer),
            "method": ([pointer, C.c_uint32, C.c_uint32, Method, pointer], integer),
            "link": ([pointer, C.c_uint32, C.c_uint32, C.POINTER(C.c_uint32), size], integer),
            "invoke_result_visit": ([pointer, size, ValueVisitor, pointer], integer),
            "objects_visit": ([pointer, size, ObjectVisitor, pointer], integer),
            "notification_visit": ([pointer, size, EventVisitor, pointer], integer),
            "notification_info": ([pointer, size, C.POINTER(NotificationInfo)], integer),
            "filters_encode": ([C.POINTER(Filter), size, pointer, size], C.c_ssize_t),
            "client_explore": ([pointer, C.c_uint32, C.POINTER(ExploreOptions), pointer, size, C.POINTER(C.c_uint32)], C.c_ssize_t),
            "client_get_link": ([pointer, C.c_uint32, C.c_uint32, C.POINTER(C.c_uint32), size], C.c_ssize_t),
            "client_invoke": ([pointer, C.c_uint32, C.c_uint32, pointer, size, pointer, size], C.c_ssize_t),
            "client_begin_best_effort": ([pointer], integer),
            "client_subscribe": ([pointer, C.POINTER(Reference), size, C.c_uint32, C.c_int16, C.POINTER(C.c_uint32)], integer),
            "client_create": ([pointer, C.c_uint32, pointer, size, C.POINTER(C.c_uint32), size], C.c_ssize_t),
            "client_delete": ([pointer, C.c_uint32], integer),
            "client_notification": ([pointer, pointer, size, C.c_uint8], C.c_ssize_t),
            "events": ([pointer], integer),
            "event": ([pointer, C.c_uint32, C.c_uint16, pointer, size], integer),
            "factory": ([pointer, C.c_uint32, CreateValidate, Created, pointer], integer),
            "template": ([pointer, C.c_uint32], integer),
            "value_size": ([pointer, size], C.c_ssize_t),
            "client_status": ([pointer], C.c_uint64),
            "client_read": ([pointer, C.c_uint32, C.c_uint32, pointer, size], C.c_ssize_t),
            "client_read_path": ([pointer, C.c_uint32, C.POINTER(C.c_uint32), size, pointer, size], C.c_ssize_t),
            "client_write_path": ([pointer, C.c_uint32, C.POINTER(C.c_uint32), size, pointer, size], integer),
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

    def objects(self, raw):
        roots, stack = [], []
        @ObjectVisitor
        def visit(user, item):
            item = item.contents
            if item.kind == 1:
                node = dict(rid=item.rid, class_id=item.class_id, class_flags=item.class_flags,
                    aid=item.aid, attributes={}, relations={}, children=[])
                (stack[-1]["children"] if stack else roots).append(node)
                stack.append(node)
            elif item.kind == 2:
                stack.pop()
            elif item.kind == 3:
                stack[-1]["attributes"][item.aid] = C.string_at(item.data, item.length)
            elif item.kind == 4:
                stack[-1]["relations"].setdefault(item.aid, []).append(item.target)
        self.check(self.dll.zomsp_objects_visit(raw, len(raw), visit, None))
        return roots

    def notification(self, raw):
        info = NotificationInfo()
        self.check(self.dll.zomsp_notification_info(raw, len(raw), C.byref(info)))
        records = []
        @EventVisitor
        def visit(user, subscription, sequence, kind, reference, status, flags, data, length):
            payload = C.string_at(data, length)
            records.append(dict(kind="value" if kind == 1 else "object", reference=reference,
                status=status, flags=flags, raw=payload))
        self.check(self.dll.zomsp_notification_visit(raw, len(raw), visit, None))
        for record in records:
            if record["kind"] == "object":
                record["objects"] = self.objects(record["raw"])
        return dict(subscription=info.subscription, sequence=info.sequence, missed=info.missed,
            credit=info.credit, phase=info.phase, status=info.status, timestamp=info.timestamp, records=records)

    def filters(self, definitions):
        entries, buffers = (Filter * len(definitions))(), []
        for index, (operation, address, raw) in enumerate(definitions):
            if len(address) > 4:
                raise ValueError("filter address limit")
            buffer = C.create_string_buffer(raw)
            buffers.append(buffer)
            entries[index] = Filter(operation, len(address), (C.c_uint32 * 4)(*address), C.cast(buffer, C.c_void_p), len(raw))
        output = C.create_string_buffer(8192)
        count = self.check(self.dll.zomsp_filters_encode(entries, len(entries), output, len(output)))
        return output.raw[:count]


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
        self.classes, self.templates = {}, {}
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

    def events(self):
        self.library.check(self.dll.zomsp_events(self.handle))

    def event(self, subsystem, domain, encoded_object):
        self._call(lambda: self.dll.zomsp_event(self.handle, subsystem, domain, encoded_object, len(encoded_object)))

    def factory(self, class_id, defaults, on_create, validate=None):
        prototype = 0x50000000 + class_id
        self.library.check(self.dll.zomsp_object(self.handle, prototype, 201, class_id))
        for aid, raw in defaults.items():
            self.library.check(self.dll.zomsp_set(self.handle, prototype, aid, raw, len(raw), 0))
        self.library.check(self.dll.zomsp_template(self.handle, prototype))
        self.templates[class_id] = prototype

        @CreateValidate
        def check(user, call, data, length):
            try:
                return validate(call.contents.target, C.string_at(data, length)) if validate else 0
            except Exception as error:
                self._error(error)
                return 0x8020ab00199afff4

        @Created
        def created(user, call, rid, data, length):
            try:
                on_create(rid, C.string_at(data, length))
            except Exception as error:
                self._error(error)

        self.callbacks.extend([check, created])
        self.library.check(self.dll.zomsp_factory(self.handle, class_id, check, created, None))

    def set_raw(self, rid, aid, raw, writable=False):
        self._call(lambda: self.dll.zomsp_set(self.handle, rid, aid, raw, len(raw), writable))

    def class_(self, id, base=0, flags=0, composition=0):
        self.library.check(self.dll.zomsp_class(self.handle, id, base, flags, composition))
        self.classes[id] = (base, flags, composition)

    def link(self, rid, aid, targets):
        values = (C.c_uint32 * len(targets))(*targets)
        self._call(lambda: self.dll.zomsp_link(self.handle, rid, aid, values, len(values)))

    def method(self, rid, method_id, handler):
        @Method
        def invoke(user, call, arguments, length, output, capacity, output_length):
            output_length[0] = 0
            try:
                status, result = handler(call.contents, C.string_at(arguments, length))
                if status & (1 << 63):
                    return status
                if len(result) > capacity:
                    raise ValueError("Invoke result exceeds bound")
                C.memmove(output, result, len(result))
                output_length[0] = len(result)
                return status
            except Exception as error:
                self._error(error)
                return 0x8020ab00199afff4
        self.callbacks.append(invoke)
        self.library.check(self.dll.zomsp_method(self.handle, rid, method_id, invoke, None))

    def sequences(self, handler):
        @SequenceHandler
        def execute(user, call, kind, phase, parameter, abort):
            try:
                return handler(call.contents, kind, phase, parameter, bool(abort))
            except Exception as error:
                self._error(error)
                return 0x8020ab00199afff4
        self.callbacks.append(execute)
        self.library.check(self.dll.zomsp_sequences(self.handle, execute, None))

    def template(self, id, fields, rid=None):
        rid = rid or 0x50000000 + id
        self.library.check(self.dll.zomsp_object(self.handle, rid, 201, id))
        for aid, value in fields.items():
            self.set_raw(rid, aid, value, writable=True)
        self.library.check(self.dll.zomsp_template(self.handle, rid))
        self.templates[id] = rid
        return rid

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

    @property
    def context(self):
        return self.dll.zomsp_client_context(self.handle)

    def create(self, parent, descriptor):
        assigned = (C.c_uint32 * 8)()
        count = self._check(self.dll.zomsp_client_create(self.handle, parent, descriptor, len(descriptor), assigned, 8))
        return list(assigned[:count])

    def delete(self, rid):
        self._check(self.dll.zomsp_client_delete(self.handle, rid))

    def notification(self, wait=False):
        output = C.create_string_buffer(65535)
        length = self._check(self.dll.zomsp_client_notification(self.handle, output, len(output), wait))
        return output.raw[:length] if length else None

    def next_event(self, wait=True):
        raw = self.notification(wait)
        return self.library.notification(raw) if raw else None

    def subscribe(self, addresses, cycle_ms=0, credits=-1):
        entries = (Reference * len(addresses))()
        for index, address in enumerate(addresses):
            rid, aid, *path = address
            if len(path) > 3:
                raise ValueError("reference path limit")
            entries[index] = Reference(index + 1, rid, aid, len(path), (C.c_uint32 * 3)(*path), 0)
        rid = C.c_uint32()
        self._check(self.dll.zomsp_client_subscribe(self.handle, entries, len(entries), cycle_ms, credits, C.byref(rid)))
        return Subscription(self, rid.value)

    def explore(self, rid=None, recursive=True, recursive_filter=True, with_parent=False, aids=(), filters=()):
        raw_filters = self.library.filters(filters)
        filter_buffer = C.create_string_buffer(raw_filters)
        fields = (C.c_uint32 * len(aids))(*aids)
        options = ExploreOptions(int(recursive) | (int(recursive_filter) << 1) | (int(with_parent) << 2),
            0, fields, len(fields), C.cast(filter_buffer, C.c_void_p), len(raw_filters))
        parent, output = C.c_uint32(), C.create_string_buffer(65535)
        length = self._check(self.dll.zomsp_client_explore(self.handle, rid or self.root, C.byref(options), output, len(output), C.byref(parent)))
        return dict(parent=parent.value, objects=self.library.objects(output.raw[:length]), raw=output.raw[:length])

    def get_link(self, rid, aid):
        targets = (C.c_uint32 * 16)()
        count = self._check(self.dll.zomsp_client_get_link(self.handle, rid, aid, targets, len(targets)))
        return list(targets[:count])

    def invoke_raw(self, rid, method, arguments=b"\0\0"):
        output = C.create_string_buffer(8192)
        count = self._check(self.dll.zomsp_client_invoke(self.handle, rid, method, arguments, len(arguments), output, len(output)))
        return output.raw[:count]

    def invoke(self, rid, method, inputs=None, inout=None):
        def arguments(values):
            return b"".join(vlq(index) + encode(value) for index, value in (values or {}).items()) + b"\0"
        raw = self.invoke_raw(rid, method, arguments(inputs) + arguments(inout))
        result = dict(value=None, outputs={}, inout={})
        @ValueVisitor
        def visit(user, section, index, data, length):
            value = C.string_at(data, length)
            try:
                value = decode(value)
            except ValueError:
                pass
            if section == 0:
                result["value"] = value
            else:
                result["outputs" if section == 1 else "inout"][index] = value
        self.library.check(self.dll.zomsp_invoke_result_visit(raw, len(raw), visit, None))
        return result

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

    def read_path(self, rid, path):
        fields = (C.c_uint32 * len(path))(*path)
        output = C.create_string_buffer(65535)
        count = self._check(self.dll.zomsp_client_read_path(self.handle, rid, fields, len(fields), output, len(output)))
        return output.raw[:count]

    def write_path(self, rid, path, value):
        fields = (C.c_uint32 * len(path))(*path)
        raw = encode(value)
        self._check(self.dll.zomsp_client_write_path(self.handle, rid, fields, len(fields), raw, len(raw)))

    def write(self, name, value, aid=42):
        rid = self.resolve(name) if isinstance(name, str) else name
        raw = encode(value)
        self.write_raw(rid, aid, raw)

    def write_raw(self, rid, aid, raw):
        self._check(self.dll.zomsp_client_write(self.handle, rid, aid, raw, len(raw)))

    def begin(self, best_effort=False):
        function = self.dll.zomsp_client_begin_best_effort if best_effort else self.dll.zomsp_client_begin
        self._check(function(self.handle))

    def begin_application(self, kind, parameter):
        self._check(self.dll.zomsp_client_begin_application(self.handle, kind, parameter))

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


class Subscription:
    def __init__(self, client, rid):
        self.client, self.rid = client, rid

    def disabled(self, value=True):
        self.client.write(self.rid, bool(value), 1051)

    def credits(self, limit):
        self.client.write_raw(self.rid, 1053, b"\0\x07" + struct.pack(">h", limit))

    def close(self):
        if self.rid:
            self.client.delete(self.rid)
            self.rid = 0

    def __enter__(self):
        return self

    def __exit__(self, *exception):
        self.close()
