import sys
sys.path.insert(0, '.')
import http.server
import socketserver
import json
from urllib.parse import urlparse, parse_qs
from ladderlad.shm_interface import SHMInterface

PORT = 8000
shm = SHMInterface()

class HMIHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/status":
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()

            if not shm.connect():
                self.wfile.write(b'{"error": "shm"}')
                return

            estop = shm.read_input_bit(0, 0)
            stop = shm.read_input_bit(0, 1)
            start = shm.read_input_bit(0, 2)
            run = shm.read_output_bit(0, 0) # Q0.0 is offset 0?
            # SHMInterface doesn't have read_output_bit, assuming write-only?
            # It maps mmap, so we can read outputs from offset.
            # Implement read_output_bit here or use raw.
            # shm.mm[OFFSET_OUTPUTS + 0] & 1
            # OFFSET_OUTPUTS = 65536
            offset = 65536
            q_byte = shm.mm[offset]
            run = bool(q_byte & 1)
            motor = bool(q_byte & 2)

            status = {
                "inputs": {"ESTOP": estop, "STOP": stop, "START": start},
                "outputs": {"RUN": run, "MOTOR": motor}
            }
            self.wfile.write(json.dumps(status).encode())

        elif parsed.path == "/":
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(HTML_CONTENT.encode())
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/control":
            length = int(self.headers.get('content-length', 0))
            data = self.rfile.read(length).decode()
            params = json.loads(data)

            if not shm.connect():
                self.send_response(500)
                self.end_headers()
                return

            # Simulate button press by forcing Input
            # In real system, inputs come from HW. Here HMI acts as HW.
            if "ESTOP" in params:
                val = params["ESTOP"]
                # Read current byte to preserve others?
                # Write_input_bit helper? shm has read_input_bit.
                # Need write_input_bit for simulation.
                # Or read-modify-write manually.
                # OFFSET_INPUTS = 0
                b = shm.mm[0]
                if val: b |= 1
                else: b &= ~1
                shm.mm[0] = b

            if "STOP" in params:
                val = params["STOP"]
                b = shm.mm[0]
                if val: b |= 2
                else: b &= ~2
                shm.mm[0] = b

            if "START" in params:
                val = params["START"]
                b = shm.mm[0]
                if val: b |= 4
                else: b &= ~4
                shm.mm[0] = b

            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')

HTML_CONTENT = """
<!DOCTYPE html>
<html>
<head>
    <title>LadderLad HMI</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 20px; }
        .lamp { width: 50px; height: 50px; border-radius: 50%; border: 2px solid #333; display: inline-block; margin: 10px; background: #ddd; }
        .lamp.on { background: #0f0; box-shadow: 0 0 10px #0f0; }
        .btn { padding: 15px 30px; font-size: 1.2em; margin: 10px; cursor: pointer; }
        .btn.active { background: #ccc; }
    </style>
</head>
<body>
    <h1>Motor Control HMI</h1>

    <div>
        <h3>Inputs</h3>
        <button class="btn" onmousedown="set('ESTOP', true)" onmouseup="set('ESTOP', false)">ESTOP</button>
        <button class="btn" onmousedown="set('STOP', true)" onmouseup="set('STOP', false)">STOP</button>
        <button class="btn" onmousedown="set('START', true)" onmouseup="set('START', false)">START</button>
    </div>

    <div>
        <h3>Outputs</h3>
        <div id="led_run" class="lamp"></div> <br>MOTOR RUN
    </div>

    <script>
        function set(key, val) {
            fetch('/api/control', {
                method: 'POST',
                body: JSON.stringify({[key]: val})
            });
        }

        setInterval(() => {
            fetch('/api/status').then(r => r.json()).then(data => {
                const led = document.getElementById('led_run');
                if (data.outputs.MOTOR) led.classList.add('on');
                else led.classList.remove('on');
            });
        }, 200);
    </script>
</body>
</html>
"""

if __name__ == "__main__":
    if not shm.connect():
        print("Creating dummy SHM for server...")

    with socketserver.TCPServer(("", PORT), HMIHandler) as httpd:
        print(f"HMI Server running at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        shm.close()
