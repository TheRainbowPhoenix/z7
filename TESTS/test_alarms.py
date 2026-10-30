"""Raw-wire ALARM_8 integration tests; no third-party dependencies.

Usage: python TESTS/test_alarms.py /absolute/path/to/z7.dll-or-libz7.so
Runs the native library in a bounded child process.
"""
import ctypes
import os
import pathlib
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time

from test_shared_library import receive, job


def userdata(subfunction, payload, sequence=7, params=None, declared_length=None):
    if params is None:
        params = bytes([0, 1, 0x12, 4, 0x11, 0x44, subfunction, sequence])
    data = bytes([0xFF, 9]) + struct.pack(
        ">H", len(payload) if declared_length is None else declared_length
    ) + payload
    s7 = struct.pack(">BBHHHH", 0x32, 7, 0, 3, len(params), len(data)) + params + data
    return bytes.fromhex("0300") + struct.pack(">H", len(s7) + 7) + bytes.fromhex("02f080") + s7


def decode(packet):
    assert packet[:2] == bytes.fromhex("0300")
    assert len(packet) == int.from_bytes(packet[2:4], "big")
    assert packet[4:7] == bytes.fromhex("02f080")
    assert packet[7:9] == bytes.fromhex("3207")
    paramlen, datalen = struct.unpack(">HH", packet[13:17])
    assert paramlen == 12 and datalen >= 4 and len(packet) == 17 + paramlen + datalen
    params, data = packet[17:29], packet[29:]
    assert params[:5] == bytes.fromhex("0001120812")
    assert data[2:4] == struct.pack(">H", len(data) - 4)
    return dict(
        group=params[5], sub=params[6], sequence=params[7],
        error=int.from_bytes(params[10:12], "big"), payload=data[4:],
    )


def response(sock, subfunction, payload, **kwargs):
    sock.sendall(userdata(subfunction, payload, **kwargs))
    result = decode(receive(sock))
    assert result["group"] == 0x84 and result["sub"] == subfunction, result
    return result


def subscribe(sock, enabled=True):
    payload = bytes([0x80, 0]) + b"Z7TEST  " + bytes([5 if enabled else 4, 0])
    result = response(sock, 2, payload)
    assert result["error"] == 0 and result["payload"] == bytes([0, 0, payload[10], 0, 0]), result


def indication(sock, expected_id, state, changed=None, acknowledgement=False):
    result = decode(receive(sock))
    assert result["group"] == 4 and result["sub"] == (0x0C if acknowledgement else 5), result
    payload = result["payload"]
    assert payload[8:10] == bytes([0, 1])
    assert payload[10:14] == bytes([0x12, 8 if acknowledgement else 10, 0x19 if acknowledgement else 0x16, 0])
    assert int.from_bytes(payload[14:18], "big") == expected_id
    if not acknowledgement:
        assert payload[18] == state
        if changed is not None:
            assert payload[19] == changed
    return payload


def query(sock, event_id=None):
    payload = bytes.fromhex("000112081a00") + bytes([1 if event_id is None else 3, 0])
    payload += struct.pack(">I", 2 if event_id is None else event_id)
    return response(sock, 0x13, payload)


def acknowledge(sock, event_id, going=0, coming=0):
    payload = bytes.fromhex("000112081900") + struct.pack(">I", event_id) + bytes([going, coming])
    result = response(sock, 0x0B, payload)
    assert result["error"] == 0, result
    return result["payload"]


def worker(library):
    if os.name == "nt":
        ctypes.windll.kernel32.SetErrorMode(0x0001 | 0x0002)  # No modal crash dialogs in a test.
    lib = ctypes.CDLL(str(pathlib.Path(library).resolve()))
    lib.z7_init.argtypes = [ctypes.c_uint16, ctypes.c_char_p]
    lib.z7_init.restype = ctypes.c_void_p
    for name in ("z7_start", "z7_stop", "z7_deinit"):
        getattr(lib, name).argtypes = [ctypes.c_void_p]
    lib.z7_alarm_set.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint8]
    lib.z7_alarm_set.restype = ctypes.c_int32
    with tempfile.TemporaryDirectory(prefix="z7-alarms-") as directory:
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            port = reservation.getsockname()[1]
        ctx = lib.z7_init(port, str(pathlib.Path(directory) / "memory").encode())
        assert ctx
        sockets = []
        def connect(pdu=960, fragmented=False):
            sock = socket.create_connection(("127.0.0.1", port), 2)
            sock.settimeout(2)
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            sockets.append(sock)
            cr = bytes.fromhex("0300001611e00000003a00c1020600c2020600c0010a")
            if fragmented:
                for byte in cr:
                    sock.sendall(bytes([byte]))
                    time.sleep(0.001)
            else:
                sock.sendall(cr)
            assert receive(sock)[5] == 0xD0
            sock.sendall(job(bytes.fromhex("f00000010001") + struct.pack(">H", pdu)))
            assert int.from_bytes(receive(sock)[-2:], "big") == pdu
            return sock
        def set_alarm(event_id, signals):
            assert lib.z7_alarm_set(ctx, event_id, signals) == 0
        def quiet(sock):
            sock.settimeout(0.06)
            try:
                data = sock.recv(1)
                raise AssertionError(f"unexpected data/EOF: {data.hex()}")
            except socket.timeout:
                pass
            finally:
                sock.settimeout(2)
        try:
            lib.z7_start(ctx)
            a, b, c = connect(fragmented=True), connect(), connect(pdu=240)
            assert lib.z7_alarm_set(None, 1, 1) == -1
            assert lib.z7_alarm_set(ctx, 0, 1) == -1
            set_alarm(42, 1)  # Exists before subscription: queryable, not replayed.
            subscribe(a)
            subscribe(b)
            quiet(a)
            assert query(c, 42)["payload"][6 + 4:6 + 8] == struct.pack(">I", 42)
            set_alarm(100, 3)
            indication(a, 100, 3, 3)
            indication(b, 100, 3, 3)
            quiet(c)
            set_alarm(100, 3)
            quiet(a)
            assert acknowledge(c, 100, coming=3) == bytes.fromhex("0001ff")
            indication(a, 100, 0, acknowledgement=True)
            indication(b, 100, 0, acknowledgement=True)
            set_alarm(100, 0)
            indication(a, 100, 0, 3)
            indication(b, 100, 0, 3)
            assert acknowledge(c, 100, going=3) == bytes.fromhex("0001ff")
            indication(a, 100, 0, acknowledgement=True)
            indication(b, 100, 0, acknowledgement=True)
            assert query(c, 100)["payload"] == bytes.fromhex("00010a000000")
            assert acknowledge(c, 9999, coming=1) == bytes.fromhex("00010a")
            subscribe(a, False)
            set_alarm(42, 0)
            indication(b, 42, 0, 1)
            quiet(a)
            subscribe(b, False)
            print("PASS: two subscribers, duplicate suppression, coming/going, ACK, query, unsubscribe", flush=True)

            valid_subscription = bytes([0x80, 0]) + b"Z7TEST  " + bytes([5, 0])
            for length in range(12):
                assert response(c, 2, valid_subscription[:length])["error"] != 0
            assert response(c, 2, valid_subscription, declared_length=65535)["error"] != 0
            bad_params = bytes.fromhex("0001120411840207")  # Response type masquerading as a request.
            assert response(c, 2, valid_subscription, params=bad_params)["error"] != 0
            assert response(c, 2, valid_subscription + b"extra")["error"] != 0
            for sub in (7, 8, 0x13, 0x0B):
                assert response(c, sub, b"")["error"] != 0
            malformed_ack = bytes.fromhex("0002120819000000002a0101")  # Count 2, only one object.
            assert response(c, 0x0B, malformed_ack)["error"] != 0
            assert query(c, 42)["error"] == 0
            c.sendall(job(bytes.fromhex("0401120a10020001000084000000")))
            assert receive(c)[-1:] == b"\x00"  # Byte reads still work.
            # Reads larger than the negotiated PDU must fail without overflowing a buffer.
            c.sendall(job(bytes.fromhex("0401120a1002ffff000084000000")))
            assert receive(c)[21] != 0xFF
            # Both the body and header may arrive over multiple TCP receives.
            fragmented_query = userdata(0x13, bytes.fromhex("000112081a0003000000002a"))
            for byte in fragmented_query:
                c.sendall(bytes([byte]))
                time.sleep(0.001)
            assert decode(receive(c))["error"] == 0
            print("PASS: malformed lengths/types/counts, unsupported services, ordinary byte read", flush=True)

            set_alarm(42, 0)
            subscribe(a)
            failures = []
            def produce():
                try:
                    for index in range(50):
                        set_alarm(42, (index + 1) % 2)
                        time.sleep(0.002)
                except BaseException as error:
                    failures.append(error)
            producer = threading.Thread(target=produce)
            producer.start()
            for index in range(50):
                indication(a, 42, (index + 1) % 2, 1)
                assert query(c, 42)["error"] == 0
            producer.join(timeout=2)
            assert not producer.is_alive() and not failures
            subscribe(a, False)
            print("PASS: concurrent producer, ordered event delivery, independent queries", flush=True)

            for event_id in range(1000, 1062):
                set_alarm(event_id, 1)
            assert lib.z7_alarm_set(ctx, 2000, 1) == -2
            assert query(c)["error"] == 0x8301  # Snapshot exceeds negotiated 240-byte PDU.
            large = query(a)
            assert large["error"] == 0 and len(large["payload"]) <= 934
            assert query(c, 1000)["error"] == 0
            print("PASS: fixed alarm capacity and negotiated PDU limits", flush=True)

            subscribe(a)
            for index in range(1000):
                set_alarm(42, index % 2)
            # At most a bounded queue of indications may precede the lag disconnect.
            for _ in range(8):
                try:
                    receive(a)
                except (EOFError, ConnectionResetError):
                    break
            else:
                raise AssertionError("lagged subscription was not disconnected")
            assert query(c, 42)["error"] == 0
            replacement = connect()
            quiet(replacement)
            assert query(replacement, 42)["error"] == 0
            print("PASS: lag detection, unaffected peers, connection reuse", flush=True)
        finally:
            for sock in sockets:
                sock.close()
            lib.z7_deinit(ctx)
    print("ALARM_8 integration: PASS", flush=True)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--worker":
        worker(sys.argv[2])
    elif len(sys.argv) == 2:
        result = subprocess.run([sys.executable, __file__, "--worker", sys.argv[1]], timeout=30)
        raise SystemExit(result.returncode)
    else:
        raise SystemExit(f"Usage: {sys.argv[0]} /path/to/z7.dll-or-libz7.so")
