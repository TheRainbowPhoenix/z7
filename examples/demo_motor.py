import time
import sys
import threading
from ladderlib.ladder import (
    LadderCtx, LadderState, LadderInsError, LadderInstructions, LadderRegister, ModulePort
)
from ladderlib.core import (
    ladder_ctx_init, ladder_ctx_deinit, ladder_add_read_fn, ladder_add_write_fn,
    ladder_task, ladder_fn_cell, ladder_clear_program
)
from ladderlib.utils.printer import ladder_print

# Demo: Motor Start/Stop + Running Status + Emergency Stop
# M0: Start Button (NO)
# M1: Stop Button (NC)
# M2: Emergency Stop (NC)
# M10: Motor Running (Coil) -> Drives Q0.0
# Q0.0: Motor Output

def motor_read(ctx, id_):
    pass # Inputs simulated by modifying memory directly in main thread

def motor_init(ctx, id_, init):
    if init:
        # Allocate 8 outputs for this module
        ctx.output[id_].q_qty = 8
        ctx.output[id_].Q = [0] * 8
        ctx.output[id_].Qh = [0] * 8
        ctx.output[id_].qw_qty = 8
        ctx.output[id_].QW = [0] * 8
        ctx.output[id_].QWh = [0] * 8
    return True

def motor_write(ctx, id_):
    # Print status when output changes
    if ctx.output[0].Q[0] != ctx.output[0].Qh[0]:
        state = "ON" if ctx.output[0].Q[0] else "OFF"
        print(f"[HW] Motor Q0.0 switched {state}")

def on_scan_end(ctx):
    # Optional debug per scan
    return True

def on_panic(ctx):
    print("[PANIC] Ladder Logic Panic!")

def main():
    ctx = LadderCtx()
    if not ladder_ctx_init(ctx, 5, 5, 1, 20, 0, 0, 0, 0, 100, 500, True, True, 1000, 100):
        print("Init failed")
        return

    ladder_add_read_fn(ctx, motor_read, None)
    ladder_add_write_fn(ctx, motor_write, motor_init)

    ctx.on.scan_end = on_scan_end
    ctx.on.panic = on_panic
    ctx.hw.time.millis = lambda: int(time.time() * 1000)
    ctx.hw.time.delay = lambda ms: time.sleep(ms / 1000.0)

    # Define Logic
    # Network 0:
    #   [ Start (M0) ] --- [ Stop (M1) ] --- [ E-Stop (M2) ] ----------------( M10 )
    #   [ M10        ] -+
    #
    #   [ M10 ] -------------------------------------------------------------( Q0.0 )

    net = ctx.network[0]

    # Rung 0: Start Logic (Latch)
    # Cell (0,0): NO Contact M0 (Start)
    ladder_fn_cell(ctx, 0, 0, 0, LadderInstructions.LADDER_INS_NO, 0)
    net.cells[0][0].data[0].type = LadderRegister.LADDER_REGISTER_M
    net.cells[0][0].data[0].i32 = 0
    net.cells[0][0].vertical_bar = False # Top of branch

    # Cell (1,0): NO Contact M10 (Latch)
    ladder_fn_cell(ctx, 0, 1, 0, LadderInstructions.LADDER_INS_NO, 0)
    net.cells[1][0].data[0].type = LadderRegister.LADDER_REGISTER_M
    net.cells[1][0].data[0].i32 = 10
    net.cells[1][0].vertical_bar = True # Connects to row above

    # Cell (0,1): NC Contact M1 (Stop)
    ladder_fn_cell(ctx, 0, 0, 1, LadderInstructions.LADDER_INS_NC, 0)
    net.cells[0][1].data[0].type = LadderRegister.LADDER_REGISTER_M
    net.cells[0][1].data[0].i32 = 1

    # Cell (0,2): NC Contact M2 (E-Stop)
    ladder_fn_cell(ctx, 0, 0, 2, LadderInstructions.LADDER_INS_NC, 0)
    net.cells[0][2].data[0].type = LadderRegister.LADDER_REGISTER_M
    net.cells[0][2].data[0].i32 = 2

    # Cell (0,3): Coil M10 (Running Internal)
    ladder_fn_cell(ctx, 0, 0, 3, LadderInstructions.LADDER_INS_COIL, 0)
    net.cells[0][3].data[0].type = LadderRegister.LADDER_REGISTER_M
    net.cells[0][3].data[0].i32 = 10

    # Rung 2 (Row 2): Output Drive
    # Cell (2,0): NO Contact M10
    ladder_fn_cell(ctx, 0, 2, 0, LadderInstructions.LADDER_INS_NO, 0)
    net.cells[2][0].data[0].type = LadderRegister.LADDER_REGISTER_M
    net.cells[2][0].data[0].i32 = 10

    # Cell (2,1): Coil Q0.0
    ladder_fn_cell(ctx, 0, 2, 1, LadderInstructions.LADDER_INS_COIL, 0)
    net.cells[2][1].data[0].type = LadderRegister.LADDER_REGISTER_Q
    net.cells[2][1].data[0].mp = ModulePort(0, 0)

    print("Program Defined:")
    ladder_print(ctx)

    ctx.ladder.state = LadderState.LADDER_ST_RUNNING

    # Run task in thread
    t = threading.Thread(target=ladder_task, args=(ctx,))
    t.start()

    try:
        print("Simulation started. Press M0 to Start, M1 to Stop.")
        time.sleep(1)

        print("> Pressing Start (M0=1)")
        ctx.memory.M[0] = 1 # Press
        time.sleep(0.5)
        print("> Releasing Start (M0=0)")
        ctx.memory.M[0] = 0 # Release

        time.sleep(2)

        print("> Pressing Stop (M1=1)")
        ctx.memory.M[1] = 1
        time.sleep(0.5)
        print("> Releasing Stop (M1=0)")
        ctx.memory.M[1] = 0

        time.sleep(1)

        print("> Pressing Start (M0=1)")
        ctx.memory.M[0] = 1
        time.sleep(0.5)
        ctx.memory.M[0] = 0

        time.sleep(1)
        print("> Emergency Stop (M2=1)")
        ctx.memory.M[2] = 1
        time.sleep(2)
        print("> Reset E-Stop (M2=0)")
        ctx.memory.M[2] = 0

        # Wait for 2 minutes total as requested
        print("Running for remaining time (2 minutes)...")
        time.sleep(120)

    finally:
        print("Stopping task...")
        ctx.ladder.state = LadderState.LADDER_ST_EXIT_TSK
        t.join()
        ladder_ctx_deinit(ctx)
        print("Deinitialized.")

if __name__ == "__main__":
    main()
