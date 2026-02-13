# Z7 Web Server

A web-based control panel for the Z7 S7-compatible PLC simulator.

## Features

- **Start / Stop** the PLC from the browser
- **Real-time logs** streamed via SSE (Server-Sent Events) — no polling
- **Event notifications** when S7 clients connect, disconnect, or send stop/start commands
- **Variable monitor** — watch addresses like `DB1.DBW0`, `MW0`, `IB0` with configurable format (DEC/HEX/BIN)
- **Memory dump/load** — download/upload the full address space as a gzipped file
- **LED indicators** reflecting PLC state
- **Self-cleaning log buffer** (oldest entries removed after 2000 lines)

## Requirements

```
pip install flask
```

## Usage

```bash
# From the project root (after building with `zig build`):
python extra/web_server.py

# With options:
python extra/web_server.py --dll zig-out/bin/z7.dll --port 102 --web-port 8080
```

Then open **http://127.0.0.1:8080** in your browser.

## CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--dll` | `zig-out/bin/z7.dll` | Path to the z7 DLL |
| `--port` | `102` | S7 protocol listen port |
| `--web-port` | `8080` | Web UI HTTP port |
| `--storage` | `None` | Storage file path (shared memory backing) |

## Architecture

```
┌─────────────┐    SSE/REST     ┌──────────────┐    ctypes/FFI    ┌──────────┐
│  Browser UI │ ◄──────────────►│  Flask Server │ ◄──────────────►│  z7.dll  │
│  (web_ui.html)                │  (web_server.py)                │  (Zig)   │
└─────────────┘                 └──────────────┘                  └──────────┘
                                      ▲                                 │
                                      │ Event callback (from Zig thread)│
                                      └─────────────────────────────────┘
```

- **Log callback**: Zig calls Python when `std.log` emits a message → stored in a `deque` ring buffer
- **Event callback**: Zig calls Python when S7 clients send stop/start or connect/disconnect
- **SSE**: Python pushes log/event data to all connected browsers in real-time
- **Monitor**: Browser polls `/api/monitor` every ~1s for watched variable values
- **Dump/Load**: Full memory region is accessed via `z7_get_memory_ptr` / `z7_get_memory_size` and compressed with gzip
