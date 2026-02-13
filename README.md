# z7 - ZalW S7 PLC Server


```
# Build for Linux
zig build -Dtarget=x86_64-linux-musl

zig build run -- --port 10202

# Run on a non-privileged port
./z7 --port 10202
```

## Python

Look at extra:
- plc logic (that writes to shm)
- client (handler, that's more like a server)

Look at tests:
- plc_control_test.py (tests plc control)
- mirror_test.py (tests plc logic)

extra/client.py is the base to create your own server.

Important ! you need to run plc_logic in the same folder as your z7.exe server (to access the s7_plc_shm file)

Expected output:

```
zig-out\bin>python ..\..\extra\plc_logic.py
--- Python PLC Logic Program ---
Attached to PLC Memory (Size: 8716288 bytes)
Running logic loop...
  - Incrementing DB1.DBD0 (Heartbeat)
  - Mirroring IB0 to QB0 (Input Byte 0 -> Output Byte 0)
[Cycle] DB1.DBD0=2868906940 IB0=0x99 => QB0=0x99
```

```
\TESTS>python mirror_test.py
--- Mirror Logic Test ---
Connected.
Read QB0: 0x42
Read QB0: 0x99
PASS: Mirror Register Logic Verified!
```
