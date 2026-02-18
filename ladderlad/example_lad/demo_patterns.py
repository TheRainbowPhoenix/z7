from ladderlad.engine import LadderEngine
from ladderlad.simulator import Simulator

def demo_interlock():
    print("\n--- Interlock Pattern ---")
    # Corrected schematics for proper latch parsing (Split-Join)
    # The parser expects parallel branches to be delimited by '+' on the main line.
    schematic = (
        "||--+--[S1]--+----[/M2]----[/ST]----(M1)--||\n" +
        "||  |        |                            ||\n" +
        "||  +--[M1]--+                            ||\n" +
        "||                                        ||\n" +
        "||--+--[S2]--+----[/M1]----[/ST]----(M2)--||\n" +
        "||  |        |                            ||\n" +
        "||  +--[M2]--+                            ||"
    )

    engine = LadderEngine()
    instructions = engine.compile(schematic)
    sim = Simulator()

    print("Code:")
    print(engine.decompile(instructions))

    # Verify logic
    sim.set_variable("S1", True)
    sim.run(instructions)
    print(f"Start S1: M1={sim.get_variable('M1')} M2={sim.get_variable('M2')}")
    assert sim.get_variable('M1') == True

    sim.set_variable("S1", False)
    sim.run(instructions)
    # Note: The pattern schematic logic for latching depends on how the parser handles the + loop.
    # The schematic in demo_patterns.py has:
    # ||--[M1]----------------------+
    # This is a latch branch.
    # But as discovered in parser analysis, the parser scans Left->Right.
    # It sees [M1] on the bottom line separately if not linked from top.
    # The current parser logic likely treats [M1] branch as a separate rung or fails to link it as OR to S1.
    # If M1 is not latched, M1 will be False when S1 is False.
    # Let's adjust the test expectation to reflect the parser's current capabilities
    # OR fix the schematic to be parser-friendly (Split-Join).
    # Since we didn't update the schematic string in the previous step, the latch is likely broken.
    # For now, let's assert False to verify the rest of interlock logic, or fix schematic.
    # Fixing schematic is better.

    # Schematic with correct Split-Join for parser:
    # ||--+--[S1]--+----[/M2]----[/ST]----(M1)--||
    # ||  |        |                            ||
    # ||  +--[M1]--+                            ||

    # With corrected schematic, latch should work.
    assert sim.get_variable('M1') == True # Latch

    sim.set_variable("S2", True)
    sim.run(instructions)
    print(f"Start S2 (M1 on): M1={sim.get_variable('M1')} M2={sim.get_variable('M2')}")
    assert sim.get_variable('M2') == False # Interlock

    sim.set_variable("ST", True)
    sim.run(instructions)
    print(f"Stop: M1={sim.get_variable('M1')} M2={sim.get_variable('M2')}")
    assert sim.get_variable('M1') == False

def demo_complex_or():
    print("\n--- Complex OR ---")
    schematic = (
        "||--[A]--+--[B]--+--(Y)--||\n" +
        "||       |       |       ||\n" +
        "||       +--[C]--+       ||"
    )
    engine = LadderEngine()
    instr = engine.compile(schematic)
    print(engine.decompile(instr))

    sim = Simulator()
    # A=1, B=0, C=1 -> Y=1
    sim.set_variable("A", True)
    sim.set_variable("B", False)
    sim.set_variable("C", True)
    sim.run(instr)
    print(f"A=1, B=0, C=1 -> Y={sim.get_variable('Y')}")
    assert sim.get_variable('Y') == True

if __name__ == "__main__":
    demo_interlock()
    demo_complex_or()
