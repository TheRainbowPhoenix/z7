"""Start a named-variable server. Use client.py or client.ts from another process."""
import argparse
import tempfile
import time
from pathlib import Path
from zomsp import Library, ROOT, Server

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--library")
parser.add_argument("--tls-library", required=True)
parser.add_argument("--credentials", default=ROOT / "TESTS/omsp/native/omsp_capture_analysis/native_test_credentials")
parser.add_argument("--port", type=int, default=1102)
arguments = parser.parse_args()
credentials = Path(arguments.credentials)

with tempfile.TemporaryDirectory() as directory, Server(Path(directory) / "values.shm", Library(arguments.library)) as server:
    server.variable("Counter", 0, writable=False)
    server.variable("Setpoint", 10)
    port = server.start(credentials / "server-cert.pem", credentials / "server-key.pem", arguments.tls_library, arguments.port)
    print("OMSp server: 127.0.0.1:%d; Counter and Setpoint are available" % port, flush=True)
    counter = 0
    try:
        while True:
            time.sleep(0.1)
            counter += 1
            server.set("Counter", counter)
    except KeyboardInterrupt:
        print("Stopped")
