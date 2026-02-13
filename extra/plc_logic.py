import mmap
import time
import struct
import os
import sys

# Memory Layout (Must match storage.zig)
OFFSET_INPUTS = 0
OFFSET_OUTPUTS = 65536
OFFSET_MERKERS = 131072
OFFSET_TIMERS = 196608
OFFSET_COUNTERS = 262144
OFFSET_DB_START = 327680
DB_SIZE = 65536

FILE_NAME = "s7_plc_shm"

def main():
    print("--- Python PLC Logic Program ---")
    
    # Wait for the shared memory file to exist (created by z7 server)
    while not os.path.exists(FILE_NAME):
        print(f"Waiting for {FILE_NAME} (Start 'z7' server first)...")
        time.sleep(1)

    try:
        # Open file in read/write binary mode
        with open(FILE_NAME, "r+b") as f:
            # Create memory map
            # 0 means map the whole file
            try:
                mm = mmap.mmap(f.fileno(), 0)
            except Exception as e:
                print(f"Failed to mmap: {e}")
                return

            print(f"Attached to PLC Memory (Size: {len(mm)} bytes)")
            print("Running logic loop...")
            print("  - Incrementing DB1.DBD0 (Heartbeat)")
            print("  - Mirroring IB0 to QB0 (Input Byte 0 -> Output Byte 0)")
            
            db1_start = OFFSET_DB_START + (1 * DB_SIZE)
            
            while True:
                # ---------------------------------------------------------
                # PLC SCAN CYCLE
                # ---------------------------------------------------------
                
                # 1. READ INPUTS
                # Read Input Byte 0 (IB0)
                ib0 = mm[OFFSET_INPUTS]
                
                # 2. EXECUTE LOGIC
                
                # Logic A: Heartbeat Counter in DB1.DBD0
                # Read current 32-bit big-endian integer
                val_bytes = mm[db1_start:db1_start+4]
                counter = struct.unpack(">I", val_bytes)[0]
                
                # Increment and wrap
                counter = (counter + 1) % 0xFFFFFFFF
                
                # Write back
                mm[db1_start:db1_start+4] = struct.pack(">I", counter)
                
                # Logic B: Mirror Inputs to Outputs
                # QB0 = IB0
                mm[OFFSET_OUTPUTS] = ib0
                
                # ---------------------------------------------------------
                # END OF CYCLE
                # ---------------------------------------------------------
                
                # Print status occasionally
                if counter % 10 == 0:
                    # Clear line and print status
                    sys.stdout.write(f"\r[Cycle] DB1.DBD0={counter:<10} IB0=0x{ib0:02X} => QB0=0x{mm[OFFSET_OUTPUTS]:02X}")
                    sys.stdout.flush()
                
                # Simulate cycle time (100ms)
                time.sleep(0.1)

    except PermissionError:
        print(f"\nError: Permission denied opening {FILE_NAME}. Ensure z7 is not locking it exclusively (it shouldn't).")
    except KeyboardInterrupt:
        print("\nPLC Logic Stopped.")
    except Exception as e:
        print(f"\nError: {e}")

if __name__ == "__main__":
    main()
