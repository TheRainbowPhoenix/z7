"""Real C-client results and asynchronous in-memory stream completion; no CLI logs."""
import argparse
import array
import hashlib
import io
import math
from pathlib import Path
import queue
import struct
import sys
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "examples/zomsp"))
from zomsp import Client, Library, Server


def sine_program():
    size = 8 * 1024 * 1024
    entries = (size - 64) // 4
    result = io.BytesIO()
    result.write(struct.pack("<8sII48s", b"ZOMSPSIN", 1, entries, b"\0" * 48))
    for first in range(0, entries, 16384):
        values = array.array("f", (math.sin(2 * math.pi * index / entries) for index in range(first, min(first + 16384, entries))))
        if sys.byteorder != "little":
            values.byteswap()
        result.write(values.tobytes())
    return result.getvalue(), entries


def check(library, tls_library, credentials):
    tls_library = Path(tls_library).resolve()
    library = Library(library)
    credentials = Path(credentials)
    certificate, key = credentials / "server-cert.pem", credentials / "server-key.pem"
    from simple import run as simple_demo
    from upload import run as upload_demo
    simple_demo(library, tls_library, credentials)
    upload_demo(library, tls_library, credentials)
    source, entries = sine_program()
    expected_hash = hashlib.sha256(source).digest()
    uploads = queue.Queue(maxsize=4)
    with tempfile.TemporaryDirectory() as directory, Server(Path(directory) / "values.shm", library) as server:
        server.variable("Input", 0)
        server.variable("Output", float("nan"), writable=False)
        failures, hashes, actual_values = [], [], []
        stop = threading.Event()
        compiled = threading.Event()
        reject = [False]
        callbacks = []

        def validate(view):
            assert len(view) == len(source)
            assert hashlib.sha256(view).digest() == expected_hash
            return 0x8020ab00199afff4 if reject[0] else 0

        def completed(upload):
            callbacks.append(upload.generation)
            uploads.put_nowait(upload)

        server.stream(2000, 42, len(source), completed, validate)

        def compiler_runtime():
            try:
                with uploads.get(timeout=10) as uploaded:
                    # Read and hash the actual completed payload through the C FFI.
                    digest = hashlib.sha256()
                    while True:
                        chunk = uploaded.read(65536)
                        if not chunk:
                            break
                        digest.update(chunk)
                    hashes.append(digest.digest())
                    assert hashes[-1] == expected_hash
                    uploaded.seek(0)
                    assert struct.unpack("<8sII48s", uploaded.read(64))[:3] == (b"ZOMSPSIN", 1, entries)
                    compiled.set()
                    while not stop.wait(0.002):
                        index = server.read("Input") % entries
                        uploaded.seek(64 + index * 4)
                        output = struct.unpack("<f", uploaded.read(4))[0]
                        server.set("Output", output)
            except Exception as error:
                failures.append(error)

        worker = threading.Thread(target=compiler_runtime)
        worker.start()
        try:
            port = server.start(certificate, key, tls_library)
            with Client("127.0.0.1", port, certificate, tls_library, library) as client:
                client.begin()
                client.upload(2000, 42, source)
                assert not callbacks and not compiled.is_set()
                client.end()
                assert compiled.wait(5), failures
                for index in (0, entries // 4, entries // 2, entries * 3 // 4, entries - 1):
                    client.write("Input", index)
                    expected = struct.unpack_from("<f", source, 64 + index * 4)[0]
                    deadline = time.monotonic() + 2
                    while True:
                        actual = client.read("Output")
                        if math.isfinite(actual) and abs(actual - expected) < 0.000001:
                            break
                        assert time.monotonic() < deadline, (index, expected, actual)
                        time.sleep(0.01)
                    actual_values.append(actual)
                # A complete aborted upload must not fire another completion.
                client.begin()
                client.upload(2000, 42, source)
                client.end(abort=True)
                assert len(callbacks) == 1
                # A validation failure must preserve the first committed program.
                reject[0] = True
                client.begin()
                client.upload(2000, 42, source)
                try:
                    client.end()
                except RuntimeError as error:
                    assert "8020ab00199afff4" in str(error), error
                else:
                    raise AssertionError("rejected upload accepted")
                assert len(callbacks) == 1
                assert client.read("Input") == entries - 1
            assert not failures and not server.errors, (failures, server.errors)
            assert not list(Path(directory).glob("*.blob")), "memory mode wrote an upload file"
        finally:
            stop.set()
            worker.join(timeout=6)
            assert not worker.is_alive()
    print("C client / memory callback: 8 MiB hash verified; actual REAL outputs:", actual_values)
    # Retention is independent of the server context lifetime.
    retained = queue.Queue()
    with tempfile.TemporaryDirectory() as directory, Server(Path(directory) / "retention.shm", library) as server:
        server.stream(2000, 42, 3, retained.put_nowait)
        port = server.start(certificate, key, tls_library)
        with Client("127.0.0.1", port, certificate, tls_library, library) as client:
            client.begin()
            client.upload(2000, 42, b"abc")
            client.end()
    with retained.get(timeout=2) as upload:
        assert upload.read() == b"abc" and upload.generation == 1
    # Authentication is performed by the library too, without CLI environment flags.
    for username in (None, "operator"):
        with tempfile.TemporaryDirectory() as directory, Server(Path(directory) / "auth.shm", library) as server:
            server.variable("Value", 17)
            server.password("correct-password", username)
            port = server.start(certificate, key, tls_library)
            with Client("127.0.0.1", port, certificate, tls_library, library) as client:
                client.authenticate("correct-password", username or "")
                assert client.read("Value") == 17
            with Client("127.0.0.1", port, certificate, tls_library, library) as client:
                try:
                    client.authenticate("wrong-password", username or "")
                except RuntimeError:
                    pass
                else:
                    raise AssertionError("wrong password accepted")
    print("C client: named reads/writes, memory lifetime, abort/rejection, TLS password and UAC passed")


def check_native(library, native, reference, credentials):
    import os
    import socket
    import subprocess
    library = Library(library)
    credentials = Path(credentials).resolve()
    native = Path(native).resolve()
    reference = Path(reference).resolve()
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    environment = dict(os.environ, LD_PRELOAD=str(native.with_name("native_socket_trace.so")), OMSP_TEST_PORT=str(port))
    process = subprocess.Popen([str(native), str(reference), "--server"], cwd=credentials.parent.parent,
        env=environment, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    ready = threading.Event()
    lines = []
    def read_output():
        for line in process.stdout:
            if len(lines) < 128:
                lines.append(line)
            if "server.ready" in line:
                ready.set()
    reader = threading.Thread(target=read_output)
    reader.start()
    try:
        assert ready.wait(8), "".join(lines)
        with Client("127.0.0.1", port, credentials / "server-cert.pem", reference, library) as client:
            assert client.read(client.session, 299) == 2
            client.write(client.session, 32, 299)
            assert client.read(client.session, 299) == 32
            try:
                client.read(client.session, 65535)
            except RuntimeError as error:
                assert "a03388000088ffe0" in str(error), error
            else:
                raise AssertionError("unknown native attribute accepted")
            assert client.read(client.session, 299) == 32
        print("C client -> independent native server: actual reads/writes, native error and recovery passed")
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        reader.join(timeout=2)
        process.stdout.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("library")
    parser.add_argument("--reference", required=True)
    parser.add_argument("--credentials", required=True)
    parser.add_argument("--native")
    arguments = parser.parse_args()
    check(arguments.library, arguments.reference, arguments.credentials)
    if arguments.native:
        check_native(arguments.library, arguments.native, arguments.reference, arguments.credentials)
