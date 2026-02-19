import sys; sys.path.insert(0, '.')
from ladderlad.engine import LadderEngine
from ladderlad.simulator import Simulator

def test_latch_simulation():
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

    print("Instructions:", instructions)

    # 1. Initial State (All False) -> RUN should be False
    sim.run(instructions)
    print(f"Init: RUN={sim.get_variable('RUN')} MOTOR={sim.get_variable('MOTOR')}")
    assert sim.get_variable('RUN') == False

    # 2. Press START (ESTOP=0, STOP=0, START=1)
    sim.set_variable("START", True)
    sim.run(instructions)
    print(f"Start Pressed: RUN={sim.get_variable('RUN')} MOTOR={sim.get_variable('MOTOR')}")
    assert sim.get_variable('RUN') == True
    assert sim.get_variable('MOTOR') == True

    # 3. Release START (Latch should hold)
    sim.set_variable("START", False)
    sim.run(instructions)
    print(f"Start Released: RUN={sim.get_variable('RUN')} MOTOR={sim.get_variable('MOTOR')}")
    assert sim.get_variable('RUN') == True

    # 4. Press STOP
    sim.set_variable("STOP", True)
    sim.run(instructions)
    print(f"Stop Pressed: RUN={sim.get_variable('RUN')} MOTOR={sim.get_variable('MOTOR')}")
    assert sim.get_variable('RUN') == False

    # 5. Release STOP
    sim.set_variable("STOP", False)
    sim.run(instructions)
    print(f"Stop Released: RUN={sim.get_variable('RUN')} MOTOR={sim.get_variable('MOTOR')}")
    assert sim.get_variable('RUN') == False

def test_compile_decompile():
    schematic = (
        "||--[/ESTOP]----[/STOP]----+--[START]--+----(RUN)--||\n" +
        "||                         |           |           ||\n" +
        "||                         +--[RUN]----+           ||\n" +
        "||                                                 ||\n" +
        "||--[RUN]----(MOTOR)-------------------------------||"
    )

    engine = LadderEngine()
    instructions = engine.compile(schematic)
    decompiled = engine.decompile(instructions)

    # Normalize whitespace for comparison or just check if it parses back
    print("Original:\n" + schematic)
    print("Decompiled:\n" + decompiled)

    # Recompile decompiled
    instr2 = engine.compile(decompiled)
    assert instructions == instr2
    print("Recompile match: OK")

if __name__ == "__main__":
    print("--- Test Latch Simulation ---")
    test_latch_simulation()
    print("\n--- Test Compile/Decompile ---")
    test_compile_decompile()
