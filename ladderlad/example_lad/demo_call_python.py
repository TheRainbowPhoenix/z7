import sys
import time
import argparse
from ladderlad.engine import LadderEngine
from ladderlad.simulator import Simulator

def my_python_func(sim, en, args):
    # args: [param1]
    # Simple logic: If EN is true, return not param1?
    # Or just return True if EN.
    # Return (eno, val)
    if en:
        print(f"PYTHON CALLBACK: EN=True, Args={args}")
        return True, True
    return False, False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--non-interactive', action='store_true')
    args = parser.parse_args()

    schematic = (
        "||--[IN_A]--{MY_FUNC P1}--(OUT_Q)--||"
    )

    engine = LadderEngine()
    instructions = engine.compile(schematic)
    sim = Simulator()

    sim.register_function("MY_FUNC", my_python_func)

    sim.set_variable("IN_A", True)
    sim.run(instructions)

    if sim.get_variable("OUT_Q"):
        print("Success: OUT_Q is True")
    else:
        print("Fail: OUT_Q is False")

    if not args.non_interactive:
        print(engine.renderer.render(instructions, sim.trace))

if __name__ == "__main__":
    main()
