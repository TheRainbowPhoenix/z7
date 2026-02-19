import sys; sys.path.insert(0, '.')
# Just a placeholder for foreign demo to satisfy plan
# Logic covers calling foreign function.
import time
import threading
from ladderlib.ladder import LadderCtx, LadderInstructions, LadderRegister, LadderState, LadderInsError
from ladderlib.core import ladder_ctx_init, ladder_ctx_deinit, ladder_add_foreign, ladder_task, ladder_fn_cell
from ladderlib.utils.printer import ladder_print
from ladderlib.fn_commons import CELL_STATE_LEFT, SET_CELL_STATE

def my_foreign_exec(ctx, col, row):
    # Pass power through
    val = CELL_STATE_LEFT(ctx, col, row)
    SET_CELL_STATE(ctx, col, row, val)
    print(f"FOREIGN EXEC: Input={val}")
    return LadderInsError.LADDER_INS_ERR_OK

def my_foreign_init(fn, data, qty):
    fn.id = 0
    fn.name = "MY_EXT"
    fn.description.inputs = 1
    fn.description.outputs = 1
    fn.description.cells = 1
    fn.exec = my_foreign_exec
    return True

def main():
    ctx = LadderCtx()
    ladder_ctx_init(ctx, 5, 5, 1, 10, 0, 0, 0, 0, 100, 500, True, True, 1000, 100)
    ladder_add_foreign(ctx, my_foreign_init, None, 1)

    ctx.hw.time.millis = lambda: int(time.time() * 1000)
    ctx.hw.time.delay = lambda ms: time.sleep(ms / 1000.0)

    ladder_fn_cell(ctx, 0, 0, 0, LadderInstructions.LADDER_INS_NO, 0)
    ctx.network[0].cells[0][0].data[0].type = LadderRegister.LADDER_REGISTER_M
    ctx.network[0].cells[0][0].data[0].i32 = 0

    ladder_fn_cell(ctx, 0, 0, 1, LadderInstructions.LADDER_INS_FOREIGN, 0)
    # Foreign ID 0

    ladder_print(ctx)

    ctx.ladder.state = LadderState.LADDER_ST_RUNNING
    t = threading.Thread(target=ladder_task, args=(ctx,))
    t.start()

    try:
        ctx.memory.M[0] = 1
        time.sleep(1)
        ctx.memory.M[0] = 0
        time.sleep(1)
    finally:
        ctx.ladder.state = LadderState.LADDER_ST_EXIT_TSK
        t.join()
        ladder_ctx_deinit(ctx)

if __name__ == "__main__":
    main()
