"""Read named variables using the zOMSp client DLL/shared library."""
import argparse
import time
from pathlib import Path
from zomsp import Client, Library, ROOT

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--library")
parser.add_argument("--tls-library", required=True)
parser.add_argument("--certificate", default=ROOT / "TESTS/omsp/native/omsp_capture_analysis/native_test_credentials/server-cert.pem")
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", type=int, default=1102)
arguments = parser.parse_args()

with Client(arguments.host, arguments.port, Path(arguments.certificate), arguments.tls_library, Library(arguments.library)) as client:
    client.write("Setpoint", 25)
    for _ in range(5):
        print("Counter =", client.read("Counter"), "Setpoint =", client.read("Setpoint"))
        time.sleep(0.2)
