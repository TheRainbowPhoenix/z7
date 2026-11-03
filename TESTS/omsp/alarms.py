"""Typed DAI delivery and host AckJob execution through the actual Zig C client."""
import argparse
import json
from pathlib import Path
import struct
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "examples/zomsp"))
from zomsp import Client, Library, Server, encode
from alarm import AlarmHost, REJECTED, Reader, ack_value, notification, pobject, run, subscribe


def check(library, tls_library, credentials):
    library = Library(library)
    tls_library = str(Path(tls_library).resolve())
    credentials = Path(credentials).resolve()
    run(library, tls_library, credentials)
    certificate = credentials / "server-cert.pem"
    key = credentials / "server-key.pem"
    fixture = json.loads(Path(__file__).with_name("alarm_capture.json").read_text())
    captured = bytes.fromhex(fixture["frame"])
    captured_notification = notification(captured, library)
    assert captured_notification[0] == fixture["sequence"] == 498
    reader = Reader(captured[9:], library)
    reader.take(1)
    reader.vlq()
    reader.take(5)
    reader.vlq()
    reader.take(9)
    assert reader.take(1) == b"\0"
    reader.take(4)
    reader.vlq()
    reader.vlq()
    assert reader.take(1) == b"\x81"
    start = reader.offset
    reader.object()
    captured_object = reader.raw[start:reader.offset]
    alarm_id = 0x100000001
    with tempfile.TemporaryDirectory() as folder, Server(Path(folder) / "alarm.shm", library) as server:
        host = AlarmHost(server, {(0, alarm_id): 0})
        try:
            port = server.start(certificate, key, tls_library)
            with Client("127.0.0.1", port, certificate, tls_library, library) as client:
                subscription, reference = subscribe(client, credits=2)
                assert notification(client.notification(wait=True), library)[2] == []
                host.raise_alarm(0, alarm_id, 3)
                event = notification(client.notification(wait=True), library)
                assert event[2][0][0] == reference and event[2][0][3][1] == 2681
                assert event[2][0][3][2][2670] == b"\0\x0d" + struct.pack(">Q", alarm_id)
                host.raise_alarm(1, alarm_id, 7)
                host.raise_alarm(0, alarm_id, 1)
                client.read(client.session, 299)
                assert client.notification() is None, "credit exhausted reader received an event"
                client.write_raw(subscription, 1053, b"\0\x07\0\x04")
                event = notification(client.notification(wait=True), library)
                assert event[2][0][3][2][2671] == b"\0\x02\x01", "domain filtering/cursor resume"
                client.write_raw(subscription, 1053, b"\0\x07\xff\xff")
                client.write(subscription, True, 1051)
                host.raise_alarm(0, alarm_id, 3)
                client.read(client.session, 299)
                assert client.notification() is None
                client.write(subscription, False, 1051)
                assert notification(client.notification(wait=True), library)[2][0][3][2][2671] == b"\0\x02\x03"
                before = dict(host.states)
                for requests in ([(0, 999, 1)], [(0, alarm_id, 1), (0, alarm_id, 1)]):
                    try:
                        client.create(8, pobject(3636, {3647: ack_value(requests)}))
                    except RuntimeError as error:
                        assert "%016x" % REJECTED in str(error), error
                    else:
                        raise AssertionError("invalid AckJob accepted")
                    assert host.states == before
                    assert client.read(client.session, 299) == 2, "native-status rejection broke session"
                jobs = []
                for repeat in range(2):
                    job, = client.create(8, pobject(3636, {3647: ack_value([(0, alarm_id, 1)]), 3639: encode("operator")}))
                    jobs.append(job)
                    if not repeat:
                        event = notification(client.notification(wait=True), library)
                        assert event[2][0][3][2][2671] == b"\0\x02\x02"
                    deadline = time.monotonic() + 2
                    while client.read_raw(job, 3641) != b"\0\x08\x02":
                        assert time.monotonic() < deadline
                        time.sleep(.005)
                assert client.notification() is None, "idempotent acknowledgement emitted a duplicate change"
                assert host.states[0, alarm_id] == 2
                for index in range(130):
                    host.raise_alarm(0, alarm_id, index & 255)
                    event = notification(client.notification(wait=True), library)
                    assert event[2][0][3][2][2671] == b"\0\x02" + bytes([index])
                assert event[0] >= 128, "VLQ notification sequence was truncated"
                with Client("127.0.0.1", port, certificate, tls_library, library) as other:
                    other_subscription, other_reference = subscribe(other, domain=1)
                    notification(other.notification(wait=True), library)
                    server.event(8, 1, captured_object)
                    raw = other.notification(wait=True)
                    forwarded = notification(raw, library)
                    assert forwarded[2][0][0] == other_reference
                    assert forwarded[2][0][3] == captured_notification[2][0][3]
                    assert captured_object in raw, "captured typed DAI bytes changed during forwarding"
                    assert server.dll.zomsp_event(server.handle, 8, 0, captured_object, len(captured_object)) < 0
                    assert server.dll.zomsp_event(server.handle, 8, 1, captured_object[:-1], len(captured_object) - 1) < 0
                    other.delete(other_subscription)
                # Let this reference skip the domain-1 event before measuring loss.
                host.raise_alarm(0, alarm_id, 0)
                notification(client.notification(wait=True), library)
                client.write(subscription, True, 1051)
                for index in range(70):
                    host.raise_alarm(0, alarm_id, index)
                client.write(subscription, False, 1051)
                first = notification(client.notification(wait=True), library)
                assert first[1] == 6, first
                for _ in range(63):
                    notification(client.notification(wait=True), library)
                client.delete(reference)
                host.raise_alarm(0, alarm_id, 42)
                client.read(client.session, 299)
                assert client.notification() is None
                for job in jobs:
                    client.delete(job)
                client.delete(subscription)
            assert not server.errors and not host.errors, (server.errors, host.errors)
            bad = pobject(213, {})
            assert server.dll.zomsp_event(server.handle, 8, 0, bad, len(bad)) < 0
            assert server.dll.zomsp_event(server.handle, 8, 0, b"x" * 2049, 2049) < 0
            assert server.dll.zomsp_events(server.handle) == -6, "configuration changed while runtime active"
        finally:
            host.close()
    print("Typed alarms: credit/disable/resume, domain filtering, rejection/recovery, AckJob execution/idempotency, VLQ sequences, journal overflow and deletion passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("library")
    parser.add_argument("--reference", required=True)
    parser.add_argument("--credentials", required=True)
    args = parser.parse_args()
    check(args.library, args.reference, args.credentials)
