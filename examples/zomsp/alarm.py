"""Host-driven typed alarm/AckJob example. Alarm state bits belong to the host."""
import ctypes as C
from pathlib import Path
import queue
import struct
import tempfile
import threading
import time
from zomsp import Client, Library, Server, encode, vlq

REJECTED = 0x8020ab00199afff4


def pobject(class_id, attributes, rid=0x7fffc001, children=b"", relations=None):
    body = b"\xa1" + struct.pack(">I", rid) + vlq(class_id) + b"\0\0"
    for aid, value in attributes.items():
        body += b"\xa3" + vlq(aid) + value
    body += children
    for aid, target in (relations or {}).items():
        body += b"\xa4" + vlq(aid) + struct.pack(">I", target)
    return body + b"\xa2"


class Reader:
    def __init__(self, raw, library):
        self.raw, self.offset, self.dll = raw, 0, library.dll

    def take(self, size):
        if not 0 <= size <= len(self.raw) - self.offset:
            raise ValueError("truncated alarm data")
        data = self.raw[self.offset:self.offset + size]
        self.offset += size
        return data

    def vlq(self):
        value = 0
        for index in range(9):
            byte = self.take(1)[0]
            if index == 8:
                return value * 256 + byte
            value = value * 128 + (byte & 127)
            if byte < 128:
                return value
        raise ValueError("invalid VLQ")

    def value(self):
        raw = self.raw[self.offset:]
        length = self.dll.zomsp_value_size(raw, len(raw))
        if length < 2:
            raise ValueError("invalid PValue")
        return self.take(length)

    def object(self):
        if self.take(1) != b"\xa1":
            raise ValueError("missing object")
        rid, = struct.unpack(">I", self.take(4))
        class_id = self.vlq()
        if self.vlq() > 0xffffffff or self.vlq() > 0xffffffff:
            raise ValueError("object metadata overflow")
        fields = {}
        for _ in range(32):
            tag = self.take(1)
            if tag == b"\xa2":
                return rid, class_id, fields
            if tag != b"\xa3":
                raise ValueError("unsupported object field")
            aid = self.vlq()
            if aid in fields:
                raise ValueError("duplicate field")
            fields[aid] = self.value()
        raise ValueError("field limit")


def ack_value(acknowledgements):
    raw = b"\x40\x16"
    for index, (domain, alarm_id, states) in enumerate(acknowledgements, 1):
        raw += vlq(index) + b"\0\x17" + struct.pack(">I", 3651)
        for aid, value in {
            3648: b"\0\x03" + struct.pack(">H", domain),
            3649: b"\0\x02" + bytes([states]),
            3650: b"\0\x0d" + struct.pack(">Q", alarm_id),
        }.items():
            raw += vlq(aid) + value
        raw += b"\0"
    return raw + b"\0"


def acknowledgements(raw, library):
    reader = Reader(raw, library)
    if reader.take(2) != b"\x40\x16":
        raise ValueError("expected sparse Variant acknowledgements")
    result, indices = [], set()
    while True:
        index = reader.vlq()
        if not index:
            break
        if index in indices or len(result) == 16:
            raise ValueError("acknowledgement bound/duplicate")
        indices.add(index)
        if reader.take(6) != b"\0\x17" + struct.pack(">I", 3651):
            raise ValueError("expected AS_AlarmAcknfy")
        fields = {}
        for _ in range(4):
            aid = reader.vlq()
            if not aid:
                break
            if aid in fields:
                raise ValueError("duplicate acknowledgement field")
            fields[aid] = reader.value()
        else:
            raise ValueError("unterminated acknowledgement")
        if set(fields) != {3648, 3649, 3650}:
            raise ValueError("missing acknowledgement identity")
        if fields[3648][:2] != b"\0\x03" or fields[3649][:2] != b"\0\x02" or fields[3650][:2] != b"\0\x0d":
            raise ValueError("wrong acknowledgement types")
        result.append((struct.unpack(">H", fields[3648][2:])[0],
            struct.unpack(">Q", fields[3650][2:])[0], fields[3649][2]))
    if not result or reader.offset != len(raw) or len(set((d, a) for d, a, _ in result)) != len(result):
        raise ValueError("empty, duplicate or trailing acknowledgement")
    return result


def subscribe(client, subsystem=8, domain=0, credits=-1):
    reference = pobject(2662, {2659: b"\0\x03" + struct.pack(">H", domain)},
        rid=0x7fffc002, relations={2660: subsystem})
    descriptor = pobject(1001, {1049: encode(0), 1053: b"\0\x07" + struct.pack(">h", credits)}, children=reference)
    return client.create(client.context, descriptor)


def notification(raw, library):
    if raw[:2] != b"\x72\x02" or raw[4] != 0x33 or int.from_bytes(raw[2:4], "big") != len(raw) - 4:
        raise ValueError("invalid notification")
    reader = Reader(raw[9:], library)
    if reader.take(1) != b"\x04" or reader.vlq() != 0:
        raise ValueError("notification error")
    missed = int.from_bytes(reader.take(2), "big")
    reader.take(3)
    sequence = reader.vlq()
    reader.take(9)
    if reader.take(1) != b"\0":
        raise ValueError("expected typed event section")
    events = []
    while len(reader.raw) - reader.offset > 4:
        reference = int.from_bytes(reader.take(4), "big")
        status, flags = reader.vlq(), reader.vlq()
        if reader.take(1) != b"\x81":
            raise ValueError("unsupported event action")
        events.append((reference, status, flags, reader.object()))
    if reader.take(4) != b"\0" * 4:
        raise ValueError("invalid notification trailer")
    return sequence, missed, events


class AlarmHost:
    """Example policy: acknowledge requested bits by clearing them, idempotently.

    This bit policy is a demo, not a claim about a PLC's ASOM state bit meanings.
    The protocol backend forwards the typed values without choosing that policy.
    """
    def __init__(self, server, states, subsystem=8):
        self.server, self.states, self.subsystem = server, dict(states), subsystem
        self.lock = threading.Lock()
        self.jobs, self.errors = queue.Queue(maxsize=16), []
        server.library.check(server.dll.zomsp_object(server.handle, subsystem, 201, 2669))
        server.events()
        defaults = {aid: encode("") for aid in (3637, 3638, 3639)}
        defaults.update({3647: b"\x40\x16\0", 3641: b"\0\x08\0", 3642: b"\0\x10" + b"\0" * 8})
        server.factory(3636, defaults, self.created, self.validate)
        self.worker = threading.Thread(target=self.run)
        self.worker.start()

    def parse(self, raw):
        reader = Reader(raw, self.server.library)
        _, kind, fields = reader.object()
        if kind != 3636 or reader.offset != len(raw) or 3647 not in fields:
            raise ValueError("invalid AckJob")
        if set(fields) - {3647, 3637, 3638, 3639}:
            raise ValueError("unsupported AckJob field")
        for aid in (3637, 3638, 3639):
            if aid in fields and (fields[aid][:2] != b"\0\x15" or len(fields[aid]) > 132):
                raise ValueError("invalid AckJob metadata")
        return acknowledgements(fields[3647], self.server.library)

    def validate(self, parent, raw):
        if parent != self.subsystem or self.jobs.full():
            return REJECTED
        try:
            requests = self.parse(raw)
        except (ValueError, IndexError, struct.error):
            return REJECTED
        with self.lock:
            return 0 if all((domain, alarm) in self.states for domain, alarm, _ in requests) else REJECTED

    def created(self, rid, raw):
        self.jobs.put_nowait((rid, self.parse(raw)))

    def publish(self, domain, alarm_id, states):
        fields = {2670: b"\0\x0d" + struct.pack(">Q", alarm_id),
            2671: b"\0\x02" + bytes([states]), 2672: b"\0\x03" + struct.pack(">H", domain)}
        self.server.event(self.subsystem, domain, pobject(2681, fields, rid=alarm_id & 0xffffffff))

    def raise_alarm(self, domain, alarm_id, states):
        with self.lock:
            self.states[domain, alarm_id] = states
            self.publish(domain, alarm_id, states)

    def run(self):
        while True:
            job = self.jobs.get()
            if job is None:
                return
            rid, requests = job
            try:
                self.server.set_raw(rid, 3641, b"\0\x08\x01")
                with self.lock:
                    changed = []
                    for domain, alarm_id, requested in requests:
                        old = self.states[domain, alarm_id]
                        new = old & ~requested
                        self.states[domain, alarm_id] = new
                        if old != new:
                            changed.append((domain, alarm_id, new))
                    for entry in changed:
                        self.publish(*entry)
                # Distributing is the last verified enum, not an invented Completed.
                self.server.set_raw(rid, 3641, b"\0\x08\x02")
            except Exception as error:
                self.errors.append(error)

    def close(self):
        self.jobs.put(None, timeout=3)
        self.worker.join(timeout=3)
        if self.worker.is_alive() or self.errors:
            raise RuntimeError(self.errors or "alarm worker did not stop")


def run(library, tls_library, credentials):
    credentials = Path(credentials)
    with tempfile.TemporaryDirectory() as folder, Server(Path(folder) / "alarm.shm", library) as server:
        host = AlarmHost(server, {(0, 0x100000001): 0})
        try:
            port = server.start(credentials / "server-cert.pem", credentials / "server-key.pem", tls_library)
            with Client("127.0.0.1", port, credentials / "server-cert.pem", tls_library, library) as client:
                subscription, reference = subscribe(client)
                assert notification(client.notification(wait=True), library)[2] == []
                host.raise_alarm(0, 0x100000001, 3)
                raised = notification(client.notification(wait=True), library)
                assert raised[2][0][0] == reference
                descriptor = pobject(3636, {3647: ack_value([(0, 0x100000001, 1)]), 3639: encode("operator")})
                job, = client.create(8, descriptor)
                acknowledged = notification(client.notification(wait=True), library)
                assert acknowledged[2][0][3][2][2671] == b"\0\x02\x02"
                deadline = time.monotonic() + 2
                while client.read_raw(job, 3641) != b"\0\x08\x02":
                    assert time.monotonic() < deadline
                    time.sleep(.01)
                client.delete(job)
                client.delete(subscription)
                print("Typed DAI delivered; AckJob executed by host; updated DAI delivered; job/subscription deleted")
        finally:
            host.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library")
    parser.add_argument("--tls-library", required=True)
    parser.add_argument("--credentials", required=True)
    args = parser.parse_args()
    run(Library(args.library), args.tls_library, args.credentials)
