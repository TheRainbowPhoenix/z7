import sys
sys.path.insert(0, '.')
import time
from ladderlad.shm_interface import SHMInterface

def main():
    if len(sys.argv) < 3:
        print("Usage: python cli_shm_writer.py <BIT_NAME> <VALUE 0/1>")
        print("Bits: ESTOP, STOP, START")
        return

    name = sys.argv[1].upper()
    val = int(sys.argv[2])

    mapping = {
        "ESTOP": 0,
        "STOP": 1,
        "START": 2
    }

    if name not in mapping:
        print(f"Unknown bit {name}")
        return

    offset = mapping[name]

    shm = SHMInterface()
    if not shm.connect():
        print("SHM Connect Fail")
        return

    print(f"Setting {name} (I0.{offset}) to {val}")

    # Read-Modify-Write Input Byte 0
    b = shm.mm[0]
    if val:
        b |= (1 << offset)
    else:
        b &= ~(1 << offset)
    shm.mm[0] = b

    print(f"New IB0: 0x{b:02X}")
    shm.close()

if __name__ == "__main__":
    main()
