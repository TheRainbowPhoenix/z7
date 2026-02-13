# z7 Python Client

This directory contains a Python client for the z7 PLC simulator, allowing direct control and memory access via a shared library.

## Prerequisites

- Build the project to generate the shared library:
  ```bash
  zig build
  ```
  This creates `zig-out/bin/z7.dll` (Windows) or `zig-out/lib/libz7.so` (Linux).

## Usage

Use `client.py` to interface with the simulator.

```python
from client import Z7Client
import time

# Initialize client (loads DLL)
# Adjust DLL path as needed
client = Z7Client("../../zig-out/bin/z7.dll", port=10202)

# Start the simulator in a background thread
client.start()

# Read/Write memory
# Area codes:
# 0x81: Inputs
# 0x82: Outputs
# 0x83: Merkers (Flags)
# 0x84: Data Blocks (DB)
# 0x1C: Counters
# 0x1D: Timers

# Write 4 bytes to DB 1, offset 0
client.write(0x84, 1, 0, b'\x01\x02\x03\x04')

# Read 4 bytes from DB 1, offset 0
data = client.read(0x84, 1, 0, 4)
print(data.hex())

# Stop the simulator
client.stop()
client.close()
```

## Features

- **Start/Stop**: Control the simulator lifecycle.
- **Logs**: Capture simulator logs in Python.
- **Direct Memory Access**: Read/Write PLC memory areas (DB, inputs, outputs, etc.) without network overhead.
- **S7 Server**: The simulator still listens on the configured TCP port (default 10202) for standard S7 clients.
