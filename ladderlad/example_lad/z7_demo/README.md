# Z7 Demo

This demo simulates a PLC running a Motor Start/Stop logic, controlled via an S7 Client (Deno web server/HMI).

## Components

1.  **`mock_z7_server.py`**: Simulates an S7 PLC.
    -   Creates shared memory file `s7_plc_shm`.
    -   Listens on TCP port 1102 (S7 Protocol).
    -   Handles Read/Write Variable requests.
2.  **`ladder_runner.py`**: Runs the PLC logic.
    -   Parses `motor.lad` (ASCII Ladder Logic).
    -   Connects to `s7_plc_shm`.
    -   Cyclically reads inputs, executes logic, writes outputs.
3.  **`server.ts`** (Deno): Web Server & HMI Backend.
    -   Connects to S7 Server (mock) to send commands.
    -   Reads `s7_plc_shm` directly to stream status via SSE.
    -   Serves `index.html`.

## Prerequisites

-   Python 3.x
-   Deno (for the web server/HMI)
-   Linux (for `/dev/shm` or standard `mmap` behavior)

## Running

Run the launcher:

```bash
python3 launcher.py
```

Then open `http://localhost:8000` in your browser.

## Logic

-   **Start Button (I0.0)**: Starts the motor.
-   **Stop Button (I0.1)**: Stops the motor (NC contact logic: False = Pressed).
-   **Motor (Q0.0)**: Output coil.

The logic includes a latching circuit.

## Verification

To verify the backend logic without Deno:

```bash
python3 verify_demo.py
```
