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

    # Read I0 (Inputs)
    # SHM I0 offset is 0.
    i_byte = shm.mm[0]
    estop = bool(i_byte & 1)
    stop = bool(i_byte & 2)
    start = bool(i_byte & 4)

    # Read Q0 (Outputs)
    # SHM Q0 offset is 65536
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
    <title>LadderLad HMI (Flask+SSE)</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 20px; background: #222; color: #fff; }
        .lamp { width: 60px; height: 60px; border-radius: 50%; border: 4px solid #555; display: inline-block; margin: 20px; background: #444; transition: all 0.2s; }
        .lamp.on { background: #0f0; box-shadow: 0 0 20px #0f0; border-color: #fff; }
        .btn { padding: 20px 40px; font-size: 1.2em; margin: 10px; cursor: pointer; border: none; border-radius: 5px; background: #666; color: #fff; user-select: none; }
        .btn:active { background: #888; transform: translateY(2px); }
        .btn.red { background: #a33; }
        .btn.red:active { background: #c55; }
        .btn.green { background: #383; }
        .btn.green:active { background: #5a5; }
        .panel { background: #333; padding: 20px; border-radius: 10px; display: inline-block; margin-top: 20px; }
        h1 { color: #aaa; }
    </style>
</head>
<body>
    <h1>Motor Control HMI</h1>

    <div class="panel">
        <button class="btn red" onmousedown="set('ESTOP', true)" onmouseup="set('ESTOP', false)" onmouseleave="set('ESTOP', false)">ESTOP</button>
        <button class="btn red" onmousedown="set('STOP', true)" onmouseup="set('STOP', false)" onmouseleave="set('STOP', false)">STOP</button>
        <button class="btn green" onmousedown="set('START', true)" onmouseup="set('START', false)" onmouseleave="set('START', false)">START</button>
    </div>

    <div class="panel">
        <div id="led_run" class="lamp"></div>
        <div>MOTOR RUN</div>
    </div>

    <script>
        function set(key, val) {
            fetch('/api/control', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({[key]: val})
            });
        }

        const evtSource = new EventSource("/api/stream");
        evtSource.onmessage = function(e) {
            const data = JSON.parse(e.data);
            const led = document.getElementById('led_run');
            if (data.outputs.MOTOR) led.classList.add('on');
            else led.classList.remove('on');
        };
    </script>
</body>
</html>
"""

@app.route('/api/control', methods=['POST'])
def control():
    if not shm.connect():
        return {"error": "shm"}, 500

    data = request.json
    # Read-Modify-Write logic on I0 byte
    b = shm.mm[0]

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
    return {"status": "ok"}

@app.route('/api/stream')
def stream():
    def event_stream():
        last_state = None
        while True:
            state = get_state()
            state_str = json.dumps(state)
            if state_str != last_state:
                yield f"data: {state_str}\n\n"
                last_state = state_str
            time.sleep(0.05) # 20Hz update

    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")

if __name__ == "__main__":
    if not shm.connect():
        print("Creating dummy SHM...")

    print("Starting Flask HMI on port 8000...")
    app.run(host='0.0.0.0', port=8000, threaded=True)
