"""Readable V2 discovery, links, Invoke and subscriptions through the C library."""
import argparse
from pathlib import Path
import tempfile
from zomsp import Client, Library, ROOT, Server, decode, encode


def run(library, tls_library, credentials):
    credentials = Path(credentials)
    with tempfile.TemporaryDirectory() as folder, Server(Path(folder) / "demo.shm", library) as server:
        server.class_(9000)
        server.class_(9001, base=9000, flags=65536)
        counter = server.variable("Counter", 0, writable=False)
        server.link(201, 2699, [counter])
        server.method(counter, 100, lambda call, arguments: (0, encode(42) + b"\0\0"))
        port = server.start(credentials / "server-cert.pem", credentials / "server-key.pem", tls_library)
        with Client("127.0.0.1", port, credentials / "server-cert.pem", tls_library, library) as client:
            print("Objects:", client.explore()["objects"])
            print("Linked counters:", client.get_link(201, 2699))
            print("Method result:", client.invoke(counter, 100)["value"])
            with client.subscribe([(counter, 42)]) as subscription:
                client.next_event()  # Initial subscription phase.
                print("Initial Counter:", decode(client.next_event()["records"][0]["raw"]))
                server.set("Counter", 1)
                print("Counter changed:", decode(client.next_event()["records"][0]["raw"]))
                subscription.disabled()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library")
    parser.add_argument("--tls-library", required=True)
    parser.add_argument("--credentials", default=ROOT / "TESTS/omsp/native/omsp_capture_analysis/native_test_credentials")
    args = parser.parse_args()
    run(Library(args.library), args.tls_library, args.credentials)
