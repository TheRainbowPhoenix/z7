from typing import Any, Tuple, Optional
from .ladder import (
    LadderCtx, LadderRegister, LadderDataType, LadderInsError,
    LadderState, LadderInstructions, LadderValue
)

INT32_MAX = 2147483647
INT32_MIN = -2147483648
UINT32_MAX = 4294967295

def ladder_cell_data_exec(lctx: LadderCtx, r: int, c: int, i: int) -> LadderValue:
    if lctx.exec_network:
        return lctx.exec_network.cells[r][c].data[i]
    return LadderValue()

def ladder_get_type(lctx: LadderCtx, r: int, c: int, i: int) -> LadderRegister:
    if lctx.exec_network:
        return lctx.exec_network.cells[r][c].data[i].type
    return LadderRegister.LADDER_REGISTER_NONE

def CELL_STATE(lctx: LadderCtx, c: int, r: int) -> bool:
    if lctx.exec_network and r < len(lctx.exec_network.cells) and c < len(lctx.exec_network.cells[r]):
        return lctx.exec_network.cells[r][c].state
    return False

def SET_CELL_STATE(lctx: LadderCtx, c: int, r: int, val: bool):
    if lctx.exec_network and r < len(lctx.exec_network.cells) and c < len(lctx.exec_network.cells[r]):
        lctx.exec_network.cells[r][c].state = val

def CELL_STATE_LEFT(lctx: LadderCtx, c: int, r: int) -> bool:
    if c == 0:
        return True
    return CELL_STATE(lctx, c - 1, r)

def LADDER_VERTICAL_BAR(lctx: LadderCtx, n: int, r: int, c: int) -> bool:
    if lctx and n < len(lctx.network):
        net = lctx.network[n]
        if r < net.rows and c < net.cols:
            return net.cells[r][c].vertical_bar
    return False

def safe_get_register_index(lctx: LadderCtx, type_: LadderRegister, raw_idx: int) -> Tuple[int, LadderInsError]:
    if lctx is None:
        return -1, LadderInsError.LADDER_INS_ERR_FAIL

    if raw_idx < 0:
        return -1, LadderInsError.LADDER_INS_ERR_OUTOFRANGE

    idx = raw_idx
    qty = 0

    if type_ == LadderRegister.LADDER_REGISTER_M:
        if not lctx.memory.M: return -1, LadderInsError.LADDER_INS_ERR_FAIL
        qty = lctx.ladder.quantity.m
    elif type_ == LadderRegister.LADDER_REGISTER_Cd:
        if not lctx.memory.Cd: return -1, LadderInsError.LADDER_INS_ERR_FAIL
        qty = lctx.ladder.quantity.c
    elif type_ == LadderRegister.LADDER_REGISTER_Cr:
        if not lctx.memory.Cr: return -1, LadderInsError.LADDER_INS_ERR_FAIL
        qty = lctx.ladder.quantity.c
    elif type_ == LadderRegister.LADDER_REGISTER_C:
        if not lctx.registers.C: return -1, LadderInsError.LADDER_INS_ERR_FAIL
        qty = lctx.ladder.quantity.c
    elif type_ == LadderRegister.LADDER_REGISTER_Td:
        if not lctx.memory.Td: return -1, LadderInsError.LADDER_INS_ERR_FAIL
        qty = lctx.ladder.quantity.t
    elif type_ == LadderRegister.LADDER_REGISTER_Tr:
        if not lctx.memory.Tr: return -1, LadderInsError.LADDER_INS_ERR_FAIL
        qty = lctx.ladder.quantity.t
    elif type_ == LadderRegister.LADDER_REGISTER_T:
        if not lctx.timers: return -1, LadderInsError.LADDER_INS_ERR_FAIL
        qty = lctx.ladder.quantity.t
    elif type_ == LadderRegister.LADDER_REGISTER_D:
        if not lctx.registers.D: return -1, LadderInsError.LADDER_INS_ERR_FAIL
        qty = lctx.ladder.quantity.d
    elif type_ == LadderRegister.LADDER_REGISTER_R:
        if not lctx.registers.R: return -1, LadderInsError.LADDER_INS_ERR_FAIL
        qty = lctx.ladder.quantity.r
    else:
        return -1, LadderInsError.LADDER_INS_ERR_TYPEMISMATCH

    if idx >= qty:
        return -1, LadderInsError.LADDER_INS_ERR_OUTOFRANGE

    return idx, LadderInsError.LADDER_INS_ERR_OK

def safe_check_module_port(lctx: LadderCtx, type_: LadderRegister, mod: int, port: int) -> Tuple[bool, int, LadderInsError]:
    fn_qty = 0
    qty_out = 0

    if type_ in (LadderRegister.LADDER_REGISTER_Q, LadderRegister.LADDER_REGISTER_QW):
        if not lctx.output:
            return False, 0, LadderInsError.LADDER_INS_ERR_FAIL
        fn_qty = lctx.hw.io.fn_write_qty
    elif type_ in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_IW):
        if not lctx.input:
            return False, 0, LadderInsError.LADDER_INS_ERR_FAIL
        fn_qty = lctx.hw.io.fn_read_qty
    else:
        return False, 0, LadderInsError.LADDER_INS_ERR_TYPEMISMATCH

    if mod >= fn_qty:
        return False, 0, LadderInsError.LADDER_INS_ERR_OUTOFRANGE

    if type_ == LadderRegister.LADDER_REGISTER_Q:
        qty_out = lctx.output[mod].q_qty
    elif type_ == LadderRegister.LADDER_REGISTER_QW:
        qty_out = lctx.output[mod].qw_qty
    elif type_ == LadderRegister.LADDER_REGISTER_I:
        qty_out = lctx.input[mod].i_qty
    elif type_ == LadderRegister.LADDER_REGISTER_IW:
        qty_out = lctx.input[mod].iw_qty

    if port >= qty_out:
        return False, 0, LadderInsError.LADDER_INS_ERR_OUTOFRANGE

    return True, qty_out, LadderInsError.LADDER_INS_ERR_OK

def ladder_get_data_value(lctx: LadderCtx, r: int, c: int, i: int) -> int:
    if lctx is None or lctx.exec_network is None:
        return 0
    net = lctx.exec_network
    if r >= net.rows or c >= net.cols or i >= net.cells[r][c].data_qty:
        return 0

    cell_data = net.cells[r][c].data[i]
    type_ = cell_data.type
    val = cell_data.value # This might be int, ModulePort etc.

    if type_ == LadderRegister.LADDER_REGISTER_NONE:
        return int(cell_data.i32)
    elif type_ in (LadderRegister.LADDER_REGISTER_M, LadderRegister.LADDER_REGISTER_Cd, LadderRegister.LADDER_REGISTER_Cr,
                   LadderRegister.LADDER_REGISTER_Td, LadderRegister.LADDER_REGISTER_Tr, LadderRegister.LADDER_REGISTER_C,
                   LadderRegister.LADDER_REGISTER_T, LadderRegister.LADDER_REGISTER_D, LadderRegister.LADDER_REGISTER_R):
        idx, err = safe_get_register_index(lctx, type_, cell_data.i32)
        if err != LadderInsError.LADDER_INS_ERR_OK:
            lctx.ladder.last.err = err
            if err in (LadderInsError.LADDER_INS_ERR_FAIL, LadderInsError.LADDER_INS_ERR_TYPEMISMATCH):
                lctx.ladder.state = LadderState.LADDER_ST_ERROR
                if lctx.on.panic:
                    lctx.on.panic(lctx)
            return 0

        if type_ == LadderRegister.LADDER_REGISTER_M:
            return int(lctx.memory.M[idx])
        elif type_ == LadderRegister.LADDER_REGISTER_Cd:
            return int(lctx.memory.Cd[idx])
        elif type_ == LadderRegister.LADDER_REGISTER_Cr:
            return int(lctx.memory.Cr[idx])
        elif type_ == LadderRegister.LADDER_REGISTER_Td:
            return int(lctx.memory.Td[idx])
        elif type_ == LadderRegister.LADDER_REGISTER_Tr:
            return int(lctx.memory.Tr[idx])
        elif type_ == LadderRegister.LADDER_REGISTER_C:
            return int(lctx.registers.C[idx])
        elif type_ == LadderRegister.LADDER_REGISTER_T:
            acc = lctx.timers[idx].acc
            if acc > INT32_MAX: return INT32_MAX
            return int(acc)
        elif type_ == LadderRegister.LADDER_REGISTER_D:
            return int(lctx.registers.D[idx])
        elif type_ == LadderRegister.LADDER_REGISTER_R:
            return int(lctx.registers.R[idx])

    elif type_ == LadderRegister.LADDER_REGISTER_Q:
        mp = cell_data.mp
        if mp.module >= lctx.hw.io.fn_write_qty: return 0
        return int(lctx.output[mp.module].Q[mp.port])
    elif type_ == LadderRegister.LADDER_REGISTER_I:
        mp = cell_data.mp
        if mp.module >= lctx.hw.io.fn_read_qty: return 0
        return int(lctx.input[mp.module].I[mp.port])
    elif type_ == LadderRegister.LADDER_REGISTER_IW:
        mp = cell_data.mp
        if mp.module >= lctx.hw.io.fn_read_qty: return 0
        return int(lctx.input[mp.module].IW[mp.port])
    elif type_ == LadderRegister.LADDER_REGISTER_QW:
        mp = cell_data.mp
        if mp.module >= lctx.hw.io.fn_write_qty: return 0
        return int(lctx.output[mp.module].QW[mp.port])

    return 0

def ladder_get_previous_value(lctx: LadderCtx, r: int, c: int, i: int) -> int:
    if lctx is None or lctx.exec_network is None: return 0
    net = lctx.exec_network
    if r >= net.rows or c >= net.cols or i >= net.cells[r][c].data_qty: return 0

    cell_data = net.cells[r][c].data[i]
    type_ = cell_data.type

    if type_ == LadderRegister.LADDER_REGISTER_M:
        return int(lctx.prev_scan_vals.Mh[cell_data.i32])
    elif type_ == LadderRegister.LADDER_REGISTER_Q:
        mp = cell_data.mp
        if mp.module >= lctx.hw.io.fn_write_qty: return 0
        if not lctx.output[mp.module].Qh: return 0
        if mp.port >= lctx.output[mp.module].q_qty: return 0
        return int(lctx.output[mp.module].Qh[mp.port])
    elif type_ == LadderRegister.LADDER_REGISTER_I:
        mp = cell_data.mp
        if mp.module >= lctx.hw.io.fn_read_qty: return 0
        if not lctx.input[mp.module].Ih: return 0
        if mp.port >= lctx.input[mp.module].i_qty: return 0
        return int(lctx.input[mp.module].Ih[mp.port])
    elif type_ == LadderRegister.LADDER_REGISTER_Cd:
        return int(lctx.prev_scan_vals.Cdh[cell_data.i32])
    elif type_ == LadderRegister.LADDER_REGISTER_Cr:
        return int(lctx.prev_scan_vals.Crh[cell_data.i32])
    elif type_ == LadderRegister.LADDER_REGISTER_Td:
        return int(lctx.prev_scan_vals.Tdh[cell_data.i32])
    elif type_ == LadderRegister.LADDER_REGISTER_Tr:
        return int(lctx.prev_scan_vals.Trh[cell_data.i32])
    elif type_ == LadderRegister.LADDER_REGISTER_IW:
        mp = cell_data.mp
        if mp.module >= lctx.hw.io.fn_read_qty: return 0
        return int(lctx.input[mp.module].IW[mp.port])
    elif type_ == LadderRegister.LADDER_REGISTER_QW:
        mp = cell_data.mp
        if mp.module >= lctx.hw.io.fn_write_qty: return 0
        return int(lctx.output[mp.module].QW[mp.port])
    elif type_ == LadderRegister.LADDER_REGISTER_C:
        return int(lctx.registers.C[cell_data.i32])
    elif type_ == LadderRegister.LADDER_REGISTER_T:
        return int(lctx.timers[cell_data.i32].acc)
    elif type_ == LadderRegister.LADDER_REGISTER_D:
        return int(lctx.registers.D[cell_data.i32])
    elif type_ == LadderRegister.LADDER_REGISTER_R:
        return int(lctx.registers.R[cell_data.i32])

    return 0

def ladder_get_data_int32(lctx: LadderCtx, r: int, c: int, i: int) -> int:
    return ladder_get_data_value(lctx, r, c, i) # logic is mostly same as get_data_value in C impl for int32

def ladder_get_data_float(lctx: LadderCtx, r: int, c: int, i: int) -> float:
    if lctx is None or lctx.exec_network is None: return 0.0
    net = lctx.exec_network
    if r >= net.rows or c >= net.cols or i >= net.cells[r][c].data_qty: return 0.0

    cell_data = net.cells[r][c].data[i]
    type_ = cell_data.type

    if type_ == LadderRegister.LADDER_REGISTER_NONE:
        return float(cell_data.i32)
    elif type_ == LadderRegister.LADDER_REGISTER_R:
        return float(lctx.registers.R[cell_data.i32])
    else:
        return float(ladder_get_data_value(lctx, r, c, i))

def ladder_set_data_value(lctx: LadderCtx, r: int, c: int, pos: int, value: Any) -> LadderInsError:
    cell_data = ladder_cell_data_exec(lctx, r, c, pos)
    type_ = cell_data.type

    if type_ == LadderRegister.LADDER_REGISTER_S:
        return LadderInsError.LADDER_INS_ERR_SETDATAVAL

    idx = 0
    err = LadderInsError.LADDER_INS_ERR_OK

    if type_ in (LadderRegister.LADDER_REGISTER_M, LadderRegister.LADDER_REGISTER_Cd, LadderRegister.LADDER_REGISTER_Cr,
                 LadderRegister.LADDER_REGISTER_Td, LadderRegister.LADDER_REGISTER_Tr, LadderRegister.LADDER_REGISTER_C,
                 LadderRegister.LADDER_REGISTER_D, LadderRegister.LADDER_REGISTER_R):
        idx, err = safe_get_register_index(lctx, type_, cell_data.i32)
        if err != LadderInsError.LADDER_INS_ERR_OK: return err

    elif type_ in (LadderRegister.LADDER_REGISTER_Q, LadderRegister.LADDER_REGISTER_I,
                   LadderRegister.LADDER_REGISTER_IW, LadderRegister.LADDER_REGISTER_QW):
        mp = cell_data.mp
        success, qty, err = safe_check_module_port(lctx, type_, mp.module, mp.port)
        if not success: return err
        idx = mp.port
    else:
        return LadderInsError.LADDER_INS_ERR_SETDATAVAL

    if type_ == LadderRegister.LADDER_REGISTER_M:
        if lctx.memory.M: lctx.memory.M[idx] = int(value)
    elif type_ == LadderRegister.LADDER_REGISTER_Q:
        if lctx.output[cell_data.mp.module].Q: lctx.output[cell_data.mp.module].Q[idx] = int(value)
    elif type_ == LadderRegister.LADDER_REGISTER_I:
        if lctx.input[cell_data.mp.module].I: lctx.input[cell_data.mp.module].I[idx] = int(value)
    elif type_ == LadderRegister.LADDER_REGISTER_Cd:
        if lctx.memory.Cd: lctx.memory.Cd[idx] = bool(value)
    elif type_ == LadderRegister.LADDER_REGISTER_Cr:
        if lctx.memory.Cr: lctx.memory.Cr[idx] = bool(value)
    elif type_ == LadderRegister.LADDER_REGISTER_Td:
        if lctx.memory.Td: lctx.memory.Td[idx] = bool(value)
    elif type_ == LadderRegister.LADDER_REGISTER_Tr:
        if lctx.memory.Tr: lctx.memory.Tr[idx] = bool(value)
    elif type_ == LadderRegister.LADDER_REGISTER_IW:
        if lctx.input[cell_data.mp.module].IW: lctx.input[cell_data.mp.module].IW[idx] = int(value)
    elif type_ == LadderRegister.LADDER_REGISTER_QW:
        if lctx.output[cell_data.mp.module].QW: lctx.output[cell_data.mp.module].QW[idx] = int(value)
    elif type_ == LadderRegister.LADDER_REGISTER_C:
        if lctx.registers.C: lctx.registers.C[idx] = int(value)
    elif type_ == LadderRegister.LADDER_REGISTER_D:
        if lctx.registers.D: lctx.registers.D[idx] = int(value)
    elif type_ == LadderRegister.LADDER_REGISTER_R:
        if lctx.registers.R: lctx.registers.R[idx] = float(value)
    else:
        return LadderInsError.LADDER_INS_ERR_SETDATAVAL

    return LadderInsError.LADDER_INS_ERR_OK
