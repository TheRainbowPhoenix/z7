import subprocess
import time
import sys
import os
import signal

# Paths
DEMO_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_PY = os.path.join(DEMO_DIR, "mock_z7_server.py")
RUNNER_PY = os.path.join(DEMO_DIR, "ladder_runner.py")
SERVER_TS = os.path.join(DEMO_DIR, "server.ts")

# Processes
procs = []

def cleanup(sig, frame):
    print("\nShutting down demo...")
    for p in procs:
        try:
            p.terminate()
            p.wait(timeout=2)
        except:
            p.kill()
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

def main():
    print("--- Starting Z7 Demo ---")

    # 1. Start Mock S7 Server
    print(f"Starting Mock S7 Server ({SERVER_PY})...")
    s7_proc = subprocess.Popen([sys.executable, SERVER_PY], cwd=DEMO_DIR)
    procs.append(s7_proc)
    time.sleep(1) # Wait for server startup

    # 2. Start Ladder Runner
    print(f"Starting Ladder Logic Runner ({RUNNER_PY})...")
    lad_proc = subprocess.Popen([sys.executable, RUNNER_PY], cwd=DEMO_DIR)
    procs.append(lad_proc)

    # 3. Start Deno Server
    print(f"Starting Deno Server ({SERVER_TS})...")
    try:
        deno_proc = subprocess.Popen([
            "deno", "run", "--allow-net", "--allow-read", "--allow-write", SERVER_TS
        ], cwd=DEMO_DIR)
        procs.append(deno_proc)
    except FileNotFoundError:
        print("Warning: 'deno' executable not found. HTTP server/HMI will not run.")
        print("Please install Deno or verify PATH.")

    print("\nDemo is running. Press Ctrl+C to stop.")
    print("If Deno started, access HMI at http://localhost:8000")

    # Keep alive
    while True:
        time.sleep(1)
        # Check if processes are alive
        if s7_proc.poll() is not None:
            print("Mock S7 Server exited unexpectedly.")
            break
        if lad_proc.poll() is not None:
            print("Ladder Runner exited unexpectedly.")
            break
        # Deno is optional but nice to check
        if len(procs) > 2 and procs[2].poll() is not None:
            print("Deno Server exited.")
            # Don't break if optional? Or do?
            pass

    cleanup(None, None)

if __name__ == "__main__":
    main()
