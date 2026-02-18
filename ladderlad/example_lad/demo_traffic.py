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
    # Traffic Light Logic (Simulated with simple logic as ladderlad doesn't support complex Timer objects yet in ASCII)
    # Using state machine:
    # State 0: Red
    # State 1: Yellow
    # State 2: Green
    # Logic is simplified for visual demo using boolean latches

    schematic = (
        "||--[AUTO]----[/MAN]----(AUTO_MODE)---------------------||\n" +
        "||                                                      ||\n" +
        "||--[AUTO_MODE]--[/T_RED]--[/T_YEL]-------(RED)---------||\n" +
        "||                                                      ||\n" +
        "||--[RED]--------(T_RED_START)--------------------------||\n" +
        "||                                                      ||\n" +
        "||--[T_RED]-------------------------------(GREEN)-------||\n" +
        "||                                                      ||\n" +
        "||--[GREEN]------(T_GRN_START)--------------------------||\n" +
        "||                                                      ||\n" +
        "||--[T_GRN]-------------------------------(YELLOW)------||\n" +
        "||                                                      ||\n" +
        "||--[YELLOW]-----(T_YEL_START)--------------------------||\n" +
        "||                                                      ||\n" +
        "||--[T_YEL]-------------------------------(RESET)-------||"
    )

    engine = LadderEngine()
    instructions = engine.compile(schematic)
    sim = Simulator()

    inputs = {"AUTO": False, "MAN": False}
    timers = {"T_RED": 0, "T_GRN": 0, "T_YEL": 0}
    # Simulate timers externally since ladderlad RPN is boolean only for now

    print("\033[2J")

    while True:
        sim.set_variable("AUTO", inputs["AUTO"])
        sim.set_variable("MAN", inputs["MAN"])

        # External Timer Logic simulation
        # If T_RED_START is True, increment T_RED_ACC
        if sim.get_variable("T_RED_START"):
            timers["T_RED"] += 1
            if timers["T_RED"] > 30: # 3 seconds approx (0.1s tick)
                sim.set_variable("T_RED", True)
        else:
            timers["T_RED"] = 0
            sim.set_variable("T_RED", False)

        if sim.get_variable("T_GRN_START"):
            timers["T_GRN"] += 1
            if timers["T_GRN"] > 30:
                sim.set_variable("T_GRN", True)
        else:
            timers["T_GRN"] = 0
            sim.set_variable("T_GRN", False)

        if sim.get_variable("T_YEL_START"):
            timers["T_YEL"] += 1
            if timers["T_YEL"] > 10: # 1 second
                sim.set_variable("T_YEL", True)
        else:
            timers["T_YEL"] = 0
            sim.set_variable("T_YEL", False)

        if sim.get_variable("RESET"):
            # Reset logic handled by state change (T_YEL True -> RED False -> T_RED_START False)
            # Actually with latching this might flicker.
            # Simplified traffic light logic is circular dependency.
            # RED -> T_RED -> GREEN -> T_GRN -> YELLOW -> T_YEL -> Reset logic?
            # If T_YEL is true, it breaks RED rung?
            # `[AUTO_MODE]--[/T_RED]--[/T_YEL]--(RED)`
            # If T_RED is true, RED is false.
            # If T_YEL is true, RED is false.
            # Wait, if T_RED is true, RED off. Then T_RED_START off. Then T_RED off (next cycle).
            # Then RED on.
            # This causes oscillation.
            # To make it stable we need latches or proper timer blocks.
            # For this demo, let's just visualize the state flow even if it flickers.
            pass

        sim.run(instructions)
        rendered = engine.renderer.render(instructions, sim.trace)

        print("\033[H", end="")
        print("Interactive Traffic Light (q=quit, a=Auto)")
        print(f"AUTO={inputs['AUTO']} | RED={sim.get_variable('RED')} YEL={sim.get_variable('YELLOW')} GRN={sim.get_variable('GREEN')}")
        print(f"Timers: R={timers['T_RED']} G={timers['T_GRN']} Y={timers['T_YEL']}")
        print(rendered)

        if select.select([sys.stdin], [], [], 0.1)[0]:
            ch = get_char()
            if ch == 'q': break
            if ch == 'a': inputs["AUTO"] = not inputs["AUTO"]

        time.sleep(0.1)

if __name__ == "__main__":
    main()
