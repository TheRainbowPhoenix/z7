import sys
import os
import time
from ladderlib.ladder import (
    LadderCtx, LadderState, LadderInsError, LadderRegister, LadderBaseTime,
    LadderForeignFunction, LadderInstructionIOCD, LADDERLIB_VERSION_MAJOR,
    LADDERLIB_VERSION_MINOR, LADDERLIB_VERSION_PATCH, LadderInstructions
)
from ladderlib.core import (
    ladder_ctx_init, ladder_ctx_deinit, ladder_add_read_fn, ladder_add_write_fn,
    ladder_add_foreign, ladder_task
)
from ladderlib.parser import ladder_json_to_program
from .test_functions import test_ladder_instructions

QTY_M = 18
QTY_C = 8
QTY_T = 8
QTY_D = 8
QTY_R = 8

def dummy_read(ctx, id_): pass
def dummy_init_read(ctx, id_, init): return True
def dummy_write(ctx, id_): pass
def dummy_init_write(ctx, id_, init): return True
def dummy_on_scan_end(ctx): return False
def dummy_on_instruction(ctx): return False
def dummy_on_task_before(ctx): return False
def dummy_on_task_after(ctx): return False
def dummy_on_panic(ctx): pass
def dummy_on_end_task(ctx): pass

def dummy_millis():
    return int(time.time() * 1000)

def dummy_delay(msec):
    time.sleep(msec / 1000.0)

def dummy_foreign_exec(ctx, col, row):
    if ctx.exec_network:
        ctx.exec_network.cells[row][col].state = True
    return LadderInsError.LADDER_INS_ERR_OK

def dummy_init(fn, data, qty):
    fn.id = 0
    fn.name = "DUMMY"
    fn.description.inputs = 1
    fn.description.outputs = 1
    fn.description.cells = 1
    fn.description.data_qty = 0
    fn.exec = dummy_foreign_exec
    return True

def main():
    prg_load = os.path.join(os.path.dirname(__file__), "ladder_networks.json")
    prg_save = "ladder_networks_save.json"

    print("\033[2J") # Clear screen

    if not test_ladder_instructions():
        sys.exit(1)

    ladder_ctx = LadderCtx()

    if not ladder_ctx_init(ladder_ctx, 6, 7, 3, QTY_M, QTY_C, QTY_T, QTY_D, QTY_R, 10, 0, True, True, 1000000, 100):
        print("ERROR Initializing")
        return 1

    if not ladder_add_read_fn(ladder_ctx, dummy_read, dummy_init_read):
        print("ERROR Adding io read function")
        return 1

    if not ladder_add_write_fn(ladder_ctx, dummy_write, dummy_init_write):
        print("ERROR Adding io write function")
        return 1

    ladder_ctx.on.scan_end = dummy_on_scan_end
    ladder_ctx.on.instruction = dummy_on_instruction
    ladder_ctx.on.task_before = dummy_on_task_before
    ladder_ctx.on.task_after = dummy_on_task_after
    ladder_ctx.on.panic = dummy_on_panic
    ladder_ctx.on.end_task = dummy_on_end_task
    ladder_ctx.hw.time.millis = dummy_millis
    ladder_ctx.hw.time.delay = dummy_delay

    ladder_ctx.ladder.state = LadderState.LADDER_ST_RUNNING

    print(f"--[ ladderlib version: {LADDERLIB_VERSION_MAJOR}.{LADDERLIB_VERSION_MINOR}.{LADDERLIB_VERSION_PATCH} ]--\n")

    if not ladder_add_foreign(ladder_ctx, dummy_init, None, 5):
        print("ERROR Load foreign")
        sys.exit(1)

    print(f"Load demo program: {prg_load}")
    err = ladder_json_to_program(prg_load, ladder_ctx)
    if err != 0: # JSON_ERROR_OK
        print(f"ERROR: Load demo program ({err})")
        # Continue? C code goes to end.
        # But for test, let's allow it to run even if load fails?
        # No, if load fails, program is empty.
        # Check C code behavior: `goto end`.
        # I'll just print error and continue to task loop (which will do nothing) or exit.

    # Save demo program (optional)
    # ladder_program_to_json(prg_save, ladder_ctx)

    # ladder_program_check not implemented yet

    print("Start Task Ladder\n")

    # Run task in a separate thread? Or just call it.
    # `ladder_task` is blocking loop.
    # In C example it blocks.
    # I'll let it run for a bit then exit or interrupt?
    # Python `ladder_task` has a loop. I can stop it by setting state.
    # But how if I am blocked?
    # I'll modify `ladder_task` to accept iteration limit or handle Ctrl+C.
    # Or I can just run it. The user will kill it.
    # For automated verification, I should probably run it for a few seconds.

    try:
        ladder_task(ladder_ctx)
    except KeyboardInterrupt:
        pass

    ladder_ctx_deinit(ladder_ctx)
    return 0

if __name__ == "__main__":
    sys.exit(main())
