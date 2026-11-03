"""V2 shared-library discovery, inheritance, Invoke and subscription lifecycle."""
import argparse
import ctypes as C
import json
from pathlib import Path
import sys
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "examples/zomsp"))
from zomsp import Client, Library, Server, ObjectVisitor, EventVisitor, ValueVisitor, encode
from alarm import pobject


def flatten(objects):
    return [node for parent in objects for node in [parent, *flatten(parent["children"])]]


def check(library, reference, credentials):
    library = Library(library)
    reference = str(Path(reference).resolve())
    credentials = Path(credentials).resolve()
    fixture = json.loads(Path(__file__).with_name("alarm_capture.json").read_text())
    captured = bytes.fromhex(fixture["frame"])
    parsed = library.notification(captured)
    assert parsed["sequence"] == 498 and parsed["records"][0]["objects"][0]["class_flags"] == 65536
    # No host callback may see partial input when a later field is malformed.
    seen = []
    object_callback = ObjectVisitor(lambda user, item: seen.append(item.contents.kind))
    event_callback = EventVisitor(lambda *arguments: seen.append("event"))
    value_callback = ValueVisitor(lambda *arguments: seen.append("value"))
    malformed_inputs = (
        (library.dll.zomsp_objects_visit, pobject(9000, {42: encode(1)}) + b"\xa1", object_callback),
        (library.dll.zomsp_notification_visit, captured[:-1], event_callback),
        (library.dll.zomsp_invoke_result_visit, encode(42) + b"\0\x01", value_callback),
    )
    for visitor, raw, callback in malformed_inputs:
        data = C.create_string_buffer(raw)
        assert visitor(data, len(raw), callback, None) < 0
        assert not seen, "partial unvalidated input reached host callback"
    for malformed in (captured[:-1], captured[:-1] + b"\x01"):
        try:
            library.notification(malformed)
        except RuntimeError:
            pass
        else:
            raise AssertionError("invalid notification accepted")
    with tempfile.TemporaryDirectory() as directory, Server(Path(directory) / "model.shm", library) as server:
        server.class_(9000)
        server.class_(9001, 9000)
        server.class_(9002, 9001, flags=65536, composition=77)
        for arguments in ((9002, 9000), (9003, 99999), (9003, 9003)):
            try:
                server.class_(*arguments)
            except RuntimeError:
                pass
            else:
                raise AssertionError("invalid class graph accepted")
        server.template(9001, {233: encode("Base"), 42: encode(10)})
        server.template(9002, {233: encode("Derived"), 42: encode(30), 43: encode(20)})
        server.library.check(server.dll.zomsp_object(server.handle, 2000, 201, 9002))
        server.set_raw(2000, 42, encode(7), writable=True)
        server.set_raw(2000, 44, b"\0\x17" + (9004).to_bytes(4, "big") + b"\x4d" + encode(7) + b"\0", writable=True)
        server.link(201, 2699, [2000])
        mode = ["success"]
        calls = []

        def handler(call, raw):
            calls.append((call.target, call.method, raw))
            if mode[0] == "error":
                return 0xa03388000088ffe0, b""
            assert raw == b"\x01" + encode(5) + b"\0\x01" + encode(7) + b"\0"
            return 0, encode(42) + b"\x01" + encode(6) + b"\0\x01" + encode(8) + b"\0"

        server.method(2000, 12345, handler)
        sequence_calls, end_rejected, cancelled = [], [False], threading.Event()
        def sequence_handler(call, kind, phase, parameter, abort):
            sequence_calls.append((kind, phase, parameter, abort))
            if phase == 2:
                cancelled.set()
                return 0
            if parameter != 2000 or (phase == 1 and end_rejected[0] and not abort):
                return 0x8020ab00199afff4
            return 0
        server.sequences(sequence_handler)
        server.library.check(server.dll.zomsp_transactions(server.handle, 1))
        port = server.start(credentials / "server-cert.pem", credentials / "server-key.pem", reference)
        with Client("127.0.0.1", port, credentials / "server-cert.pem", reference, library) as client:
            assert client.get_link(201, 2699) == [2000]
            try:
                client.get_link(201, 98765)
            except RuntimeError as error:
                assert "error -9" in str(error), error
            else:
                raise AssertionError("unknown link accepted")
            assert client.read(2000) == 7
            assert client.read_path(2000, [44, 77]) == encode(7)
            client.write_path(2000, [44, 77], 11)
            assert client.read_path(2000, [44, 77]) == encode(11)
            created, = client.create(201, pobject(9002, {233: encode("Instance")}))
            assert client.read(created, 42) == 30 and client.read(created, 43) == 20
            objects = flatten(client.explore(filters=[(8, [], b"\0\x12" + (9001).to_bytes(4, "big"))])["objects"])
            assert {node["rid"] for node in objects} == {2000, created}
            instance = next(node for node in objects if node["rid"] == created)
            assert (instance["class_id"], instance["class_flags"], instance["aid"]) == (9002, 65536, 77)
            selected = client.explore(created, with_parent=True, aids=[233], filters=[(1, [233], encode("Instance"))])
            nodes = flatten(selected["objects"])
            assert [node["rid"] for node in nodes] == [201, created]
            assert set(nodes[-1]["attributes"]) == {233}
            assert client.explore(created, with_parent=True, filters=[(1, [233], encode("Absent"))])["objects"] == []
            actual = client.invoke(2000, 12345, {1: 5}, {1: 7})
            assert actual == dict(value=42, outputs={1: 6}, inout={1: 8}), actual
            mode[0] = "error"
            try:
                client.invoke(2000, 12345)
            except RuntimeError as error:
                assert "a03388000088ffe0" in str(error), error
            else:
                raise AssertionError("Invoke error lost")
            assert client.read(2000) == 7
            with client.subscribe([(2000, 42)], credits=2) as subscription:
                assert client.next_event()["records"] == []
                event = client.next_event()
                assert event["records"][0]["raw"] == encode(7)
                subscription.disabled()
                server.set_raw(2000, 42, encode(9), writable=True)
                client.read(client.session, 299)
                assert client.next_event(wait=False) is None
                subscription.credits(4)
                subscription.disabled(False)
                event = client.next_event()
                assert event["records"][0]["raw"] == encode(9)
            client.begin(best_effort=True)
            upload = client.explore(201, filters=[(11, [], b"\0\0")])
            assert created in [node["rid"] for node in flatten(upload["objects"])]
            client.end()
            for kind in (3, 4, 5):
                client.begin_application(kind, 2000)
                client.end()
            try:
                client.begin_application(3, 999)
            except RuntimeError as error:
                assert "8020ab00199afff4" in str(error), error
            else:
                raise AssertionError("application sequence rejection lost")
            client.begin_application(3, 2000)
            end_rejected[0] = True
            try:
                client.end()
            except RuntimeError as error:
                assert "8020ab00199afff4" in str(error), error
            else:
                raise AssertionError("end rejection lost")
            client.end(abort=True)
            end_rejected[0] = False
            client.begin()
            client.begin_application(3, 2000)
            client.write(created, 99)
            client.end()
            assert client.read(created) == 99
            client.end(abort=True)
            assert client.read(created) == 30
            client.delete(created)
            client.begin_application(5, 2000)
        assert cancelled.wait(2), "application sequence resources not released on disconnect"
        assert (3, 1, 2000, True) in sequence_calls
        assert not server.errors, server.errors
        assert len(calls) == 2
    print("V2 FFI: inherited defaults/InstanceOf, metadata, filtered ancestors, GetLink, typed Invoke/error recovery, subscriptions and best-effort/collective sequences passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("library")
    parser.add_argument("--reference", required=True)
    parser.add_argument("--credentials", required=True)
    args = parser.parse_args()
    check(args.library, args.reference, args.credentials)
