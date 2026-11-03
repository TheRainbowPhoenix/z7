"""Persistent zOMSp demo server. Forward a VM Ethernet address to its loopback port."""
import argparse
from pathlib import Path
import threading
import time
from zomsp import Library, Server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library")
    parser.add_argument("--tls-library", required=True)
    parser.add_argument("--certificate", required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--port", type=int, default=1102)
    parser.add_argument("--shm", default="demo-omsp.shm")
    parser.add_argument("--duration", type=float, default=0, help="seconds; 0 runs until Ctrl+C")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535 or args.duration < 0:
        parser.error("invalid port or duration")
    stop = threading.Event()
    with Server(Path(args.shm), Library(args.library)) as server:
        server.variable("Counter", 0, writable=False)
        server.variable("Setpoint", 10)
        port = server.start(args.certificate, args.key, args.tls_library, port=args.port)
        print(f"OMSp V2 demo listening on 127.0.0.1:{port}; Counter and Setpoint; Ctrl+C stops.", flush=True)
        print("TIA discovery is supplied by zDCP. This application model is not a complete Siemens PLC.", flush=True)
        deadline = time.monotonic() + args.duration if args.duration else float("inf")
        counter = 0
        try:
            while time.monotonic() < deadline and not stop.wait(0.1):
                counter = (counter + 1) & 0xffffffff
                server.set("Counter", counter)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
