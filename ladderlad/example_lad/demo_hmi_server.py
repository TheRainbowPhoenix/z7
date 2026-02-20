import sys
sys.path.insert(0, '.')
import time
import json
import threading
from flask import Flask, Response, request, stream_with_context
from ladderlad.shm_interface import SHMInterface

app = Flask(__name__)
shm = SHMInterface()

def get_state():
    if not shm.connect():
        return {}

    i_byte = shm.mm[0]
    estop = bool(i_byte & 1)
    stop = bool(i_byte & 2)
    start = bool(i_byte & 4)

    q_byte = shm.mm[65536]
    run = bool(q_byte & 1)
    motor = bool(q_byte & 2)

    return {
        "inputs": {"ESTOP": estop, "STOP": stop, "START": start},
        "outputs": {"RUN": run, "MOTOR": motor}
    }

@app.route('/')
def index():
    return """
<!DOCTYPE html>
<html>
<head>
    <title>LadderLad HMI</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 20px; background: #222; color: #fff; }
        .lamp { width: 60px; height: 60px; border-radius: 50%; border: 4px solid #555; display: inline-block; margin: 20px; background: #444; transition: all 0.1s; }
        .lamp.on { background: #0f0; box-shadow: 0 0 20px #0f0; border-color: #fff; }
        .btn { padding: 20px 40px; font-size: 1.2em; margin: 10px; cursor: pointer; border: none; border-radius: 5px; background: #666; color: #fff; user-select: none; }
        .btn:active { transform: translateY(2px); }
        .btn:disabled { background: #444; color: #888; cursor: not-allowed; transform: none; }
        .btn.red { background: #a33; }
        .btn.green { background: #383; }
        .log { margin-top: 20px; font-family: monospace; font-size: 0.8em; color: #aaa; }
        .panel { background: #333; padding: 20px; border-radius: 10px; display: inline-block; margin-top: 20px; }
    </style>
</head>
<body>
    <h1>Motor Control HMI</h1>

    <div class="panel">
        <!-- Using custom handlers to prevent multi-firing and handle async ack -->
        <button id="btn_estop" class="btn red" onmousedown="press('ESTOP')" onmouseup="release('ESTOP')" onmouseleave="release('ESTOP')">ESTOP</button>
        <button id="btn_stop" class="btn red" onmousedown="press('STOP')" onmouseup="release('STOP')" onmouseleave="release('STOP')">STOP</button>
        <button id="btn_start" class="btn green" onmousedown="press('START')" onmouseup="release('START')" onmouseleave="release('START')">START</button>
    </div>

    <div class="panel">
        <div id="led_run" class="lamp"></div>
        <div>MOTOR RUN</div>
    </div>

    <div id="log" class="log"></div>

    <script>
        const state = { ESTOP: false, STOP: false, START: false };

        function log(msg) {
            const el = document.getElementById('log');
            el.innerText = msg;
        }

        async function send(key, val) {
            const btn = document.getElementById('btn_' + key.toLowerCase());
            // btn.disabled = true; // Don't disable on press, hinders release?
            // Disable only prevents new clicks. But we need mouseup.
            // Let's just track pending state.

            log(`Sending ${key}=${val}...`);
            try {
                const resp = await fetch('/api/control', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({[key]: val})
                });
                const res = await resp.json();
                log(`Ack ${key}=${val} (${res.status})`);
            } catch (e) {
                log(`Error ${key}=${val}: ${e}`);
            } finally {
                // btn.disabled = false;
            }
        }

        function press(key) {
            if (state[key]) return; // Already pressed
            state[key] = true;
            send(key, true);
        }

        function release(key) {
            if (!state[key]) return; // Already released
            state[key] = false;
            send(key, false);
        }

        const evtSource = new EventSource("/api/stream");
        evtSource.onmessage = function(e) {
            const data = JSON.parse(e.data);
            const led = document.getElementById('led_run');
            if (data.outputs.MOTOR) led.classList.add('on');
            else led.classList.remove('on');
        };
        evtSource.onerror = function(e) {
            log("SSE Error/Reconnecting...");
        };
    </script>
</body>
</html>
"""

@app.route('/api/control', methods=['POST'])
def control():
    if not shm.connect():
        print("SHM Connect Failed in Control")
        return {"error": "shm"}, 500

    data = request.json
    print(f"Control Request: {data}")

    try:
        b = shm.mm[0]
        original_b = b

        if "ESTOP" in data:
            if data["ESTOP"]: b |= 1
            else: b &= ~1

        if "STOP" in data:
            if data["STOP"]: b |= 2
            else: b &= ~2

        if "START" in data:
            if data["START"]: b |= 4
            else: b &= ~4

        shm.mm[0] = b
        print(f"SHM Write: 0x{original_b:02X} -> 0x{b:02X}")

    except Exception as e:
        print(f"SHM Write Error: {e}")
        return {"error": str(e)}, 500

    return {"status": "ok", "ib0": b}

@app.route('/api/stream')
def stream():
    def event_stream():
        last_state = None
        while True:
            try:
                state = get_state()
                state_str = json.dumps(state)
                if state_str != last_state:
                    yield f"data: {state_str}\n\n"
                    last_state = state_str
            except Exception as e:
                print(f"Stream Error: {e}")
            time.sleep(0.05)

    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")

if __name__ == "__main__":
    if not shm.connect():
        print("Creating dummy SHM...")

    print("Starting Flask HMI on port 8000...")
    # Threaded=True is default in recent Flask but explicit helps.
    app.run(host='0.0.0.0', port=8000, threaded=True)
