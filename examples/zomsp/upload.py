"""A committed upload arrives on a queue; a compiler worker starts its program."""
import argparse
from pathlib import Path
import queue
import tempfile
import threading
import time
from zomsp import Client, Library, ROOT, Server


def run(library, tls_library, credentials):
    code = b"ADD Counter 1\n"
    uploads = queue.Queue(maxsize=4)
    stop = threading.Event()
    certificate = Path(credentials) / "server-cert.pem"
    key = Path(credentials) / "server-key.pem"

    with tempfile.TemporaryDirectory() as directory, Server(Path(directory) / "plc.shm", library) as server:
        server.variable("Counter", 0, writable=False)
        server.variable("Loaded", False, writable=False)
        server.stream(2000, 42, len(code), on_complete=uploads.put_nowait)
        failures = []

        def compiler_and_runtime():
            try:
                with uploads.get(timeout=5) as uploaded:
                    # This is a seekable memory stream, not a mandatory disk file.
                    program = uploaded.read().decode("utf-8")
                    if program != "ADD Counter 1\n":
                        raise ValueError("unsupported demo program")
                server.set("Loaded", True)
                counter = 0
                while not stop.wait(0.02):
                    counter += 1
                    server.set("Counter", counter)
            except Exception as error:
                failures.append(error)

        worker = threading.Thread(target=compiler_and_runtime)
        worker.start()
        try:
            port = server.start(certificate, key, tls_library)
            with Client("127.0.0.1", port, certificate, tls_library, library) as client:
                client.begin()
                client.upload(2000, 42, code)
                assert not client.read("Loaded")  # Bytes received, not committed yet.
                client.end()
                samples = []
                for _ in range(5):
                    time.sleep(0.06)
                    samples.append(client.read("Counter"))
                assert client.read("Loaded")
                assert all(first < second for first, second in zip(samples, samples[1:]))
                assert not failures and not server.errors, (failures, server.errors)
                print("Uploaded:", code.decode().strip())
                print("Counter:", samples)
        finally:
            stop.set()
            worker.join(timeout=6)
            assert not worker.is_alive()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library")
    parser.add_argument("--tls-library", required=True)
    parser.add_argument("--credentials", default=ROOT / "TESTS/omsp/native/omsp_capture_analysis/native_test_credentials")
    arguments = parser.parse_args()
    run(Library(arguments.library), arguments.tls_library, arguments.credentials)
