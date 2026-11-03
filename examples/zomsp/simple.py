"""Run a small named-variable server and read/write it with the Zig client library."""
import argparse
from pathlib import Path
import tempfile
import threading
import time
from zomsp import Client, Library, ROOT, Server


def run(library, tls_library, credentials):
    certificate = Path(credentials) / "server-cert.pem"
    key = Path(credentials) / "server-key.pem"
    with tempfile.TemporaryDirectory() as directory, Server(Path(directory) / "values.shm", library) as server:
        server.variable("Counter", 0, writable=False)
        server.variable("Setpoint", 10)
        stop = threading.Event()

        def plant():
            counter = 0
            while not stop.wait(0.02):
                counter += 1
                server.set("Counter", counter)

        worker = threading.Thread(target=plant)
        worker.start()
        try:
            port = server.start(certificate, key, tls_library)
            with Client("127.0.0.1", port, certificate, tls_library, library) as client:
                assert client.read("Setpoint") == 10
                client.write("Setpoint", 25)
                assert client.read("Setpoint") == 25
                samples = []
                for _ in range(5):
                    time.sleep(0.06)
                    samples.append(client.read("Counter"))
                assert all(first < second for first, second in zip(samples, samples[1:]))
                print("Counter:", samples)
                print("Setpoint:", client.read("Setpoint"))
        finally:
            stop.set()
            worker.join()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library")
    parser.add_argument("--tls-library", required=True)
    parser.add_argument("--credentials", default=ROOT / "TESTS/omsp/native/omsp_capture_analysis/native_test_credentials")
    arguments = parser.parse_args()
    run(Library(arguments.library), arguments.tls_library, arguments.credentials)
