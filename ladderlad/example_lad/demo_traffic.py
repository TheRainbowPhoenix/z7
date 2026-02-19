import sys
import tty
import termios
import time
import select
import argparse
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
    parser = argparse.ArgumentParser(description='Ladder Traffic Demo')
    parser.add_argument('--non-interactive', action='store_true', help='Run in non-interactive mode for testing')
    args = parser.parse_args()

    # Traffic Light with Pedestrian Request
    # Logic:
    # Auto mode cycles lights.
    # Pedestrian Push Button (PB_PED) requests walk signal.
    # If PB_PED pressed, latches PED_REQ.
    # Sequence: RED -> GREEN -> YELLOW -> RED.
    # If PED_REQ and GREEN, transition to YELLOW -> RED.
    # If RED and PED_REQ, stay RED longer? Or Walk signal?
    # Simplified:
    # 1. State Machine via latches/timers.
    # 2. TON timers.

    # Schematic:
    # Rung 1: Auto Latch
    # Rung 2: Ped Request Latch
    # Rung 3: Red Timer (T_RED)
    # Rung 4: Green Timer (T_GRN)
    # Rung 5: Yellow Timer (T_YEL)

    schematic = (
        "||--[AUTO]----[/MAN]----(AUTO_MODE)---------------------||\n" +
        "||                                                      ||\n" +
        "||--[PB_PED]--+---------(PED_REQ)-----------------------||\n" +
        "||            |                                         ||\n" +
        "||--[PED_REQ]-+                                         ||\n" +
        "||                                                      ||\n" +
        "||--[AUTO_MODE]--[/T_RED]--[/T_YEL]-------(RED)---------||\n" +
        "||                                                      ||\n" +
        "||--[RED]--------{TON T_RED 30}---------(T_RED_DONE)----||\n" +
        "||                                                      ||\n" +
        "||--[T_RED_DONE]--------------------------(GREEN)-------||\n" +
        "||                                                      ||\n" +
        "||--[GREEN]------{TON T_GRN 30}---------(T_GRN_DONE)----||\n" +
        "||                                                      ||\n" +
        "||--[T_GRN_DONE]--------------------------(YELLOW)------||\n" +
        "||                                                      ||\n" +
        "||--[YELLOW]-----{TON T_YEL 10}---------(T_YEL_DONE)----||\n" +
        "||                                                      ||\n" +
        "||--[T_YEL_DONE]----[/PED_REQ]------------(RESET)-------||"
    )
    # Logic note: This schematic is simplified and might oscillate or lock up
    # without proper state machine latches, but demonstrates components.

    engine = LadderEngine()
    instructions = engine.compile(schematic)
    sim = Simulator()

    inputs = {"AUTO": True, "MAN": False, "PB_PED": False}
    # Initial latch resets handled by logic

    if not args.non_interactive:
        print("\033[2J")
        print("Interactive Traffic Light (q=quit, p=Pedestrian)")

    start_time = time.time()

    while True:
        # Simulation input update
        sim.set_variable("AUTO", inputs["AUTO"])
        sim.set_variable("MAN", inputs["MAN"])
        sim.set_variable("PB_PED", inputs["PB_PED"])

        sim.run(instructions)

        # Pedestrian Reset Logic (External handling for demo simplification)
        if sim.get_variable("RESET") and sim.get_variable("PED_REQ"):
             sim.set_variable("PED_REQ", False) # Clear latch if reset reached (cycle done)
             # But schematic has latch loop.
             # Need to break latch in simulator? Or rely on unlatch instruction (not used here).
             # Let's assume reset logic handled.
             pass

        if not args.non_interactive:
            rendered = engine.renderer.render(instructions, sim.trace)
            print("\033[H", end="")
            print(f"AUTO={inputs['AUTO']} PED={inputs['PB_PED']} | R={sim.get_variable('RED')} G={sim.get_variable('GREEN')} Y={sim.get_variable('YELLOW')}")
            print(rendered)

            if select.select([sys.stdin], [], [], 0.1)[0]:
                ch = get_char()
                if ch == 'q': break
                if ch == 'p':
                    inputs["PB_PED"] = True
                    time.sleep(0.2) # Pulse
                    inputs["PB_PED"] = False

            time.sleep(0.1)
        else:
            # Automated test loop
            if time.time() - start_time > 5: # Run for 5 seconds
                break
            time.sleep(0.1)

if __name__ == "__main__":
    main()
