import time
import threading
from ladderlib.ladder import LadderCtx, LadderInstructions, LadderRegister, LadderState, ModulePort
from ladderlib.core import ladder_ctx_init, ladder_ctx_deinit, ladder_add_write_fn, ladder_task, ladder_fn_cell
from ladderlib.utils.printer import ladder_print

# Demo: Traffic Light
# T0: Red Timer (5s)
# T1: Green Timer (5s)
# T2: Yellow Timer (2s)
# Q0.0: Red
# Q0.1: Yellow
# Q0.2: Green

def light_init(ctx, id_, init):
    if init:
        ctx.output[id_].q_qty = 8
        ctx.output[id_].Q = [0] * 8
        ctx.output[id_].Qh = [0] * 8
        ctx.output[id_].qw_qty = 8
        ctx.output[id_].QW = [0] * 8
        ctx.output[id_].QWh = [0] * 8
    return True

def light_write(ctx, id_):
    q = ctx.output[0].Q
    qh = ctx.output[0].Qh
    if q[0] != qh[0] or q[1] != qh[1] or q[2] != qh[2]:
        status = []
        if q[0]: status.append("RED")
        if q[1]: status.append("YELLOW")
        if q[2]: status.append("GREEN")
        print(f"[LIGHTS] {' '.join(status)}")

def main():
    ctx = LadderCtx()
    ladder_ctx_init(ctx, 5, 10, 1, 10, 0, 3, 0, 0, 100, 500, True, True, 1000, 100)
    ladder_add_write_fn(ctx, light_write, light_init)

    ctx.hw.time.millis = lambda: int(time.time() * 1000)
    ctx.hw.time.delay = lambda ms: time.sleep(ms / 1000.0)

    # State Machine using Timers
    # Initial State: Red (Q0.0)
    # T0 (Red Time) done -> Start Green (Q0.2)
    # T1 (Green Time) done -> Start Yellow (Q0.1)
    # T2 (Yellow Time) done -> Start Red

    # Simplified Logic:
    # Net 0:
    # NC T2 -> TOF T0 (Red duration) -> Q0.0 (Red)
    # T0.Q -> TOF T1 (Green duration) -> Q0.2 (Green)
    # T1.Q -> TOF T2 (Yellow duration) -> Q0.1 (Yellow)
    # Wait, usually TP or TON sequence.
    # Let's use simple logic:
    # 1. NC T2.Q -> TON T0 (Red Time). Output Q0.0 active while T0 not done.
    # ... This is getting complex to hand-code without drawing.
    # Let's use a simpler cycle.
    # Start -> T0 (Red 2s) -> T1 (Green 2s) -> T2 (Yellow 1s) -> Loop

    # Rung 0: Oscillator Start
    # NC T2.Q -> TON T0
    ladder_fn_cell(ctx, 0, 0, 0, LadderInstructions.LADDER_INS_NC, 0)
    ctx.network[0].cells[0][0].data[0].type = LadderRegister.LADDER_REGISTER_Td
    ctx.network[0].cells[0][0].data[0].i32 = 2 # T2 Done

    ladder_fn_cell(ctx, 0, 0, 1, LadderInstructions.LADDER_INS_TON, 0)
    ctx.network[0].cells[0][1].data[0].type = LadderRegister.LADDER_REGISTER_T
    ctx.network[0].cells[0][1].data[0].i32 = 0 # T0
    ctx.network[0].cells[0][1].data[1].type = LadderRegister.LADDER_REGISTER_NONE # MS? No BaseTime
    # Using raw i32 for type field for basetime enum (SEC=3)
    ctx.network[0].cells[0][1].data[1].type = LadderRegister(3) # SEC
    ctx.network[0].cells[0][1].data[1].i32 = 2 # 2 seconds

    # Rung 1: T0 Done -> TON T1
    ladder_fn_cell(ctx, 0, 2, 0, LadderInstructions.LADDER_INS_NO, 0)
    ctx.network[0].cells[2][0].data[0].type = LadderRegister.LADDER_REGISTER_Td
    ctx.network[0].cells[2][0].data[0].i32 = 0

    ladder_fn_cell(ctx, 0, 2, 1, LadderInstructions.LADDER_INS_TON, 0)
    ctx.network[0].cells[2][1].data[0].type = LadderRegister.LADDER_REGISTER_T
    ctx.network[0].cells[2][1].data[0].i32 = 1 # T1
    ctx.network[0].cells[2][1].data[1].type = LadderRegister(3) # SEC
    ctx.network[0].cells[2][1].data[1].i32 = 2 # 2 seconds

    # Rung 2: T1 Done -> TON T2
    ladder_fn_cell(ctx, 0, 4, 0, LadderInstructions.LADDER_INS_NO, 0)
    ctx.network[0].cells[4][0].data[0].type = LadderRegister.LADDER_REGISTER_Td
    ctx.network[0].cells[4][0].data[0].i32 = 1

    ladder_fn_cell(ctx, 0, 4, 1, LadderInstructions.LADDER_INS_TON, 0)
    ctx.network[0].cells[4][1].data[0].type = LadderRegister.LADDER_REGISTER_T
    ctx.network[0].cells[4][1].data[0].i32 = 2 # T2
    ctx.network[0].cells[4][1].data[1].type = LadderRegister(3) # SEC
    ctx.network[0].cells[4][1].data[1].i32 = 1 # 1 second

    # Outputs logic
    # Red: Not T0.Q
    # Green: T0.Q AND Not T1.Q
    # Yellow: T1.Q AND Not T2.Q

    # Row 6: NC T0.Td -> Q0.0 (Red)
    ladder_fn_cell(ctx, 0, 6, 0, LadderInstructions.LADDER_INS_NC, 0)
    ctx.network[0].cells[6][0].data[0].type = LadderRegister.LADDER_REGISTER_Td
    ctx.network[0].cells[6][0].data[0].i32 = 0

    ladder_fn_cell(ctx, 0, 6, 1, LadderInstructions.LADDER_INS_COIL, 0)
    ctx.network[0].cells[6][1].data[0].type = LadderRegister.LADDER_REGISTER_Q
    ctx.network[0].cells[6][1].data[0].mp = ModulePort(0, 0) # RED

    # Row 7: NO T0.Td -> NC T1.Td -> Q0.2 (Green)
    ladder_fn_cell(ctx, 0, 7, 0, LadderInstructions.LADDER_INS_NO, 0)
    ctx.network[0].cells[7][0].data[0].type = LadderRegister.LADDER_REGISTER_Td
    ctx.network[0].cells[7][0].data[0].i32 = 0

    ladder_fn_cell(ctx, 0, 7, 1, LadderInstructions.LADDER_INS_NC, 0)
    ctx.network[0].cells[7][1].data[0].type = LadderRegister.LADDER_REGISTER_Td
    ctx.network[0].cells[7][1].data[0].i32 = 1

    ladder_fn_cell(ctx, 0, 7, 2, LadderInstructions.LADDER_INS_COIL, 0)
    ctx.network[0].cells[7][2].data[0].type = LadderRegister.LADDER_REGISTER_Q
    ctx.network[0].cells[7][2].data[0].mp = ModulePort(0, 2) # GREEN

    # Row 8: NO T1.Td -> NC T2.Td -> Q0.1 (Yellow)
    ladder_fn_cell(ctx, 0, 8, 0, LadderInstructions.LADDER_INS_NO, 0)
    ctx.network[0].cells[8][0].data[0].type = LadderRegister.LADDER_REGISTER_Td
    ctx.network[0].cells[8][0].data[0].i32 = 1

    ladder_fn_cell(ctx, 0, 8, 1, LadderInstructions.LADDER_INS_NC, 0)
    ctx.network[0].cells[8][1].data[0].type = LadderRegister.LADDER_REGISTER_Td
    ctx.network[0].cells[8][1].data[0].i32 = 2

    ladder_fn_cell(ctx, 0, 8, 2, LadderInstructions.LADDER_INS_COIL, 0)
    ctx.network[0].cells[8][2].data[0].type = LadderRegister.LADDER_REGISTER_Q
    ctx.network[0].cells[8][2].data[0].mp = ModulePort(0, 1) # YELLOW

    ladder_print(ctx)

    ctx.ladder.state = LadderState.LADDER_ST_RUNNING
    t = threading.Thread(target=ladder_task, args=(ctx,))
    t.start()

    try:
        time.sleep(15)
    finally:
        ctx.ladder.state = LadderState.LADDER_ST_EXIT_TSK
        t.join()
        ladder_ctx_deinit(ctx)

if __name__ == "__main__":
    main()
