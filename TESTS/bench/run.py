"""Linux loopback S7 benchmark: a native client process and an isolated z7 host."""
import argparse
import ctypes
import fcntl
import threading
import json
import os
from pathlib import Path
import platform
import socket
import subprocess
import tempfile
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--clients", default="1,4,16")
    parser.add_argument("--requests", type=int, default=10000)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--cases", default="read:1,write:1,mixed:1,read:16,write:16")
    parser.add_argument("--server-cpu", type=int)
    parser.add_argument("--client-cpu", type=int)
    parser.add_argument("--lock-hold-ms", type=float, default=0)
    args = parser.parse_args()
    if platform.system() != "Linux":
        parser.error("Run this benchmark on Linux with a matching Linux library")
    clients = [int(value) for value in args.clients.split(",")]
    cases = [(name, int(count)) for name, count in (case.split(":") for case in args.cases.split(","))]
    modes = {"read": 0, "write": 1, "mixed": 2}
    if not 0 <= args.lock_hold_ms <= 100:
        parser.error("lock-hold-ms must be 0..100")
    if not (1 <= args.repeats <= 10 and 1000 <= args.requests <= 1000000):
        parser.error("repeats must be 1..10; requests must be 1000..1000000")
    if any(not 1 <= count <= 64 for count in clients) or any(name not in modes or not 1 <= count <= 32 for name, count in cases):
        parser.error("clients must be 1..64; cases use read/write/mixed and 1..32 items")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    binary = output / "client"
    subprocess.run(["gcc", "-O3", "-Wall", "-Wextra", "-Werror", "-pthread", str(Path(__file__).with_name("client.c")), "-o", str(binary)], check=True, timeout=30)
    available = os.sched_getaffinity(0)
    if any(cpu is not None and cpu not in available for cpu in (args.server_cpu, args.client_cpu)):
        parser.error("requested CPU is not in the allowed affinity mask")
    if args.server_cpu is not None:
        os.sched_setaffinity(0, {args.server_cpu})
    client_env = dict(os.environ)
    if args.client_cpu is not None:
        client_env["Z7_BENCH_CLIENT_CPU"] = str(args.client_cpu)
    library = args.library.resolve(strict=True)
    lib = ctypes.CDLL(str(library))
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
    results = []
    try:
        with tempfile.TemporaryDirectory(prefix="z7-bench-") as storage:
            context = lib.z7_init(port, os.fsencode(Path(storage) / "memory.shm"))
            if not context:
                raise RuntimeError("z7_init failed")
            stop_lock = threading.Event()
            lock_thread = None
            def contend():
                with open(Path(storage) / "memory.shm", "r+b", buffering=0) as shared:
                    while not stop_lock.is_set():
                        fcntl.flock(shared, fcntl.LOCK_EX)
                        try:
                            stop_lock.wait(args.lock_hold_ms / 1000)
                        finally:
                            fcntl.flock(shared, fcntl.LOCK_UN)
                        stop_lock.wait(args.lock_hold_ms / 1000)
            try:
                lib.z7_start(context)
                if args.lock_hold_ms:
                    lock_thread = threading.Thread(target=contend)
                    lock_thread.start()
                for repeat in range(args.repeats):
                    for count in clients:
                        for name, items in cases:
                            cpu_before = time.process_time()
                            usage_before = os.times()
                            result = subprocess.run([str(binary), str(port), str(count), str(args.requests), str(items), str(modes[name])], check=True, capture_output=True, text=True, timeout=120, env=client_env)
                            cpu = time.process_time() - cpu_before
                            usage_after = os.times()
                            row = json.loads(result.stdout)
                            row.update(repeat=repeat, case=name, server_host_cpu_seconds=cpu,
                                       server_host_user_seconds=usage_after.user - usage_before.user,
                                       server_host_system_seconds=usage_after.system - usage_before.system)
                            results.append(row)
                            print(json.dumps(row), flush=True)
            finally:
                stop_lock.set()
                if lock_thread is not None:
                    lock_thread.join(timeout=2)
                    if lock_thread.is_alive():
                        raise RuntimeError("lock fixture did not stop")
                lib.z7_deinit(context)
    finally:
        (output / "results.json").write_text(json.dumps(dict(library=str(library), platform=platform.platform(), cpus=os.cpu_count(), server_cpu=args.server_cpu, client_cpu=args.client_cpu, lock_hold_ms=args.lock_hold_ms, requests_per_client=args.requests, warmup_per_client=1000, results=results), indent=2))


if __name__ == "__main__":
    main()
