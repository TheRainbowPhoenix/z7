"""TPKT stream framing and bounded response-queue regression."""
import ctypes
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from test_shared_library import job, receive


def worker(library):
    if os.name == "nt":
        ctypes.windll.kernel32.SetErrorMode(0x0001 | 0x0002)
    lib = ctypes.CDLL(str(Path(library).resolve()))
    lib.z7_init.argtypes = [ctypes.c_uint16, ctypes.c_char_p]
    lib.z7_init.restype = ctypes.c_void_p
    for name in ("z7_start", "z7_deinit"):
        getattr(lib, name).argtypes = [ctypes.c_void_p]
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="z7-stream-") as directory:
        context = lib.z7_init(port, os.fsencode(Path(directory) / "memory"))
        assert context
        try:
            lib.z7_start(context)
            with socket.create_connection(("127.0.0.1", port), 2) as sock:
                sock.settimeout(2)
                sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                cr = bytes.fromhex("0300001611e00000003a00c1020600c2020600c0010a")
                # Force fragmented header and fragmented body before any setup.
                for part in (cr[:1], cr[1:3], cr[3:8], cr[8:]):
                    sock.sendall(part)
                    time.sleep(0.01)
                assert receive(sock)[5] == 0xd0
                sock.sendall(job(bytes.fromhex("f0000001000103c0")))
                assert len(receive(sock)) == 27
                descriptor = bytes.fromhex("120a10020004000184000000")
                frames = []
                for index in range(512):
                    value = index.to_bytes(4, "big")
                    write = bytearray(job(b"\x05\x01" + descriptor, bytes.fromhex("00040020") + value))
                    read = bytearray(job(b"\x04\x01" + descriptor))
                    write[11:13] = (index * 2 + 1).to_bytes(2, "big")
                    read[11:13] = (index * 2 + 2).to_bytes(2, "big")
                    frames.extend((write, read))
                # A robustness probe, not a claim that negotiated AMQ allows 1024 jobs.
                # Exceeds both the four-entry TX queue and the 16 KiB RX buffer.
                stream = b"".join(frames)
                start = 0
                for end in (1, 3, 4, 11, 4093, len(stream)):
                    sock.sendall(stream[start:end])
                    start = end
                for index in range(512):
                    write, read = receive(sock), receive(sock)
                    assert write[11:13] == (index * 2 + 1).to_bytes(2, "big")
                    assert write[-1] == 255
                    assert read[11:13] == (index * 2 + 2).to_bytes(2, "big")
                    assert read[-4:] == index.to_bytes(4, "big")
                # Retain a partial next frame across a completed response.
                sock.sendall(frames[0] + frames[1][:3])
                assert receive(sock)[-1] == 255
                sock.sendall(frames[1][3:])
                assert receive(sock)[-4:] == b"\0" * 4
                sock.sendall(bytes.fromhex("03000006"))
                try:
                    assert sock.recv(1) == b"", "invalid frame was not disconnected"
                except ConnectionResetError:
                    pass  # Windows may reset a connection with a canceled receive.
            print("TPKT stream: fragmented/coalesced frames, queue backpressure and ordering PASS")
        finally:
            lib.z7_deinit(context)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--worker":
        worker(sys.argv[2])
    elif len(sys.argv) == 2:
        raise SystemExit(subprocess.run([sys.executable, __file__, "--worker", sys.argv[1]], timeout=20).returncode)
    else:
        raise SystemExit(f"Usage: {sys.argv[0]} /path/to/z7.dll-or-libz7.so")
