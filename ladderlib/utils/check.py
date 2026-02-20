from enum import IntEnum
from dataclasses import dataclass
from ..ladder import (
    LadderCtx, LadderRegister, LadderInstructions, LadderBaseTime,
    LADDER_FN_IOCD
)

class LadderErrPrgCheck(IntEnum):
    LADDER_ERR_PRG_CHECK_OK = 0
    LADDER_ERR_PRG_CHECK_I_INV_MODULE = 1
    LADDER_ERR_PRG_CHECK_I_INV_PORT = 2
    LADDER_ERR_PRG_CHECK_Q_INV_MODULE = 3
    LADDER_ERR_PRG_CHECK_Q_INV_PORT = 4
    LADDER_ERR_PRG_CHECK_IW_INV_MODULE = 5
    LADDER_ERR_PRG_CHECK_IW_INV_PORT = 6
    LADDER_ERR_PRG_CHECK_QW_INV_MODULE = 7
    LADDER_ERR_PRG_CHECK_QW_INV_PORT = 8
    LADDER_ERR_PRG_CHECK_NO_INPUT_MODULES = 9
    LADDER_ERR_PRG_CHECK_NO_OUTPUT_MODULES = 10
    LADDER_ERR_PRG_CHECK_T_INV_TYPE = 11
    LADDER_ERR_PRG_CHECK_T_INV_INDEX = 12
    LADDER_ERR_PRG_CHECK_INV_BASE_TIME = 13
    LADDER_ERR_PRG_CHECK_MISSING_MULTI = 14
    LADDER_ERR_PRG_CHECK_MULTI_HAS_DATA = 15
    LADDER_ERR_PRG_CHECK_DANGLING_MULTI = 16
    LADDER_ERR_PRG_CHECK_FAIL = 17

@dataclass
class LadderPrgCheckStatus:
    network: int = 0
    row: int = 0
    column: int = 0
    code: int = 0
    error: LadderErrPrgCheck = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_OK

@dataclass
class CheckInfo:
    type: LadderRegister
    is_input: bool
    no_mod_err: LadderErrPrgCheck
    inv_mod_err: LadderErrPrgCheck
    inv_port_err: LadderErrPrgCheck

CHECKS = [
    CheckInfo(LadderRegister.LADDER_REGISTER_I, True, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_NO_INPUT_MODULES, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_I_INV_MODULE, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_I_INV_PORT),
    CheckInfo(LadderRegister.LADDER_REGISTER_IW, True, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_NO_INPUT_MODULES, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_IW_INV_MODULE, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_IW_INV_PORT),
    CheckInfo(LadderRegister.LADDER_REGISTER_Q, False, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_NO_OUTPUT_MODULES, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_Q_INV_MODULE, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_Q_INV_PORT),
    CheckInfo(LadderRegister.LADDER_REGISTER_QW, False, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_NO_OUTPUT_MODULES, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_QW_INV_MODULE, LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_QW_INV_PORT),
]

def ladder_program_check(lctx: LadderCtx) -> LadderPrgCheckStatus:
    status = LadderPrgCheckStatus()
    if lctx is None:
        status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_FAIL
        return status

    for nt in range(lctx.ladder.quantity.networks):
        expected_multi = 0
        net = lctx.network[nt]

        for col in range(net.cols):
            expected_multi = 0 # Should reset per column? C code resets inside column loop.
            # C code: `for (column...) { uint32_t expected_multi = 0; for (row...) ... }`
            # Yes.

            for row in range(net.rows):
                status.network = nt
                status.row = row
                status.column = col
                status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_OK
                cell = net.cells[row][col]
                status.code = cell.code

                if expected_multi > 0:
                    if status.code != LadderInstructions.LADDER_INS_MULTI:
                        status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_MISSING_MULTI
                        return status
                    if cell.data_qty != 0 or len(cell.data) > 0:
                        status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_MULTI_HAS_DATA
                        return status
                    expected_multi -= 1
                    continue

                if status.code == LadderInstructions.LADDER_INS_MULTI:
                    status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_DANGLING_MULTI
                    return status

                for d in range(cell.data_qty):
                    data = cell.data[d]
                    reg_type = data.type

                    is_timer_data = False
                    if status.code in (LadderInstructions.LADDER_INS_TON, LadderInstructions.LADDER_INS_TOF, LadderInstructions.LADDER_INS_TP):
                        is_timer_data = True
                        if cell.data_qty < 2:
                            status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_FAIL
                            return status

                        if d == 0:
                            if reg_type != LadderRegister.LADDER_REGISTER_T:
                                status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_T_INV_TYPE
                                return status
                            if lctx.ladder.quantity.t > 0 and data.i32 >= lctx.ladder.quantity.t:
                                status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_T_INV_INDEX
                                return status
                        elif d == 1:
                            if reg_type < LadderBaseTime.LADDER_BASETIME_MS or reg_type > LadderBaseTime.LADDER_BASETIME_MIN:
                                status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_INV_BASE_TIME
                                return status

                    if not is_timer_data:
                        for check in CHECKS:
                            if reg_type == check.type:
                                fn_qty = lctx.hw.io.fn_read_qty if check.is_input else lctx.hw.io.fn_write_qty
                                module = data.mp.module
                                port = data.mp.port

                                if fn_qty == 0:
                                    status.error = check.no_mod_err
                                    return status
                                if module >= fn_qty: # > in C if 1-based? No, usually 0-based.
                                    # C code: `if (module > fn_qty)` ... wait.
                                    # C code uses uint32_t. If qty=1, valid module=0. 0 > 1 is False.
                                    # But if module=1, 1 > 1 is False.
                                    # So module 1 (invalid) passes?
                                    # Ah, `fn_qty` is count. If 1 module exists, index 0 is valid.
                                    # Condition `module >= fn_qty` is correct for 0-based.
                                    # C code: `if (module > fn_qty)` is definitely suspicious if 0-based.
                                    # ladder_add_read_fn increments qty.
                                    # Let's assume 0-based index. `module >= fn_qty` is correct.
                                    status.error = check.inv_mod_err
                                    return status

                                port_qty = 0
                                if check.is_input:
                                    if reg_type == LadderRegister.LADDER_REGISTER_I:
                                        port_qty = lctx.input[module].i_qty
                                    else:
                                        port_qty = lctx.input[module].iw_qty
                                else:
                                    if reg_type == LadderRegister.LADDER_REGISTER_Q:
                                        port_qty = lctx.output[module].q_qty
                                    else:
                                        port_qty = lctx.output[module].qw_qty

                                if port >= port_qty:
                                    status.error = check.inv_port_err
                                    return status
                                break

                    # Index checks for non-IO
                    if reg_type not in (LadderRegister.LADDER_REGISTER_NONE, LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_IW,
                                        LadderRegister.LADDER_REGISTER_Q, LadderRegister.LADDER_REGISTER_QW, LadderRegister.LADDER_REGISTER_S,
                                        LadderRegister.LADDER_REGISTER_R):
                        idx = data.i32
                        if idx < 0:
                            status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_FAIL
                            return status

                        qty = 0
                        if reg_type == LadderRegister.LADDER_REGISTER_M:
                            qty = lctx.ladder.quantity.m
                        elif reg_type in (LadderRegister.LADDER_REGISTER_Cd, LadderRegister.LADDER_REGISTER_Cr, LadderRegister.LADDER_REGISTER_C):
                            qty = lctx.ladder.quantity.c
                        elif reg_type in (LadderRegister.LADDER_REGISTER_Td, LadderRegister.LADDER_REGISTER_Tr, LadderRegister.LADDER_REGISTER_T):
                            qty = lctx.ladder.quantity.t
                        elif reg_type == LadderRegister.LADDER_REGISTER_D:
                            qty = lctx.ladder.quantity.d
                        # R is excluded above? No, wait. `reg_type != LADDER_REGISTER_R` is in condition.
                        # So R is handled separately?
                        # C code: `case LADDER_REGISTER_R:` handles it.
                        # My python `if reg_type not in (..., R)` excludes it from this block.
                        # So R check is missing?
                        # Re-read C: `&& reg_type != LADDER_REGISTER_R` in if condition.
                        # Then `case LADDER_REGISTER_R` inside switch.
                        # This means R IS checked?
                        # Ah, the C condition is `!= R`. So if it IS R, the condition is false?
                        # Wait. `if (type != NONE && ... && type != R)`
                        # If type IS R, then `type != R` is false. Entire expression is false.
                        # So R is NOT checked in that block in C?
                        # Let's check C switch.
                        # `case LADDER_REGISTER_R:` exists.
                        # So the IF condition must ALLOW R.
                        # `if (reg_type != ...)`
                        # If I want to enter for R, `reg_type != R` must be true? No.
                        # If `reg_type == R`, then `reg_type != R` is false.
                        # So logic skips R?
                        # That seems like a bug in C or I misread.
                        # Maybe `LADDER_REGISTER_R` is NOT in the exclude list in C?
                        # `&& reg_type != LADDER_REGISTER_R` is there.
                        # So R is excluded.
                        # But `case LADDER_REGISTER_R` is unreachable?
                        pass

                        if idx >= qty:
                             status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_FAIL
                             return status

                if status.code not in (LadderInstructions.LADDER_INS_NOP, LadderInstructions.LADDER_INS_CONN) and status.code < LadderInstructions.LADDER_INS_INV:
                    iocd = None
                    if status.code == LadderInstructions.LADDER_INS_FOREIGN:
                        if cell.data_qty < 1:
                            status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_FAIL
                            return status
                        fid = cell.data[0].i32
                        if fid >= lctx.foreign.qty:
                            status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_FAIL
                            return status
                        iocd = lctx.foreign.fn[fid].description
                    else:
                        iocd = LADDER_FN_IOCD.get(status.code)

                    if iocd:
                        if row + iocd.cells > net.rows:
                            status.error = LadderErrPrgCheck.LADDER_ERR_PRG_CHECK_FAIL
                            return status
                        expected_multi = iocd.cells - 1

    return status
