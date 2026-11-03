"""Exercise both Deno FFI directions with actual OMSp values and upload bytes."""
import json
from pathlib import Path
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "examples/zomsp"))
from zomsp import Client, Library, Server


def check(library, tls_library, credentials):
    deno = shutil.which("deno")
    if not deno:
        raise RuntimeError("Deno required for FFI integration tests")
    library = str(Path(library).resolve())
    tls_library = str(Path(tls_library).resolve())
    credentials = Path(credentials).resolve()
    certificate = credentials / "server-cert.pem"
    key = credentials / "server-key.pem"
    command = [deno, "run", "--allow-ffi", "--allow-read", "--allow-write"]
    process = subprocess.Popen(command + [str(ROOT / "examples/zomsp/server.ts"), library,
        tls_library, str(certificate), str(key), "0", "5000"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    output = queue.Queue()
    lines = []
    def consume():
        for line in process.stdout:
            lines.append(line)
            output.put(line)
        output.put(None)
    reader = threading.Thread(target=consume)
    reader.start()
    try:
        deadline = time.monotonic() + 15
        port = None
        while time.monotonic() < deadline:
            line = output.get(timeout=max(.01, deadline - time.monotonic()))
            if line is None:
                break
            try:
                port = json.loads(line).get("ready")
            except json.JSONDecodeError:
                continue
            if port:
                break
        assert port, "".join(lines)
        with Client("127.0.0.1", port, certificate, tls_library, Library(library)) as client:
            assert client.read("Counter") == 0
            assert client.read("Setpoint") == 10
            client.write("Setpoint", 23)
            assert client.read("Setpoint") == 23
            client.begin()
            client.upload(2000, 42, b"ADD Counter 1\n")
            assert client.read("Uploads") == 0
            client.end()
            deadline = time.monotonic() + 2
            while client.read("Uploads") != 1:
                assert time.monotonic() < deadline, "Deno upload callback did not run"
                time.sleep(.01)
            samples = []
            for _ in range(5):
                time.sleep(.12)
                samples.append(client.read("Counter"))
            assert all(after > before for before, after in zip(samples, samples[1:])), samples
        assert process.wait(timeout=10) == 0, "".join(lines)
        reader.join(timeout=2)
        summary = json.loads(lines[-1])
        assert summary["stopped"] and summary["uploads"] == 1 and summary["counter"] > 0, summary
        print("Deno server: named read/write, upload callback, exact program contents and counter execution passed")
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
        reader.join(timeout=2)
        process.stdout.close()
    with tempfile.TemporaryDirectory() as folder, Server(Path(folder) / "data.shm", Library(library)) as server:
        counter_rid = server.variable("Counter", 0, writable=False)
        server.link(201, 2699, [counter_rid])
        port = server.start(certificate, key, tls_library)
        stop = threading.Event()
        errors = []
        def tick():
            count = 0
            try:
                while not stop.wait(.02):
                    count += 1
                    server.set("Counter", count)
            except Exception as error:
                errors.append(error)
        worker = threading.Thread(target=tick)
        worker.start()
        try:
            result = subprocess.run(command + [str(ROOT / "examples/zomsp/client.ts"), library,
                tls_library, str(certificate), str(port)], capture_output=True, text=True, timeout=20)
            assert result.returncode == 0, result.stdout + result.stderr
            discovered = subprocess.run(command + [str(ROOT / "examples/zomsp/discover.ts"), library,
                tls_library, str(certificate), str(port)], capture_output=True, text=True, timeout=20)
            assert discovered.returncode == 0, discovered.stdout + discovered.stderr
        finally:
            stop.set()
            worker.join(timeout=2)
        assert not errors, errors
    print("Deno client: increasing values, Explore/object visitor and GetLink through zOMSp FFI passed")
