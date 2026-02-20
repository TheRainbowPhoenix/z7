import sys
import tty
import termios
import time
import select
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

    inputs = {"ESTOP": False, "STOP": False, "START": False}

    print("\033[2J")

    while True:
        # Update sim
        for k, v in inputs.items():
            sim.set_variable(k, v)

        sim.run(instructions)

        ladder_view = engine.renderer.render(instructions, sim.trace)
        il_view = engine.renderer.render_il(instructions, sim.trace)

        # Split view logic
        ladder_lines = ladder_view.splitlines()
        il_lines = il_view.splitlines()

        max_ladder_width = max(len(l) for l in ladder_lines) # Note: ANSI codes make len() tricky for visual width
        # But here we just print one below other or side by side?
        # Side by side is requested "display both".
        # ANSI aware formatting is hard.
        # Let's print Ladder then IL below it.

        print("\033[H", end="")
        print("Interactive IL Trace Demo (q=quit)")
        print(f"Inputs: ESTOP={inputs['ESTOP']} STOP={inputs['STOP']} START={inputs['START']}")
        print(f"Outputs: RUN={sim.get_variable('RUN')} MOTOR={sim.get_variable('MOTOR')}")
        print("-" * 40)
        print("LADDER VIEW:")
        print(ladder_view)
        print("-" * 40)
        print("INSTRUCTION LIST (ASSEMBLY) VIEW:")
        print(il_view)
        print("-" * 40)

        if select.select([sys.stdin], [], [], 0.1)[0]:
            ch = get_char()
            if ch == 'q': break
            elif ch == '1': inputs["ESTOP"] = not inputs["ESTOP"]
            elif ch == '2': inputs["STOP"] = not inputs["STOP"]
            elif ch == '3': inputs["START"] = not inputs["START"]

        time.sleep(0.05)

if __name__ == "__main__":
    main()
