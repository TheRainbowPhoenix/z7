"""Shared-library regression: run with Python and the path to z7.dll/libz7.so."""
import ctypes
import os
import pathlib
import socket
import struct
import subprocess
import sys
import tempfile
import time


def receive(sock):
    def exact(count):
        result = b""
        while len(result) < count:
            part = sock.recv(count - len(result))
            if not part:
                raise EOFError("server closed connection")
            result += part
        return result
    header = exact(4)
    return header + exact(int.from_bytes(header[2:4], "big") - 4)


def job(params, data=b""):
    payload = bytes.fromhex("02f080") + struct.pack(
        ">BBHHHH", 0x32, 1, 0, 1, len(params), len(data)
    ) + params + data
    return bytes.fromhex("0300") + struct.pack(">H", len(payload) + 4) + payload


def worker(library):
    if os.name == "nt":
        ctypes.windll.kernel32.SetErrorMode(0x0001 | 0x0002)
    lib = ctypes.CDLL(str(pathlib.Path(library).resolve()))
    lib.z7_init.argtypes = [ctypes.c_uint16, ctypes.c_char_p]
    lib.z7_init.restype = ctypes.c_void_p
    for name in ("z7_start", "z7_stop", "z7_deinit"):
        getattr(lib, name).argtypes = [ctypes.c_void_p]
    lib.z7_get_status.argtypes = [ctypes.c_void_p]
    lib.z7_get_status.restype = ctypes.c_uint8
    with tempfile.TemporaryDirectory(prefix="z7-library-test-") as directory:
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            port = reservation.getsockname()[1]
        ctx = lib.z7_init(port, str(pathlib.Path(directory) / "memory").encode())
        assert ctx, "initialization failed"
        try:
            for _ in range(10):
                lib.z7_start(ctx)
                lib.z7_stop(ctx)  # Exercise stop before the worker has entered its first poll.
                assert lib.z7_get_status(ctx) == 0
            for cycle in range(25):
                lib.z7_start(ctx)
                assert lib.z7_get_status(ctx) == 1, "worker failed to start"
                with socket.create_connection(("127.0.0.1", port), 2) as sock:
                    sock.settimeout(2)
                    sock.sendall(bytes.fromhex("0300001611e00000003a00c1020600c2020600c0010a"))
                    assert receive(sock)[5] == 0xD0
                    sock.sendall(job(bytes.fromhex("f0000001000103c0")))
                    receive(sock)
                    item = bytes.fromhex("120a10020004000084000000")
                    value = bytes([cycle, 0xBB, 0xCC, 0xDD])
                    sock.sendall(job(b"\x05\x01" + item, bytes.fromhex("00040020") + value))
                    assert receive(sock)[-1] == 0xFF
                    sock.sendall(job(b"\x04\x01" + item))
                    assert receive(sock)[-4:] == value
                    # Leave a client read pending while stopping the worker.
                    time.sleep(0.05)
                    lib.z7_stop(ctx)
                    assert lib.z7_get_status(ctx) == 0
                    try:
                        assert sock.recv(1) == b"", "active socket survived stop"
                    except ConnectionResetError:
                        pass  # Windows may reset a socket with a canceled read.
                print(f"cycle {cycle + 1}: PASS", flush=True)
        finally:
            lib.z7_deinit(ctx)
    print("shared-library lifecycle and S7 byte round-trip: PASS", flush=True)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--worker":
        worker(sys.argv[2])
    elif len(sys.argv) == 2:
        # A broken native library must fail this test rather than hang the test runner.
        result = subprocess.run(
            [sys.executable, __file__, "--worker", sys.argv[1]], timeout=20
        )
        raise SystemExit(result.returncode)
    else:
        raise SystemExit(f"Usage: {sys.argv[0]} /path/to/libz7.so")

