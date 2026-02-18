from ladderlad.engine import LadderEngine
from ladderlad.simulator import Simulator

def demo_interlock():
    print("\n--- Interlock Pattern ---")
    # Motor 1 (M1) and Motor 2 (M2) cannot run together.
    # Start1 (S1) starts M1 if M2 is off.
    # Start2 (S2) starts M2 if M1 is off.
    # Stop (ST) stops both.
    schematic = (
        "||--[S1]----[/M2]----[/ST]----+--(M1)--||\n" +
        "||                            |        ||\n" +
        "||--[M1]----------------------+        ||\n" +
        "||                                     ||\n" +
        "||--[S2]----[/M1]----[/ST]----+--(M2)--||\n" +
        "||                            |        ||\n" +
        "||--[M2]----------------------+        ||"
    )

    engine = LadderEngine()
    instructions = engine.compile(schematic)
    sim = Simulator()

    print("Code:")
    print(engine.decompile(instructions))

    # Test 1: Start M1
    sim.set_variable("S1", True)
    sim.run(instructions)
    print(f"Start S1: M1={sim.get_variable('M1')} M2={sim.get_variable('M2')}")

    sim.set_variable("S1", False)
    sim.run(instructions)

    # Test 2: Try Start M2 (Should fail)
    sim.set_variable("S2", True)
    sim.run(instructions)
    print(f"Start S2 (M1 on): M1={sim.get_variable('M1')} M2={sim.get_variable('M2')}")

    # Test 3: Stop
    sim.set_variable("S2", False)
    sim.set_variable("ST", True)
    sim.run(instructions)
    print(f"Stop: M1={sim.get_variable('M1')} M2={sim.get_variable('M2')}")

if __name__ == "__main__":
    demo_interlock()
