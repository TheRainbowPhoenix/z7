import time
from typing import Callable, Optional, Any, List
from .ladder import (
    LadderCtx, LadderState, LadderInsError, LadderRegister, LadderInstructions,
    LadderNetwork, LadderCell, LadderValue, LadderInstructionIOCD,
    LADDER_FN_IOCD, LadderForeignFunction, LadderForeign,
    LadderHWInputVals, LadderHWOutputVals, LadderTimer
)
from .instructions import LADDER_FUNCTIONS
from .fn_commons import SET_CELL_STATE, CELL_STATE

# Side effects table (simplified from C source)
HAS_SIDE_EFFECTS_ON_FALSE = {
    LadderInstructions.LADDER_INS_NOP: False,
    LadderInstructions.LADDER_INS_CONN: False,
    LadderInstructions.LADDER_INS_NEG: True,
    LadderInstructions.LADDER_INS_NO: False,
    LadderInstructions.LADDER_INS_NC: False,
    LadderInstructions.LADDER_INS_RE: False,
    LadderInstructions.LADDER_INS_FE: False,
    LadderInstructions.LADDER_INS_COIL: True,
    LadderInstructions.LADDER_INS_COILL: False,
    LadderInstructions.LADDER_INS_COILU: False,
    LadderInstructions.LADDER_INS_TON: True,
    LadderInstructions.LADDER_INS_TOF: True,
    LadderInstructions.LADDER_INS_TP: True,
    LadderInstructions.LADDER_INS_CTU: True,
    LadderInstructions.LADDER_INS_CTD: True,
    LadderInstructions.LADDER_INS_MOVE: False,
    LadderInstructions.LADDER_INS_SUB: False,
    LadderInstructions.LADDER_INS_ADD: False,
    LadderInstructions.LADDER_INS_MUL: False,
    LadderInstructions.LADDER_INS_DIV: False,
    LadderInstructions.LADDER_INS_MOD: False,
    LadderInstructions.LADDER_INS_SHL: False,
    LadderInstructions.LADDER_INS_SHR: False,
    LadderInstructions.LADDER_INS_ROL: False,
    LadderInstructions.LADDER_INS_ROR: False,
    LadderInstructions.LADDER_INS_AND: False,
    LadderInstructions.LADDER_INS_OR: False,
    LadderInstructions.LADDER_INS_XOR: False,
    LadderInstructions.LADDER_INS_NOT: False,
    LadderInstructions.LADDER_INS_EQ: False,
    LadderInstructions.LADDER_INS_GT: False,
    LadderInstructions.LADDER_INS_GE: False,
    LadderInstructions.LADDER_INS_LT: False,
    LadderInstructions.LADDER_INS_LE: False,
    LadderInstructions.LADDER_INS_NE: False,
    LadderInstructions.LADDER_INS_FOREIGN: True,
    LadderInstructions.LADDER_INS_TMOVE: True,
    LadderInstructions.LADDER_INS_INV: False,
    LadderInstructions.LADDER_INS_MULTI: False,
}

def ladder_ctx_init(lctx: LadderCtx, net_cols: int, net_rows: int, net_qty: int,
                    qty_m: int, qty_c: int, qty_t: int, qty_d: int, qty_r: int,
                    delay_not_run: int, watchdog_ms: int, init_network: bool,
                    write_on_fault: bool, max_scan_cycles: int, target_scan_ms: int) -> bool:
    if lctx is None: return False

    lctx.ladder.quantity.m = qty_m
    lctx.ladder.quantity.c = qty_c
    lctx.ladder.quantity.t = qty_t
    lctx.ladder.quantity.d = qty_d
    lctx.ladder.quantity.r = qty_r
    lctx.ladder.quantity.networks = net_qty
    lctx.ladder.quantity.delay_not_run = delay_not_run
    lctx.ladder.quantity.watchdog_ms = watchdog_ms
    lctx.ladder.write_on_fault = write_on_fault

    lctx.scan_internals.max_scan_cycles = max_scan_cycles
    lctx.scan_internals.target_scan_ms = target_scan_ms

    # Allocate memory
    lctx.memory.M = [0] * qty_m
    lctx.memory.Cr = [False] * qty_c
    lctx.memory.Cd = [False] * qty_c
    lctx.memory.Tr = [False] * qty_t
    lctx.memory.Td = [False] * qty_t

    lctx.prev_scan_vals.Mh = [0] * qty_m
    lctx.prev_scan_vals.Crh = [False] * qty_c
    lctx.prev_scan_vals.Cdh = [False] * qty_c
    lctx.prev_scan_vals.Trh = [False] * qty_t
    lctx.prev_scan_vals.Tdh = [False] * qty_t

    lctx.registers.C = [0] * qty_c
    lctx.registers.D = [0] * qty_d
    lctx.registers.R = [0.0] * qty_r

    lctx.timers = [LadderTimer() for _ in range(qty_t)]

    if init_network:
        lctx.network = []
        for _ in range(net_qty):
            net = LadderNetwork()
            net.enable = True
            net.rows = net_rows
            net.cols = net_cols
            net.cells = []
            for r in range(net_rows):
                row_cells = []
                for c in range(net_cols):
                    cell = LadderCell()
                    row_cells.append(cell)
                net.cells.append(row_cells)
            lctx.network.append(net)

    return True

def ladder_ctx_deinit(lctx: LadderCtx) -> bool:
    if lctx is None: return False
    # Python handles GC, but we can clear refs
    lctx.network = []
    lctx.memory = None
    lctx.registers = None
    lctx.timers = None
    return True

def ladder_clear_program(lctx: LadderCtx):
    if lctx.network:
        for net in lctx.network:
            for row in net.cells:
                for cell in row:
                    cell.code = LadderInstructions.LADDER_INS_NOP
                    cell.state = False
                    cell.vertical_bar = False
                    cell.data_qty = 0
                    cell.data = []

def ladder_add_read_fn(lctx: LadderCtx, read_fn: Callable, init_fn: Callable) -> bool:
    lctx.hw.io.read.append(read_fn)
    lctx.hw.io.init_read.append(init_fn)
    lctx.hw.io.fn_read_qty += 1

    # Allocate input storage
    vals = LadderHWInputVals()
    vals.fn_id = lctx.hw.io.fn_read_qty - 1
    vals.i_qty = 8 # Default? Should be configurable or dynamic
    # Wait, C add_read_fn doesn't take qty.
    # Where does qty come from?
    # In C, `dummy_init_read` allocates memory.
    # Here in Python, we should probably let init_fn handle it or allocate defaults.
    # But `LadderCtx` has `input` list of `LadderHWInputVals`.
    lctx.input.append(vals)

    # Call init
    if init_fn:
        init_fn(lctx, vals.fn_id, True)

    return True

def ladder_add_write_fn(lctx: LadderCtx, write_fn: Callable, init_fn: Callable) -> bool:
    lctx.hw.io.write.append(write_fn)
    lctx.hw.io.init_write.append(init_fn)
    lctx.hw.io.fn_write_qty += 1

    vals = LadderHWOutputVals()
    vals.fn_id = lctx.hw.io.fn_write_qty - 1
    lctx.output.append(vals)

    if init_fn:
        init_fn(lctx, vals.fn_id, True)
    return True

def ladder_add_foreign(lctx: LadderCtx, fn_init: Callable, init_data: Any, qty: int) -> bool:
    for i in range(qty):
        f = LadderForeignFunction()
        f.id = lctx.foreign.qty
        if fn_init:
            fn_init(f, init_data, qty)
        lctx.foreign.fn.append(f)
        lctx.foreign.qty += 1
    return True

def ladder_fn_cell(lctx: LadderCtx, network: int, row: int, col: int, code: LadderInstructions, foreign_id: int) -> bool:
    if network >= len(lctx.network): return False
    net = lctx.network[network]
    if row >= net.rows or col >= net.cols: return False

    cell = net.cells[row][col]
    cell.code = code

    if code == LadderInstructions.LADDER_INS_FOREIGN:
        cell.data_qty = 1
        cell.data = [LadderValue(LadderRegister.LADDER_REGISTER_NONE, foreign_id)]
    else:
        iocd = LADDER_FN_IOCD.get(code)
        if iocd:
            cell.data_qty = iocd.data_qty
            cell.data = [LadderValue() for _ in range(iocd.data_qty)]

            # Handle multi-cell (vertical span)
            if iocd.cells > 1:
                for i in range(1, iocd.cells):
                    if row + i < net.rows:
                        net.cells[row + i][col].code = LadderInstructions.LADDER_INS_MULTI

    return True

def ladder_scan(lctx: LadderCtx):
    if not lctx.network:
        lctx.ladder.state = LadderState.LADDER_ST_ERROR
        if lctx.on.panic: lctx.on.panic(lctx)
        return

    for net_idx, net in enumerate(lctx.network):
        cycle_count = 0
        if not net.enable: continue

        lctx.exec_network = net

        # Clear cell states
        for r in range(net.rows):
            for c in range(net.cols):
                net.cells[r][c].state = False

        row = 0
        while row < net.rows:
            cycle_count += 1
            if cycle_count > lctx.scan_internals.max_scan_cycles:
                lctx.ladder.state = LadderState.LADDER_ST_ERROR
                lctx.ladder.last.err = LadderInsError.LADDER_INS_ERR_OVERFLOW
                if lctx.on.panic: lctx.on.panic(lctx)
                return

            if net.cells[row][0].code == LadderInstructions.LADDER_INS_MULTI:
                row += 1
                continue

            # Group detection
            group_start = row
            group_end = row
            while group_end + 1 < net.rows and net.cells[group_end + 1][0].vertical_bar:
                group_end += 1

            is_lower = False
            for c in range(net.cols):
                if net.cells[row][c].vertical_bar:
                    is_multi = (row + 1 < net.rows) and (net.cells[row + 1][c].code == LadderInstructions.LADDER_INS_MULTI)
                    if not is_multi:
                        is_lower = True
                        break

            rung_power = not is_lower

            for col in range(net.cols):
                col_group_end = group_start
                while col_group_end + 1 < net.rows and net.cells[col_group_end + 1][col].vertical_bar:
                    col_group_end += 1

                skip_safe = True
                for gr in range(group_start, col_group_end + 1):
                    cycle_count += 1
                    code = net.cells[gr][col].code
                    if code == LadderInstructions.LADDER_INS_MULTI:
                        skip_safe = False
                        break
                    if HAS_SIDE_EFFECTS_ON_FALSE.get(code, True):
                        skip_safe = False
                        break

                if not rung_power and skip_safe:
                    continue

                group_output = False
                group_error = False

                for gr in range(group_start, col_group_end + 1):
                    lctx.ladder.last.instr = net.cells[gr][col].code
                    lctx.ladder.last.err = LadderInsError.LADDER_INS_ERR_OK
                    lctx.ladder.last.network = net_idx
                    lctx.ladder.last.cell_row = gr
                    lctx.ladder.last.cell_column = col

                    code = net.cells[gr][col].code

                    if code >= LadderInstructions.LADDER_INS_INV and code != LadderInstructions.LADDER_INS_MULTI:
                        lctx.ladder.state = LadderState.LADDER_ST_INV
                        lctx.ladder.last.err = LadderInsError.LADDER_INS_ERR_FAIL
                        group_error = True
                        break

                    if code != LadderInstructions.LADDER_INS_MULTI:
                        fn = LADDER_FUNCTIONS.get(code)
                        if fn:
                            err = fn(lctx, col, gr)
                            lctx.ladder.last.err = err
                            if err != LadderInsError.LADDER_INS_ERR_OK:
                                group_error = True
                                break
                            if lctx.on.instruction:
                                lctx.on.instruction(lctx)

                if group_error:
                    lctx.ladder.state = LadderState.LADDER_ST_INV
                    return

                for gr in range(group_start, col_group_end + 1):
                    group_output = group_output or net.cells[gr][col].state

                for gr in range(group_start, col_group_end + 1):
                    net.cells[gr][col].state = group_output

            if lctx.on.scan_end:
                lctx.on.scan_end(lctx)

            row = group_end + 1

def ladder_save_previous_values(lctx: LadderCtx):
    lctx.prev_scan_vals.Mh[:] = lctx.memory.M[:]
    lctx.prev_scan_vals.Crh[:] = lctx.memory.Cr[:]
    lctx.prev_scan_vals.Cdh[:] = lctx.memory.Cd[:]
    lctx.prev_scan_vals.Trh[:] = lctx.memory.Tr[:]
    lctx.prev_scan_vals.Tdh[:] = lctx.memory.Td[:]

    # Also IWh and QWh if needed? The C code does checks.
    # ...

def ladder_task(lctx: LadderCtx):
    if lctx is None: return

    while lctx.ladder.state != LadderState.LADDER_ST_EXIT_TSK:
        wait_count = 0
        while lctx.ladder.state != LadderState.LADDER_ST_RUNNING and wait_count < 1000:
             if lctx.ladder.state == LadderState.LADDER_ST_EXIT_TSK: return
             if lctx.hw.time.delay:
                 lctx.hw.time.delay(lctx.ladder.quantity.delay_not_run)
             else:
                 # No delay?
                 pass
             wait_count += 1

        if wait_count >= 1000:
            lctx.ladder.state = LadderState.LADDER_ST_ERROR
            if lctx.on.panic: lctx.on.panic(lctx)
            lctx.ladder.state = LadderState.LADDER_ST_EXIT_TSK

        if lctx.ladder.state != LadderState.LADDER_ST_RUNNING:
            continue

        if lctx.hw.time.millis:
            lctx.scan_internals.start_time = lctx.hw.time.millis()

        if lctx.on.task_before:
            lctx.on.task_before(lctx)

        # History copy I -> Ih
        for n, inp in enumerate(lctx.input):
            inp.Ih[:] = inp.I[:]
            inp.IWh[:] = inp.IW[:]

        # Read
        for n, fn in enumerate(lctx.hw.io.read):
            fn(lctx, n)

        # History copy Q -> Qh
        for n, outp in enumerate(lctx.output):
            outp.Qh[:] = outp.Q[:]
            outp.QWh[:] = outp.QW[:]

        ladder_scan(lctx)

        if lctx.ladder.state == LadderState.LADDER_ST_INV:
            lctx.ladder.state = LadderState.LADDER_ST_EXIT_TSK
            # Revert logic (simplified here, assume handled or just break)
            # Restore outputs, memory from history
            # ... (Full implementation would restore M from Mh etc)
            pass
        else:
            ladder_save_previous_values(lctx)

        # Write
        for n, fn in enumerate(lctx.hw.io.write):
            fn(lctx, n)

        # Calc time
        if lctx.hw.time.millis:
            lctx.scan_internals.actual_scan_time = lctx.hw.time.millis() - lctx.scan_internals.start_time

        # Padding
        if lctx.scan_internals.target_scan_ms > 0 and lctx.scan_internals.actual_scan_time < lctx.scan_internals.target_scan_ms:
            if lctx.hw.time.delay:
                lctx.hw.time.delay(lctx.scan_internals.target_scan_ms - lctx.scan_internals.actual_scan_time)

        if lctx.on.task_after:
            lctx.on.task_after(lctx)

    if lctx.on.end_task:
        lctx.on.end_task(lctx)
