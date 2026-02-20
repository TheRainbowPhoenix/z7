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
    # Pump Station Logic
    # 3 Ballasts (B1, B2, B3) feed 6 Pumps (P1..P6)
    # Logic: If Ballast Level > Low, Pump runs. If Level < Low, Pump stops and ALARM.

    # Schematic snippet (repeated logic pattern)
    schematic = (
        "||--[B1_OK]----[START]----(P1)--------------------------||\n" +
        "||                                                      ||\n" +
        "||--[/B1_OK]--------------(ALARM_B1)--------------------||\n" +
        "||                                                      ||\n" +
        "||--[P1]-------(P1_RUN_LED)-----------------------------||\n" +
        "||                                                      ||\n" +
        "||--[B2_OK]----[START]----(P2)--------------------------||\n" +
        "||                                                      ||\n" +
        "||--[/B2_OK]--------------(ALARM_B2)--------------------||\n" +
        "||                                                      ||\n" +
        "||--[B3_OK]----[START]----(P3)--------------------------||\n" +
        "||                                                      ||\n" +
        "||--[/B3_OK]--------------(ALARM_B3)--------------------||"
    )

    engine = LadderEngine()
    instructions = engine.compile(schematic)
    sim = Simulator()

    levels = {"B1": 50, "B2": 50, "B3": 50} # Water level %
    inputs = {"START": False}

    print("\033[2J")

    while True:
        sim.set_variable("START", inputs["START"])

        # Simulate Physics
        sim.set_variable("B1_OK", levels["B1"] > 10)
        sim.set_variable("B2_OK", levels["B2"] > 10)
        sim.set_variable("B3_OK", levels["B3"] > 10)

        if sim.get_variable("P1"): levels["B1"] -= 1
        else: levels["B1"] += 0.5 # Refill

        if sim.get_variable("P2"): levels["B2"] -= 1.5
        else: levels["B2"] += 0.5

        if sim.get_variable("P3"): levels["B3"] -= 0.8
        else: levels["B3"] += 0.5

        # Clamp
        for k in levels:
            levels[k] = max(0, min(100, levels[k]))

        sim.run(instructions)
        rendered = engine.renderer.render(instructions, sim.trace)

        print("\033[H", end="")
        print("Pump Station (q=quit, s=Start)")
        print(f"Levels: B1={levels['B1']:.1f}% B2={levels['B2']:.1f}% B3={levels['B3']:.1f}%")
        print(rendered)

        if select.select([sys.stdin], [], [], 0.1)[0]:
            ch = get_char()
            if ch == 'q': break
            if ch == 's': inputs["START"] = not inputs["START"]

        time.sleep(0.1)

if __name__ == "__main__":
    main()
