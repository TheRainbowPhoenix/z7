import sys
import tty
import termios
import time
import os
from ladderlad.engine import LadderEngine
from ladderlad.simulator import Simulator

def get_char():
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(sys.stdin.fileno())
        ch = sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    return ch

def main():
    schematic = (
        "||--[/ESTOP]----[/STOP]----+--[START]--+----(RUN)--||\n" +
        "||                         |           |           ||\n" +
        "||                         +--[RUN]----+           ||\n" +
        "||                                                 ||\n" +
        "||--[RUN]----(MOTOR)-------------------------------||"
    )

    engine = LadderEngine()
    instructions = engine.compile(schematic)
    sim = Simulator()

    # Initial state
    inputs = {"ESTOP": False, "STOP": False, "START": False}

    print("\033[2J") # Clear screen

    while True:
        # Update simulator inputs
        for k, v in inputs.items():
            sim.set_variable(k, v)

        # Run simulation
        sim.run(instructions)

        # Render
        # We need to access the simulator's trace.
        # But `Simulator.run` overwrites trace.
        trace = sim.trace

        # Render text with colors
        # LadderEngine.decompile doesn't accept trace yet?
        # We modified `TextRenderer.render` to accept trace.
        # But `LadderEngine.decompile` signature is `decompile(self, instructions: List[List[Any]]) -> str`.
        # We need to bypass or update Engine.
        # Let's call renderer directly for trace.
        rendered = engine.renderer.render(instructions, trace)

        # Display
        print("\033[H", end="") # Home cursor
        print("Interactive Latch Demo (Press q to quit)")
        print("Controls: 1=ESTOP, 2=STOP, 3=START (Toggle)")
        print("-" * 40)
        print(f"Inputs: ESTOP={inputs['ESTOP']} STOP={inputs['STOP']} START={inputs['START']}")
        print(f"Outputs: RUN={sim.get_variable('RUN')} MOTOR={sim.get_variable('MOTOR')}")
        print("-" * 40)
        print(rendered)
        print("-" * 40)

        # Non-blocking input check would be better for "realtime",
        # but pure python non-blocking console input is tricky without curses.
        # We will use blocking input for simplicity as requested "avoid nurses if possible".
        # "until I press q... simulate it realtime".
        # If blocking, it's not realtime simulation (simulation stops waiting for input).
        # To make it realtime, we need non-blocking input or thread.
        # Let's use a simple timeout or check if input available.
        # `select` can do this.

        import select
        if select.select([sys.stdin], [], [], 0.1)[0]:
            ch = get_char()
            if ch == 'q':
                break
            elif ch == '1':
                inputs["ESTOP"] = not inputs["ESTOP"]
            elif ch == '2':
                inputs["STOP"] = not inputs["STOP"]
            elif ch == '3':
                inputs["START"] = not inputs["START"]

        time.sleep(0.05)

if __name__ == "__main__":
    main()
