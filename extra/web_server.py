"""
Z7 Web Server - Web UI for the z7 PLC simulator library.
Communicates with the z7 DLL, provides start/stop, logging, monitoring,
and memory dump/load with compression.
"""
import ctypes
import os
import sys
import time
import gzip
import json
import struct
import threading
import queue
from io import BytesIO
from datetime import datetime
from collections import deque

from flask import (
    Flask, request, jsonify, send_file, Response, render_template_string
)

# ---------------------------------------------------------------------------
# Z7 Client (enhanced from extra/client.py)
# ---------------------------------------------------------------------------

class Context(ctypes.Structure):
    pass

# Event types from Zig
EVT_PLC_STOP_REQUEST = 1
EVT_PLC_START_REQUEST = 2
EVT_CLIENT_CONNECTED = 3
EVT_CLIENT_DISCONNECTED = 4

EVENT_NAMES = {
    EVT_PLC_STOP_REQUEST: "plc_stop_request",
    EVT_PLC_START_REQUEST: "plc_start_request",
    EVT_CLIENT_CONNECTED: "client_connected",
    EVT_CLIENT_DISCONNECTED: "client_disconnected",
}

LOG_LEVELS = {0: "ERROR", 1: "WARN", 2: "INFO", 3: "DEBUG"}

class Z7Client:
    """Enhanced Z7 DLL wrapper with event and log callbacks."""

    def __init__(self, dll_path, port=102, storage_path=None, max_logs=2000):
        if not os.path.exists(dll_path):
            raise FileNotFoundError(f"DLL not found at {dll_path}")

        self.lib = ctypes.CDLL(dll_path)
        self._setup_bindings()

        self.log_buffer = deque(maxlen=max_logs)
        self.event_queue = queue.Queue(maxsize=500)
        self._mode = "STOP"
        self._clients_connected = 0
        self._lock = threading.Lock()

        # Install callbacks (prevent GC)
        self._log_cb = self._LOG_CB_TYPE(self._on_log)
        self.lib.z7_set_log_callback(self._log_cb)

        self._evt_cb = self._EVT_CB_TYPE(self._on_event)
        self.lib.z7_set_event_callback(self._evt_cb)

        c_path = storage_path.encode("utf-8") if storage_path else None
        self.ctx = self.lib.z7_init(port, c_path)
        if not self.ctx:
            raise RuntimeError("z7_init failed")

    # -- binding setup -------------------------------------------------------

    def _setup_bindings(self):
        CB = ctypes.CFUNCTYPE(None, ctypes.c_uint8, ctypes.c_char_p, ctypes.c_size_t)
        self._LOG_CB_TYPE = CB
        self._EVT_CB_TYPE = CB

        self.lib.z7_set_log_callback.argtypes = [CB]
        self.lib.z7_set_log_callback.restype = None
        self.lib.z7_set_event_callback.argtypes = [CB]
        self.lib.z7_set_event_callback.restype = None

        self.lib.z7_init.argtypes = [ctypes.c_uint16, ctypes.c_char_p]
        self.lib.z7_init.restype = ctypes.POINTER(Context)
        self.lib.z7_deinit.argtypes = [ctypes.POINTER(Context)]
        self.lib.z7_deinit.restype = None

        self.lib.z7_start.argtypes = [ctypes.POINTER(Context)]
        self.lib.z7_start.restype = None
        self.lib.z7_stop.argtypes = [ctypes.POINTER(Context)]
        self.lib.z7_stop.restype = None

        self.lib.z7_get_status.argtypes = [ctypes.POINTER(Context)]
        self.lib.z7_get_status.restype = ctypes.c_uint8

        self.lib.z7_get_memory_ptr.argtypes = [ctypes.POINTER(Context)]
        self.lib.z7_get_memory_ptr.restype = ctypes.POINTER(ctypes.c_uint8)
        self.lib.z7_get_memory_size.argtypes = [ctypes.POINTER(Context)]
        self.lib.z7_get_memory_size.restype = ctypes.c_size_t

        self.lib.z7_read.argtypes = [
            ctypes.POINTER(Context), ctypes.c_uint8, ctypes.c_uint16,
            ctypes.c_uint32, ctypes.c_uint32, ctypes.POINTER(ctypes.c_uint8),
        ]
        self.lib.z7_read.restype = ctypes.c_int32
        self.lib.z7_write.argtypes = [
            ctypes.POINTER(Context), ctypes.c_uint8, ctypes.c_uint16,
            ctypes.c_uint32, ctypes.c_uint32, ctypes.POINTER(ctypes.c_uint8),
        ]
        self.lib.z7_write.restype = ctypes.c_int32

    # -- callbacks -----------------------------------------------------------

    def _on_log(self, level, msg_ptr, msg_len):
        msg = ctypes.string_at(msg_ptr, msg_len).decode("utf-8", errors="replace")
        entry = {
            "ts": datetime.now().isoformat(timespec="milliseconds"),
            "level": LOG_LEVELS.get(level, "UNKNOWN"),
            "msg": msg,
        }
        self.log_buffer.append(entry)
        # Also push to SSE
        try:
            self.event_queue.put_nowait({"type": "log", "data": entry})
        except queue.Full:
            pass

    def _on_event(self, event_type, detail_ptr, detail_len):
        detail = ctypes.string_at(detail_ptr, detail_len).decode("utf-8", errors="replace")
        name = EVENT_NAMES.get(event_type, f"unknown_{event_type}")

        with self._lock:
            if event_type == EVT_PLC_STOP_REQUEST:
                self._mode = "STOP"
            elif event_type == EVT_PLC_START_REQUEST:
                self._mode = "RUN"
            elif event_type == EVT_CLIENT_CONNECTED:
                self._clients_connected += 1
            elif event_type == EVT_CLIENT_DISCONNECTED:
                self._clients_connected = max(0, self._clients_connected - 1)

        evt = {"type": "event", "data": {"event": name, "detail": detail,
               "ts": datetime.now().isoformat(timespec="milliseconds")}}
        try:
            self.event_queue.put_nowait(evt)
        except queue.Full:
            pass

    # -- public API ----------------------------------------------------------

    def start(self):
        self.lib.z7_start(self.ctx)
        with self._lock:
            self._mode = "RUN"

    def stop(self):
        self.lib.z7_stop(self.ctx)
        with self._lock:
            self._mode = "STOP"

    def close(self):
        if self.ctx:
            self.lib.z7_deinit(self.ctx)
            self.ctx = None

    @property
    def is_running(self):
        return bool(self.lib.z7_get_status(self.ctx))

    @property
    def mode(self):
        with self._lock:
            return self._mode

    @property
    def leds(self):
        m = self.mode
        return {
            "run": "green" if m == "RUN" else "off",
            "error": "off",
            "maint": "off",
        }

    def read(self, area, db_num, start, length):
        buf = (ctypes.c_uint8 * length)()
        res = self.lib.z7_read(self.ctx, area, db_num, start, length, buf)
        if res != 0:
            raise RuntimeError(f"z7_read failed ({res})")
        return bytearray(buf)

    def write(self, area, db_num, start, data):
        length = len(data)
        c_data = (ctypes.c_uint8 * length)(*data)
        res = self.lib.z7_write(self.ctx, area, db_num, start, length, c_data)
        if res != 0:
            raise RuntimeError(f"z7_write failed ({res})")

    def dump_memory(self):
        """Return gzipped full address space."""
        ptr = self.lib.z7_get_memory_ptr(self.ctx)
        size = self.lib.z7_get_memory_size(self.ctx)
        raw = ctypes.string_at(ptr, size)
        buf = BytesIO()
        with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=6) as gz:
            gz.write(raw)
        return buf.getvalue()

    def load_memory(self, compressed_data):
        """Load gzipped memory dump back into address space."""
        raw = gzip.decompress(compressed_data)
        ptr = self.lib.z7_get_memory_ptr(self.ctx)
        size = self.lib.z7_get_memory_size(self.ctx)
        to_copy = min(len(raw), size)
        ctypes.memmove(ptr, raw, to_copy)

    def get_logs(self):
        return list(self.log_buffer)


# ---------------------------------------------------------------------------
# Flask App
# ---------------------------------------------------------------------------

app = Flask(__name__)
CLIENT: Z7Client = None


def _get_html():
    """Return the single-page HTML UI."""
    html_path = os.path.join(os.path.dirname(__file__), "web_ui.html")
    with open(html_path, "r", encoding="utf-8") as f:
        return f.read()


@app.route("/")
def index():
    return _get_html()


# -- Status & Control -------------------------------------------------------

@app.route("/api/status")
def api_status():
    return jsonify({
        "name": "Z7-PLC Simulator",
        "ip": "127.0.0.1",
        "mode": CLIENT.mode,
        "running": CLIENT.is_running,
        "leds": CLIENT.leds,
        "clients": CLIENT._clients_connected,
    })


@app.route("/api/control/start", methods=["POST"])
def api_start():
    CLIENT.start()
    return jsonify({"status": "ok", "mode": "RUN"})


@app.route("/api/control/stop", methods=["POST"])
def api_stop():
    CLIENT.stop()
    return jsonify({"status": "ok", "mode": "STOP"})


# -- Logs -------------------------------------------------------------------

@app.route("/api/logs")
def api_logs():
    return jsonify(CLIENT.get_logs())


@app.route("/api/logs/download")
def api_logs_download():
    logs = CLIENT.get_logs()
    text = "\n".join(f"{l['ts']} [{l['level']}] {l['msg']}" for l in logs)
    buf = BytesIO(text.encode("utf-8"))
    return send_file(buf, mimetype="text/plain", download_name="z7_logs.txt")


# -- Monitor (variable read) -----------------------------------------------

@app.route("/api/monitor", methods=["POST"])
def api_monitor():
    """Read one or more addresses. Accepts JSON list or single object."""
    data = request.get_json(force=True)
    items = data if isinstance(data, list) else [data]
    results = []
    for item in items:
        addr = item.get("address", "")
        fmt = item.get("format", "DEC")
        val = _read_address(addr, fmt)
        results.append({"address": addr, "value": val, "format": fmt})
    return jsonify(results)


def _read_address(address: str, fmt: str = "DEC"):
    """Parse an S7-style address and read from z7."""
    try:
        if address.upper().startswith("DB"):
            parts = address.split(".")
            db_num = int(parts[0][2:])
            var = parts[1].upper() if len(parts) > 1 else "DBB0"
            if var.startswith("DBD"):
                off = int(var[3:]); raw = CLIENT.read(0x84, db_num, off, 4)
                return _format_val(struct.unpack(">I", raw)[0], fmt)
            elif var.startswith("DBW"):
                off = int(var[3:]); raw = CLIENT.read(0x84, db_num, off, 2)
                return _format_val(struct.unpack(">H", raw)[0], fmt)
            elif var.startswith("DBB"):
                off = int(var[3:]); raw = CLIENT.read(0x84, db_num, off, 1)
                return _format_val(raw[0], fmt)
        elif address.upper().startswith("MW"):
            off = int(address[2:]); raw = CLIENT.read(0x83, 0, off, 2)
            return _format_val(struct.unpack(">H", raw)[0], fmt)
        elif address.upper().startswith("MB"):
            off = int(address[2:]); raw = CLIENT.read(0x83, 0, off, 1)
            return _format_val(raw[0], fmt)
        elif address.upper().startswith("MD"):
            off = int(address[2:]); raw = CLIENT.read(0x83, 0, off, 4)
            return _format_val(struct.unpack(">I", raw)[0], fmt)
        elif address.upper().startswith("IB"):
            off = int(address[2:]); raw = CLIENT.read(0x81, 0, off, 1)
            return _format_val(raw[0], fmt)
        elif address.upper().startswith("QB"):
            off = int(address[2:]); raw = CLIENT.read(0x82, 0, off, 1)
            return _format_val(raw[0], fmt)
        return "N/A"
    except Exception as e:
        return f"ERR:{e}"


def _format_val(val, fmt):
    if fmt == "HEX":
        return f"0x{val:X}"
    elif fmt == "BIN":
        return bin(val)
    return str(val)


# -- Memory Dump / Load (gzipped) ------------------------------------------

@app.route("/api/memory/dump")
def api_memory_dump():
    data = CLIENT.dump_memory()
    buf = BytesIO(data)
    return send_file(buf, mimetype="application/gzip",
                     download_name="z7_memory.bin.gz")


@app.route("/api/memory/load", methods=["POST"])
def api_memory_load():
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "No file uploaded"}), 400
    try:
        CLIENT.load_memory(f.read())
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -- SSE (Server-Sent Events) for real-time push ----------------------------

@app.route("/api/events")
def api_events():
    def stream():
        while True:
            try:
                evt = CLIENT.event_queue.get(timeout=15)
                yield f"data: {json.dumps(evt)}\n\n"
            except queue.Empty:
                yield ": keepalive\n\n"
    return Response(stream(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Z7 Web Server")
    parser.add_argument("--dll", default=None, help="Path to z7.dll / libz7.so")
    parser.add_argument("--port", type=int, default=102, help="S7 listen port")
    parser.add_argument("--web-port", type=int, default=8080, help="HTTP port")
    parser.add_argument("--storage", default=None, help="Storage file path")
    args = parser.parse_args()

    dll = args.dll
    if dll is None:
        dll = os.path.join(os.path.dirname(__file__), "..", "zig-out", "bin", "z7.dll")
        if os.name != "nt":
            dll = os.path.join(os.path.dirname(__file__), "..", "zig-out", "lib", "libz7.so")
    dll = os.path.abspath(dll)

    global CLIENT
    print(f"[Z7 Web] Loading DLL: {dll}")
    CLIENT = Z7Client(dll, port=args.port, storage_path=args.storage)
    print(f"[Z7 Web] S7 server on port {args.port}")
    print(f"[Z7 Web] Web UI at http://127.0.0.1:{args.web_port}")

    import logging
    log = logging.getLogger("werkzeug")
    log.setLevel(logging.WARNING)

    try:
        app.run(host="0.0.0.0", port=args.web_port, threaded=True)
    except KeyboardInterrupt:
        pass
    finally:
        CLIENT.stop()
        CLIENT.close()
        print("[Z7 Web] Shutdown complete.")


if __name__ == "__main__":
    main()
