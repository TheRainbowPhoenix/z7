"""Contested writes must not block readers, accept, timeout or server shutdown."""
import ctypes
import os
from pathlib import Path
import select
import socket
import subprocess
import sys
import tempfile
import time
from file_lock import FileLock
from test_shared_library import job, receive


def worker(library):
    if os.name == "nt":
        ctypes.windll.kernel32.SetErrorMode(0x0001 | 0x0002)
    lib = ctypes.CDLL(str(Path(library).resolve()))
    lib.z7_init.argtypes = [ctypes.c_uint16, ctypes.c_char_p]
    lib.z7_init.restype = ctypes.c_void_p
    for name in ("z7_start", "z7_stop", "z7_deinit"):
        getattr(lib, name).argtypes = [ctypes.c_void_p]
        getattr(lib, name).restype = None
    lib.z7_set_log_level.argtypes = [ctypes.c_uint8]
    lib.z7_set_log_level(0)
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]

    def connect():
        sock = socket.create_connection(("127.0.0.1", port), 2)
        sock.settimeout(3)
        sock.sendall(bytes.fromhex("0300001611e00000003a00c1020600c2020600c0010a"))
        assert receive(sock)[5] == 0xd0
        sock.sendall(job(bytes.fromhex("f0000001000103c0")))
        assert len(receive(sock)) == 27
        return sock

    def item(db):
        return bytes.fromhex("120a10020004") + db.to_bytes(2, "big") + bytes.fromhex("84000000")

    def write(sock, db, value):
        sock.sendall(job(b"\x05\x01" + item(db), bytes.fromhex("00040020") + value.to_bytes(4, "big")))

    def read(sock, db):
        sock.sendall(job(b"\x04\x01" + item(db)))
        return int.from_bytes(receive(sock)[-4:], "big")

    with tempfile.TemporaryDirectory(prefix="z7-deferred-") as directory:
        path = Path(directory) / "memory"
        context = lib.z7_init(port, os.fsencode(path))
        assert context
        lock = FileLock(path)
        locked = False
        sockets = []
        try:
            lib.z7_start(context)
            writers = [connect() for _ in range(16)]
            sockets.extend(writers)
            lock.acquire()
            locked = True
            for index, sock in enumerate(writers):
                write(sock, 10 + index, 100 + index)
            time.sleep(0.03)
            began = time.monotonic()
            reader = connect()  # Accept/setup must still progress while writes are waiting.
            sockets.append(reader)
            assert read(reader, 10) == 0, "a contested write mutated storage"
            assert time.monotonic() - began < 0.5, "lock holder stalled other clients"
            assert not select.select(writers, [], [], 0)[0], "write acknowledged before lock acquisition"
            lock.release()
            locked = False
            for index, sock in enumerate(writers):
                assert receive(sock)[-1] == 255
                assert read(reader, 10 + index) == 100 + index
            print("PASS: 16 deferred writers, independent readers/accept, fair completion", flush=True)

            lock.acquire()
            locked = True
            write(writers[0], 10, 999)
            began = time.monotonic()
            error = receive(writers[0])
            assert error[17:19] == bytes.fromhex("8301"), "no explicit resource timeout"
            assert 0.8 < time.monotonic() - began < 2.5, "write wait is not bounded"
            lock.release()
            locked = False
            assert read(reader, 10) == 100, "expired write was applied"
            write(writers[0], 10, 321)
            assert receive(writers[0])[-1] == 255
            assert read(reader, 10) == 321
            print("PASS: bounded timeout, no late mutation, same-connection recovery", flush=True)

            lock.acquire()
            locked = True
            for index, sock in enumerate(writers):
                write(sock, 10 + index, 500 + index)
            assert read(reader, 10) == 321
            began = time.monotonic()
            lib.z7_stop(context)
            assert time.monotonic() - began < 0.5, "shutdown blocked on an external lock"
            lib.z7_start(context)
            restarted = connect()
            sockets.append(restarted)
            assert read(restarted, 10) == 321
            lock.release()
            locked = False
            write(restarted, 10, 777)
            assert receive(restarted)[-1] == 255
            assert read(restarted, 10) == 777
            print("PASS: shutdown/restart while locked, canceled work does not leak", flush=True)
        finally:
            if locked:
                lock.release()
            for sock in sockets:
                sock.close()
            lock.close()
            lib.z7_deinit(context)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--worker":
        worker(sys.argv[2])
    elif len(sys.argv) == 2:
        raise SystemExit(subprocess.run([sys.executable, __file__, "--worker", sys.argv[1]], timeout=20).returncode)
    else:
        raise SystemExit(f"Usage: {sys.argv[0]} /path/to/z7.dll-or-libz7.so")
