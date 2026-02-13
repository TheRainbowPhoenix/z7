# Concurrent PLC Demo

This demo simulates a PLC environment with two concurrent processes sharing the same memory:

1.  **`z7` Server (The "PLC Firmware")**:
    *   Manages the memory (Datablocks, Inputs, Outputs).
    *   Exposes the memory over TCP (S7 Protocol) on port 10202.
    *   This allows external HMI/SCADA/Programming clients to connect.

2.  **`plc_logic.py` (The "PLC Program")**:
    *   Connects directly to the memory via shared memory file (`s7_plc_shm`).
    *   Executes logic loops: reading inputs, processing, writing outputs/DBs.
    *   This represents the user code running inside the PLC.

## Setup

1.  **Build the Server**:
    ```bash
    zig build
    ```

## Running the Demo

### Step 1: Start the Server (Terminal 1)
Run the standalone server. This creates the shared memory file `s7_plc_shm`.

```bash
# Windows (PowerShell)
.\zig-out\bin\z7.exe --port 10202

# Linux
./zig-out/bin/z7 --port 10202
```

### Step 2: Start the Logic Program (Terminal 2)
Run the Python script. It will detect the shared memory file and start processing.

```bash
# Windows
python extra/plc_logic.py
```

You should see output indicating it is running cycles, incrementing a counter in DB1 and mirroring IB0 to QB0.

### Step 3: Verify Interaction (Automated Test)
Run the automated test script to verify the mirror logic (IB0 -> QB0).

```bash
python TESTS/mirror_test.py
```

It connects to the server, writes to IB0, and asserts that QB0 updates to match.

### Step 4: Verify Interaction (Manual - Optional)
You can use the Python *client* (which uses the DLL/SO) or any S7 tool to verify the values are changing.

**Using `client.py` to inspect memory:**
(Modify `client.py` or write a quick script to just read DB1.DBD0)

```python
# quick_read.py
from client import Z7Client
import time
client = Z7Client("zig-out/bin/z7.dll", port=10205) # Use different port!
client.start()
time.sleep(1)
print(f"DB1.DBD0: {client.read(0x84, 1, 0, 4).hex()}")
client.stop()
```

Or observe that the `plc_logic.py` output updates.

## How it Works
Both processes map the same file `s7_plc_shm` into their address space. The OS handles memory coherence.
- `z7.exe` treats it as the backing store for its S7 server state.
- `plc_logic.py` treats it as raw memory to read sensors (Inputs) and drive actuators (Outputs).
