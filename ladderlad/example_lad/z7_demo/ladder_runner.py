import time
import os
import sys

# Add repo root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

from ladderlad.engine import LadderEngine
from ladderlad.simulator import Simulator
from ladderlad.shm_interface import SHMInterface

LAD_FILE = os.path.join(os.path.dirname(__file__), "motor.lad")

def map_inputs_from_shm(shm: SHMInterface, sim: Simulator):
    # Map Input Byte 0 (I0.x)
    for bit in range(8):
        val = shm.read_input_bit(0, bit)
        sim.set_variable(f"I0.{bit}", val)

def map_outputs_to_shm(shm: SHMInterface, sim: Simulator):
    # Map Output Byte 0 (Q0.x)
    for bit in range(8):
        val = sim.get_variable(f"Q0.{bit}")
        # Ensure it is bool
        val = bool(val)
        shm.write_output_bit(0, bit, val)

def main():
    print(f"Loading ladder logic from {LAD_FILE}...")
    try:
        with open(LAD_FILE, 'r') as f:
            schematic = f.read()
    except FileNotFoundError:
        print(f"Error: {LAD_FILE} not found.")
        return

    engine = LadderEngine()
    instructions = engine.compile(schematic)
    sim = Simulator()

    # Initialize variables
    sim.set_variable("I0.0", False) # Start
    sim.set_variable("I0.1", True)  # Stop (NC default)
    sim.set_variable("Q0.0", False) # Motor

    print("Connecting to SHM...")
    shm = SHMInterface()
    if not shm.connect():
        print("Failed to connect to SHM. creating dummy...")
        # Should be handled by SHMInterface internal logic

    print("Running PLC Logic Loop (Press Ctrl+C to stop)...")
    try:
        cycle_count = 0
        while True:
            cycle_start = time.time()

            # 1. Read Inputs
            map_inputs_from_shm(shm, sim)

            # 2. Execute Logic
            sim.run(instructions)

            # 3. Write Outputs
            map_outputs_to_shm(shm, sim)

            cycle_count += 1
            if cycle_count % 100 == 0:
                motor = sim.get_variable("Q0.0")
                start = sim.get_variable("I0.0")
                stop = sim.get_variable("I0.1")
                # print(f"Cycle {cycle_count}: Start={start}, Stop={stop}, Motor={motor}")

            # 4. Sleep to simulate scan time (10ms)
            elapsed = time.time() - cycle_start
            sleep_time = max(0, 0.010 - elapsed)
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        print("\nStopping PLC Logic Loop.")
    finally:
        shm.close()

if __name__ == "__main__":
    main()
