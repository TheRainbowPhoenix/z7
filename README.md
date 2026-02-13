# z7 - ZalW S7 PLC Server

<img width="1278" height="824" alt="image" src="https://github.com/user-attachments/assets/b5fb0f4a-c6fe-463c-9b16-a74b2bde3ee2" />

A lightweight S7-compatible server you can hack upon. 
Provide multiples demos, alongside a webserver and a python-scripting "plc" task. 
Native library, standalone barebone server, shm backed memory structure (so you can write in any programming language without libraries)
Windows and Linux, including musl (Alpine).
Tested with various S7 clients, including Ignition Siemens driver.

To run it, grab the exe or binary in the releases and enjoy.

## Command line arguments

- `--port 1102`: Run on non standard port (1102 for example) (can help on Windows or Linux to run as non privileged process)
- `--errors`: Log only errors, so console would be fairly empty
- `--verbose`: Log client connects and szl queries
- `--debug`: Log every query, so console would get spammed
- `--max-dbs`: Maximum count of DB avaiable. Default is 2048 (file size is about 128Mb). Tweak it up or down depending on your ram available.
- `--log-file z7-log.txt`: Log to a file (7z-log.txt) with the provided configuration

## Use the web UI

A better UI would be built at some point. Right now, you need python 3.10+ and do :
```
pip install Flask
python extra/web_server.py
```
and then go to http://127.0.0.1:8080

Note that it would create the s7_plc_shm (shared plc data) on the directory you're working in.
You can also run the `plc_logic.py` : `python extra/plc_logic.py` to simulate a basic task that would increment counter and copy `IB0 => QB0` when changed.

## Notes for linux devs

Build manually for Linux
```
zig build -Dtarget=x86_64-linux-musl

zig build run -- --port 10202

# Run on a non-privileged port
./z7 --port 1102
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

## Code test

```
zig test src/z7/storage.zig
./z7 --max-dbs 500
```
