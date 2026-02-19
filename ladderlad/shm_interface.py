import mmap
import os
import struct
from typing import Optional

# Memory Layout (Matching extra/plc_logic.py and expected z7 structure)
OFFSET_INPUTS = 0
OFFSET_OUTPUTS = 65536
OFFSET_MERKERS = 131072
OFFSET_TIMERS = 196608
OFFSET_COUNTERS = 262144
OFFSET_DB_START = 327680
DB_SIZE = 65536

FILE_NAME = "s7_plc_shm"

class SHMInterface:
    def __init__(self, filename=FILE_NAME):
        self.filename = filename
        self.mm = None
        self.f = None

    def connect(self) -> bool:
        if not os.path.exists(self.filename):
            # Create a dummy file for testing if z7 server is not running
            # Size must cover at least DB1? DB_START + 2*DB_SIZE (approx 458KB+)
            # 1MB is safe.
            try:
                with open(self.filename, "wb") as f:
                    f.write(b'\x00' * (1024 * 1024))
            except Exception as e:
                print(f"Failed to create dummy SHM: {e}")
                return False

        try:
            self.f = open(self.filename, "r+b")
            self.mm = mmap.mmap(self.f.fileno(), 0)
            return True
        except Exception as e:
            print(f"SHM Connection Error: {e}")
            return False

    def close(self):
        if self.mm:
            self.mm.close()
        if self.f:
            self.f.close()

    def read_input_bit(self, byte_offset, bit_offset) -> bool:
        if not self.mm: return False
        val = self.mm[OFFSET_INPUTS + byte_offset]
        return bool(val & (1 << bit_offset))

    def read_output_bit(self, byte_offset, bit_offset) -> bool:
        if not self.mm: return False
        val = self.mm[OFFSET_OUTPUTS + byte_offset]
        return bool(val & (1 << bit_offset))

    def write_output_bit(self, byte_offset, bit_offset, value: bool):
        if not self.mm: return
        offset = OFFSET_OUTPUTS + byte_offset
        byte_val = self.mm[offset]
        if value:
            byte_val |= (1 << bit_offset)
        else:
            byte_val &= ~(1 << bit_offset)
        self.mm[offset] = byte_val

    def read_db_byte(self, db_num, byte_offset) -> int:
        if not self.mm: return 0
        addr = OFFSET_DB_START + (db_num * DB_SIZE) + byte_offset
        return self.mm[addr]

    def write_db_byte(self, db_num, byte_offset, value: int):
        if not self.mm: return
        addr = OFFSET_DB_START + (db_num * DB_SIZE) + byte_offset
        self.mm[addr] = value

    def read_db_bit(self, db_num, byte_offset, bit_offset) -> bool:
        byte_val = self.read_db_byte(db_num, byte_offset)
        return bool(byte_val & (1 << bit_offset))

    def write_db_bit(self, db_num, byte_offset, bit_offset, value: bool):
        byte_val = self.read_db_byte(db_num, byte_offset)
        if value:
            byte_val |= (1 << bit_offset)
        else:
            byte_val &= ~(1 << bit_offset)
        self.write_db_byte(db_num, byte_offset, byte_val)
