"""Bounded failure/restart tests; every run uses isolated persistent fixture storage."""
import ctypes
import os
from pathlib import Path
import socket
import struct
import subprocess
import sys
import tempfile
import time
from test_shared_library import job, receive


def worker(library):
    if os.name == 'nt':
        ctypes.windll.kernel32.SetErrorMode(3)
    lib = ctypes.CDLL(str(Path(library).resolve()))
    lib.z7_init.argtypes = [ctypes.c_uint16, ctypes.c_char_p]
    lib.z7_init.restype = ctypes.c_void_p
    for name in ('z7_start', 'z7_stop', 'z7_deinit'):
        getattr(lib, name).argtypes = [ctypes.c_void_p]
        getattr(lib, name).restype = None
    lib.z7_get_status.argtypes = [ctypes.c_void_p]
    lib.z7_get_status.restype = ctypes.c_uint8
    lib.z7_set_log_level.argtypes = [ctypes.c_uint8]
    lib.z7_set_log_level(0)

    def handles():
        if os.name != 'nt':
            return len(list(Path('/proc/self/fd').iterdir()))
        kernel = ctypes.windll.kernel32
        kernel.GetCurrentProcess.restype = ctypes.c_void_p
        kernel.GetProcessHandleCount.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
        count = ctypes.c_uint32()
        assert kernel.GetProcessHandleCount(kernel.GetCurrentProcess(), ctypes.byref(count))
        return count.value

    with socket.socket() as reserve:
        reserve.bind(('127.0.0.1', 0))
        port = reserve.getsockname()[1]
    descriptor = bytes.fromhex('120a10020004000184000000')
    write = job(b'\x05\x01' + descriptor, bytes.fromhex('0004002011223344'))
    read = job(b'\x04\x01' + descriptor)

    def connect(pdu=240):
        sock = socket.create_connection(('127.0.0.1', port), 1)
        sock.settimeout(1)
        try:
            sock.sendall(bytes.fromhex('0300001611e00000003a00c1020600c2020600c0010a'))
            assert receive(sock)[5] == 0xd0
            sock.sendall(job(bytes.fromhex('f00000010001') + pdu.to_bytes(2, 'big')))
            assert int.from_bytes(receive(sock)[-2:], 'big') == pdu
            return sock
        except BaseException:
            sock.close()
            raise

    def closed(sock):
        try:
            assert sock.recv(1) == b'', 'old session survived stop'
        except (ConnectionResetError, ConnectionAbortedError):
            pass

    with tempfile.TemporaryDirectory(prefix='z7-recovery-') as directory:
        storage = os.fsencode(Path(directory) / 'memory')
        ctx = lib.z7_init(port, storage)
        assert ctx
        try:
            # An occupied port must fail without retaining handles/mappings/rings.
            before = handles()
            for _ in range(8):
                duplicate = lib.z7_init(port, os.fsencode(Path(directory) / 'failed'))
                if duplicate:
                    lib.z7_deinit(duplicate)
                    raise AssertionError('two servers acquired the same listening endpoint')
            after = handles()
            assert after <= before + 2, f'failed init leaked handles: {before} -> {after}'
            print('PASS: failed initialization cleans resources', flush=True)
            lib.z7_stop(ctx)  # Also releases a listener that was never started.
            with socket.socket() as blocker:
                blocker.bind(('0.0.0.0', port))
                blocker.listen(1)
                before = handles()
                for _ in range(8):
                    lib.z7_start(ctx)
                    assert lib.z7_get_status(ctx) == 0, 'failed restart reports running'
                assert handles() <= before + 2, 'failed restart leaked resources'
            lib.z7_start(ctx)
            lib.z7_start(ctx)  # Idempotent: no duplicate accept owner.
            print('PASS: unavailable endpoint restart fails cleanly and can be retried', flush=True)
            with connect() as peer:
                peer.sendall(write)
                assert receive(peer)[-1] == 255
            # Reuse slots more often than the server capacity, with partial writes
            # and RST while replies are queued. A healthy observer must survive.
            with connect() as observer:
                for index in range(120):
                    with connect(240 if index % 2 else 480) as peer:
                        peer.sendall(write[:-1] if index % 2 else read * 8)
                        peer.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER,
                            struct.pack('HH' if os.name == 'nt' else 'ii', 1, 0))
                    observer.sendall(read)
                    assert receive(observer)[-4:] == bytes.fromhex('11223344')
            print('PASS: RST/partial-write churn, slot reuse and observer isolation', flush=True)
            for cycle in range(8):
                with connect() as peer:
                    # Incomplete writes must not survive stop or a slot reset.
                    peer.sendall(write[:-1])
                    started = time.monotonic()
                    lib.z7_stop(ctx)
                    assert time.monotonic() - started < 1, 'stop exceeded deadline'
                    assert lib.z7_get_status(ctx) == 0
                    closed(peer)
                try:
                    with socket.create_connection(('127.0.0.1', port), 0.2):
                        raise AssertionError('stopped server still accepts TCP connections')
                except (ConnectionRefusedError, socket.timeout):
                    pass
                lib.z7_stop(ctx)
                lib.z7_start(ctx)
                with connect(960) as peer:
                    peer.sendall(read)
                    assert receive(peer)[-4:] == bytes.fromhex('11223344')
            print('PASS: stop/restart closes endpoint, preserves data, resets sessions', flush=True)
        finally:
            lib.z7_deinit(ctx)
        # Destroy/recreate must also reuse the port and existing storage safely.
        ctx = lib.z7_init(port, storage)
        assert ctx
        try:
            lib.z7_start(ctx)
            with connect() as peer:
                peer.sendall(read)
                assert receive(peer)[-4:] == bytes.fromhex('11223344')
        finally:
            lib.z7_deinit(ctx)
        print('PASS: full context recreation and persistent readback', flush=True)
        # Abruptly kill only our child fixture, so no destructor or stop can hide
        # process-crash recovery bugs. Retain an acknowledged value, discard an
        # incomplete write, then rebuild the endpoint using the same backing file.
        child = subprocess.Popen(
            [sys.executable, __file__, '--crash-server', library, str(port), os.fsdecode(storage)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        try:
            deadline = time.monotonic() + 5
            peer = None
            while time.monotonic() < deadline:
                assert child.poll() is None, 'crash fixture exited before connecting'
                try:
                    peer = connect()
                    break
                except (OSError, EOFError):
                    time.sleep(0.02)
            assert peer is not None, 'crash fixture failed to start'
            with peer:
                acknowledged = write[:-4] + bytes.fromhex('55667788')
                peer.sendall(acknowledged)
                assert receive(peer)[-1] == 255
                peer.sendall(write[:-1])
                child.kill()
                child.wait(timeout=5)
                closed(peer)
        finally:
            if child.poll() is None:
                child.kill()
                child.wait(timeout=5)
        ctx = lib.z7_init(port, storage)
        assert ctx, 'endpoint not reusable after crash'
        try:
            lib.z7_start(ctx)
            with connect() as peer:
                peer.sendall(read)
                assert receive(peer)[-4:] == bytes.fromhex('55667788')
                peer.sendall(write)
                assert receive(peer)[-1] == 255
        finally:
            lib.z7_deinit(ctx)
        print('PASS: killed process recovery, acknowledged data retained, partial write discarded', flush=True)


if __name__ == '__main__':
    if len(sys.argv) == 5 and sys.argv[1] == '--crash-server':
        lib = ctypes.CDLL(str(Path(sys.argv[2]).resolve()))
        lib.z7_init.argtypes = [ctypes.c_uint16, ctypes.c_char_p]
        lib.z7_init.restype = ctypes.c_void_p
        lib.z7_start.argtypes = [ctypes.c_void_p]
        ctx = lib.z7_init(int(sys.argv[3]), os.fsencode(sys.argv[4]))
        assert ctx
        lib.z7_start(ctx)
        time.sleep(30)  # Parent kills the fixture; bounded even if the parent fails.
    elif len(sys.argv) == 3 and sys.argv[1] == '--worker':
        worker(sys.argv[2])
    elif len(sys.argv) == 2:
        raise SystemExit(subprocess.run([sys.executable, __file__, '--worker', sys.argv[1]], timeout=40).returncode)
    else:
        raise SystemExit(f'Usage: {sys.argv[0]} /path/to/z7.dll-or-libz7.so')
