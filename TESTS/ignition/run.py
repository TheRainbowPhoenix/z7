"""Run original Ignition 5.0.1 codecs against an isolated z7 library instance."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import queue
import socket
import subprocess
import sys
import threading
import time
import zipfile
from pcap import write_pcap
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from file_lock import FileLock


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--driver-jar", type=Path, required=True)
    parser.add_argument("--z7-library", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(".zig-cache/ignition-harness"))
    parser.add_argument("--lock-hold-ms", type=float, default=0)
    parser.add_argument("--load-iterations", type=int, default=10000)
    args = parser.parse_args()
    if not 0 <= args.lock_hold_ms <= 100:
        parser.error("lock-hold-ms must be 0..100")
    if not 100 <= args.load_iterations <= 10000 or args.load_iterations % 10:
        parser.error("load-iterations must be 100..10000 and divisible by 10")
    jar = args.driver_jar.resolve(strict=True)
    expected_sha256 = "681e85b9082a469a0a735fefe0e4d0f9dee4cccc5940855e700535c89b98c919"
    if hashlib.sha256(jar.read_bytes()).hexdigest() != expected_sha256:
        raise RuntimeError("Driver JAR does not match the pinned 5.0.1 fixture SHA-256")
    library = args.z7_library.resolve(strict=True)
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    classes = output / "classes"
    classes.mkdir(exist_ok=True)
    source = Path(__file__).resolve().parent
    sources = sorted(source.glob("stubs/**/*.java")) + sorted(source.glob("src/**/*.java"))
    stubs = sorted(source.glob("stubs/**/*.java"))
    with zipfile.ZipFile(jar) as archive:
        members = set(archive.namelist())
        duplicate = [
            str(path) for path in stubs
            if path.relative_to(source / "stubs").as_posix().replace(".java", ".class") in members
        ]
        if duplicate:
            raise RuntimeError(f"A stub would shadow vendor code: {duplicate}")
        alarm_classes = [name for name in members if name.endswith(".class") and "alarm" in name.lower()]
        alarm_constants = [
            name for name in members
            if name.endswith(".class") and b"alarm" in archive.read(name).lower()
        ]
    subprocess.run(
        ["javac", "--release", "11", "-encoding", "UTF-8", "-cp", str(jar),
         "-d", str(classes)] + [str(path) for path in sources],
        check=True, timeout=60,
    )
    lib = ctypes.CDLL(str(library))
    lib.z7_init.argtypes = [ctypes.c_uint16, ctypes.c_char_p]
    lib.z7_init.restype = ctypes.c_void_p
    for name in ("z7_start", "z7_stop", "z7_deinit"):
        getattr(lib, name).argtypes = [ctypes.c_void_p]
        getattr(lib, name).restype = None
    lib.z7_get_status.argtypes = [ctypes.c_void_p]
    lib.z7_get_status.restype = ctypes.c_uint8
    lib.z7_alarm_set.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint8]
    lib.z7_alarm_set.restype = ctypes.c_int32
    lib.z7_register_symbol.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_size_t,
                                       ctypes.c_uint8, ctypes.c_uint16, ctypes.c_uint32,
                                       ctypes.c_uint8, ctypes.c_uint16]
    lib.z7_register_symbol.restype = ctypes.c_int32
    if os.name == "nt":
        ctypes.windll.kernel32.SetErrorMode(0x0001 | 0x0002)
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    storage = output / "test-storage.shm"
    # A rerun starts with fresh fixture memory, without touching a user's shared-memory file.
    if storage.exists():
        storage.unlink()
    ctx = lib.z7_init(port, os.fsencode(storage))
    if not ctx:
        raise RuntimeError("z7_init failed")
    process = None
    lock = None
    lock_thread = None
    lock_stop = threading.Event()
    lock_errors = []
    lines, results, origins, controls, wire = [], [], [], [], []
    return_code = None
    try:
        for path, offset, kind in [(bytes.fromhex("8a0e000112340001"), 160, 7),
                                   (bytes.fromhex("8a0e00011234000200000003"), 40, 0x13)]:
            if lib.z7_register_symbol(ctx, path, len(path), 0x84, 1, offset * 8, kind, 1) != 0:
                raise RuntimeError("fixture symbol registration failed")
        lib.z7_start(ctx)
        if lib.z7_register_symbol(ctx, b"12345678", 8, 0x84, 1, 0, 2, 1) != -2:
            raise RuntimeError("running symbol table accepted mutation")
        if args.lock_hold_ms:
            lock = FileLock(storage)
            def contend():
                try:
                    while not lock_stop.is_set():
                        lock.acquire()
                        try:
                            lock_stop.wait(args.lock_hold_ms / 1000)
                        finally:
                            lock.release()
                        lock_stop.wait(args.lock_hold_ms / 1000)
                except BaseException as error:
                    lock_errors.append(str(error))
            lock_thread = threading.Thread(target=contend, daemon=True)
            lock_thread.start()
        command = ["java", "-ea", "-cp", os.pathsep.join([str(classes), str(jar)]),
                   "z7.harness.DriverHarness", str(port), str(args.load_iterations)]
        process = subprocess.Popen(
            command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace",
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        messages = queue.Queue(maxsize=1024)
        def read_output():
            for line in process.stdout:
                messages.put(line.rstrip("\n"))
            messages.put(None)
        threading.Thread(target=read_output, daemon=True).start()
        deadline = time.monotonic() + 120
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("Java harness exceeded 120 seconds")
            line = messages.get(timeout=remaining)
            if line is None:
                break
            if len(lines) >= 4096:
                raise RuntimeError("Java harness output exceeded bound")
            lines.append(line)
            if line in ("CONTROL STOP", "CONTROL START"):
                starting = line == "CONTROL START"
                (lib.z7_start if starting else lib.z7_stop)(ctx)
                status = lib.z7_get_status(ctx)
                if status != int(starting):
                    raise RuntimeError("server lifecycle transition failed")
                controls.append(dict(lifecycle="start" if starting else "stop", status=status))
                process.stdin.write("0\n")
                process.stdin.flush()
            elif line.startswith("CONTROL SET "):
                fields = line.split()
                if len(fields) != 4:
                    raise RuntimeError("invalid fixture control request")
                event_id, signals = map(int, fields[2:])
                if not 1 <= event_id <= 0xFFFFFFFF or not 0 <= signals <= 255:
                    raise RuntimeError("invalid fixture alarm values")
                result = lib.z7_alarm_set(ctx, event_id, signals)
                controls.append(dict(event_id=event_id, signals=signals, result=result))
                process.stdin.write(str(result) + "\n")
                process.stdin.flush()
            elif line.startswith("WIRE\t"):
                _, direction, frame = line.split("\t")
                wire.append(dict(direction=direction, hex=frame))
            elif line.startswith("RESULT\t"):
                _, name, status, detail = line.split("\t", 3)
                results.append(dict(name=name, status=status, detail=detail))
                print(f"{status}: {name} {detail}", flush=True)
            elif line.startswith("SOURCE\t"):
                _, name, location = line.split("\t", 2)
                origins.append(dict(name=name, location=location))
            else:
                print(line, flush=True)
        return_code = process.wait(timeout=3)
    finally:
        if process is not None and process.poll() is None:
            process.kill()
            process.wait(timeout=3)
        lock_stop.set()
        if lock_thread is not None:
            lock_thread.join(timeout=3)
            if lock_thread.is_alive():
                raise RuntimeError("lock fixture failed to stop")
        if lock is not None:
            lock.close()
        lib.z7_deinit(ctx)
        if storage.exists():
            storage.unlink()
        report = dict(
            driver_jar=str(jar), driver_sha256=hashlib.sha256(jar.read_bytes()).hexdigest(),
            z7_library=str(library), z7_sha256=hashlib.sha256(library.read_bytes()).hexdigest(),
            native_alarm_class_matches=alarm_classes, native_alarm_constant_matches=alarm_constants,
            scope="Original JAR read/write codecs and response handler; separate classic alarm adapter",
            stub_classes=[str(path.relative_to(source / "stubs")) for path in stubs],
            class_origins=origins, results=results, fixture_alarm_updates=controls,
            java_exit_code=return_code, wire=wire,
            lock_hold_ms=args.lock_hold_ms, lock_errors=lock_errors, load_iterations=args.load_iterations,
        )
        (output / "results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        (output / "java.log").write_text("\n".join(lines) + "\n", encoding="utf-8")
        write_pcap(output / "wire.pcap", wire)
        print(f"Report: {output / 'results.json'}")
    if lock_errors or return_code != 0 or not results or any(case["status"] != "PASS" for case in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
