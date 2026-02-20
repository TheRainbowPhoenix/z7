import sys
sys.path.insert(0, '.')
import time
import select
import tty
import termios
from ladderlad.engine import LadderEngine
from ladderlad.simulator import Simulator
from ladderlad.shm_interface import SHMInterface

# Mapping SHM to Logic
# Inputs (I0.x)
# I0.0 = ESTOP (NC logic, but HW input usually NC means 1 is safe. Simulation assumes NO push buttons -> 1 when pressed)
# Let's assume standard buttons: NO Start, NC Stop, NC Estop.
# If we simulate via Web/Console, we force bits.
# Logic expects: [/ESTOP] -- [/STOP] -- [START]
# So ESTOP and STOP should be True (1) normally (Safe), False (0) when pressed (Active)?
# No, "NC" contact [/STOP] passes power if value is 0.
# If hardware is NC, normal state is 1. [/1] -> Open (False). Motor doesn't run?
# Usually Stop is NO in logic [STOP] if hardware is NC (1).
# Or logic is [/STOP] if hardware is NO (0).
# Let's follow the schematic logic: `||--[/ESTOP]----[/STOP]----+--[START]--...`
# If [/ESTOP], it passes if ESTOP=0.
# So ESTOP input should be 0 normally.
# Meaning physical button is NO? Or we map 1->0.
# Let's assume Inputs are 0 normally. Pressing sets to 1.
# ESTOP=1 -> Breaks circuit.
# STOP=1 -> Breaks circuit.
# START=1 -> Closes contact.

# Assignments:
# I0.0 = ESTOP
# I0.1 = STOP
# I0.2 = START
# Q0.0 = RUN (Motor)

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
    shm = SHMInterface()

    if not shm.connect():
        return

    print("\033[2J")

    while True:
        # Read from SHM
        estop = shm.read_input_bit(0, 0)
        stop = shm.read_input_bit(0, 1)
        start = shm.read_input_bit(0, 2)

        sim.set_variable("ESTOP", estop)
        sim.set_variable("STOP", stop)
        sim.set_variable("START", start)

        # Run
        sim.run(instructions)

        # Write to SHM
        run_state = sim.get_variable("RUN")
        motor_state = sim.get_variable("MOTOR")

        shm.write_output_bit(0, 0, run_state) # Q0.0
        shm.write_output_bit(0, 1, motor_state) # Q0.1

        # Render
        rendered = engine.renderer.render(instructions, sim.trace)

        print("\033[H", end="")
        print("SHM Latch Demo (q=quit)")
        print(f"Inputs (I0): ESTOP(0.0)={int(estop)} STOP(0.1)={int(stop)} START(0.2)={int(start)}")
        print(f"Outputs (Q0): RUN(0.0)={int(run_state)} MOTOR(0.1)={int(motor_state)}")
        print("-" * 40)
        print(rendered)

        # Check local override keys (useful for debugging without external tool)
        # But this might fight with SHM if SHM is master?
        # Inputs are Read-Only from SHM perspective usually.
        # But we can simulate "pressing button" by writing to Input area?
        # Usually Inputs are written by IO driver. Here WE are the logic.
        # But if we want to control via Web, Web writes to... DB? Or force Inputs?
        # Let's say Web writes to DB, and we map DB to Inputs for simulation?
        # Or simpler: Web writes to I area directly (simulation mode).

        if select.select([sys.stdin], [], [], 0.1)[0]:
            ch = get_char()
            if ch == 'q': break

        time.sleep(0.05)

    shm.close()

if __name__ == "__main__":
    main()
