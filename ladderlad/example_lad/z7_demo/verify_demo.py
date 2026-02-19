import subprocess
import time
import socket
import struct
import os
import sys

# Paths
DEMO_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_PY = os.path.join(DEMO_DIR, "mock_z7_server.py")
RUNNER_PY = os.path.join(DEMO_DIR, "ladder_runner.py")
SHM_FILE = os.path.join(DEMO_DIR, "s7_plc_shm")

def main():
    print("--- Verifying Z7 Demo ---")

    # Clean up old SHM
    if os.path.exists(SHM_FILE):
        os.remove(SHM_FILE)

    # 1. Start Processes
    print("Starting server and runner...")
    s7_proc = subprocess.Popen([sys.executable, SERVER_PY], cwd=DEMO_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    lad_proc = subprocess.Popen([sys.executable, RUNNER_PY], cwd=DEMO_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    time.sleep(2) # Wait for startup

    try:
        # 2. Connect S7 Client
        print("Connecting to S7 Server...")
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(('127.0.0.1', 1102))

        # Handshake
        # CR
        cr = bytes([
            0x03, 0x00, 0x00, 0x16,
            0x11, 0xE0, 0x00, 0x00, 0x00, 0x01, 0x00, 0xC1, 0x02, 0x01, 0x00, 0xC2, 0x02, 0x01, 0x00, 0xC0, 0x01, 0x09
        ])
        s.send(cr)
        s.recv(1024)

        # Setup
        setup = bytes([
            0x03, 0x00, 0x00, 0x19,
            0x02, 0xF0, 0x80,
            0x32, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00,
            0xF0, 0x00, 0x00, 0x01, 0x00, 0x01, 0x03, 0xC0
        ])
        s.send(setup)
        s.recv(1024)
        print("S7 Connected.")

        # Helper to read SHM
        def read_output_bit(byte_offset, bit_offset):
            with open(SHM_FILE, "rb") as f:
                f.seek(65536 + byte_offset) # Output Offset
                val = f.read(1)[0]
                return bool(val & (1 << bit_offset))

        # Helper to Write Bit via S7
        def write_input_bit(byte_offset, bit_offset, value):
            addr = (byte_offset << 3) | bit_offset
            val = 1 if value else 0
            # Write Var PDU (Bit Write)
            pdu = bytearray([
                0x03, 0x00, 0x00, 0x26, # TPKT
                0x02, 0xF0, 0x80,       # COTP
                0x32, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0E, 0x00, 0x05, # Header
                0x05, 0x01,             # Func, ItemCount
                0x12, 0x0A, 0x10,       # Item Head
                0x01,                   # BIT
                0x00, 0x01,             # Len 1
                0x00, 0x00,             # DB
                0x81,                   # Area Input
                (addr >> 16) & 0xFF, (addr >> 8) & 0xFF, addr & 0xFF,
                0x00,                   # Res
                0x03,                   # BIT
                0x00, 0x01,             # Len
                val                     # Val
            ])
            s.send(pdu)
            s.recv(1024)

        # 3. Test Logic
        print("Testing Logic...")

        # Initial State: Motor Off
        time.sleep(0.5)
        if read_output_bit(0, 0):
             print("Motor unexpectedly ON initially.")
        else:
             print("Initial state OK (Motor OFF).")

        # Set Stop Button (I0.1) to True (Closed) to allow operation
        print("Setting Stop=True (Closed)...")
        write_input_bit(0, 1, True)
        time.sleep(0.2)

        # Press Start (I0.0 = True)
        print("Pressing Start...")
        write_input_bit(0, 0, True)
        time.sleep(0.5)

        if read_output_bit(0, 0):
             print("Motor ON OK.")
        else:
             print("Motor failed to start.")
             # Debug SHM Inputs
             with open(SHM_FILE, "rb") as f:
                 i_val = f.read(1)[0]
                 print(f"SHM Input Byte 0: {i_val:08b}")
             # If I0.1 is 0, motor won't start.
             assert False, "Motor failed to start"

        # Release Start (I0.0 = False)
        print("Releasing Start...")
        write_input_bit(0, 0, False)
        time.sleep(0.5)

        if read_output_bit(0, 0):
             print("Latch OK (Motor still ON).")
        else:
             print("Latch Failed (Motor turned OFF).")
             assert False, "Latch failed"

        # Press Stop (I0.1 = False)
        print("Pressing Stop (Open)...")
        write_input_bit(0, 1, False)
        time.sleep(0.5)

        if not read_output_bit(0, 0):
             print("Stop OK (Motor OFF).")
        else:
             print("Stop Failed (Motor still ON).")
             assert False, "Stop failed"

    except Exception as e:
        print(f"Test Failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        s7_proc.terminate()
        lad_proc.terminate()
        s.close()

if __name__ == "__main__":
    main()
