import json
import os
from typing import Optional
from .ladder import (
    LadderCtx, LadderInstructions, LadderRegister, LadderBaseTime,
    LadderNetwork, LadderCell, LadderValue, ModulePort, LadderInsError
)
from .core import ladder_clear_program, ladder_fn_cell

STR_SYMBOL = [
    "NOP", "CONN", "NEG", "NO", "NC", "RE", "FE", "COIL", "COILL", "COILU",
    "TON", "TOFF", "TP", "CTU", "CTD", "MOV", "SUB", "ADD", "MUL", "DIV",
    "MOD", "SHL", "SHR", "ROL", "ROR", "AND", "OR", "XOR", "NOT", "EQ",
    "GT", "GE", "LT", "LE", "NE", "FOREIGN", "TMOV", "INV", "occupied"
]

STR_TYPES = [
    "NONE", "M", "Q", "I", "Cd", "Cr", "Td", "Tr", "IW", "QW",
    "C", "T", "D", "CSTR", "REAL", "INV"
]

STR_BASETIME = ["MS", "10MS", "100MS", "SEC", "MIN"]

def get_instruction_code(symbol: str) -> LadderInstructions:
    if symbol == "occupied":
        return LadderInstructions.LADDER_INS_MULTI
    if symbol == "MOV": # Alias for MOVE
        return LadderInstructions.LADDER_INS_MOVE
    if symbol == "TOFF": # Alias check
        return LadderInstructions.LADDER_INS_TOF
    if symbol == "TMOV":
        return LadderInstructions.LADDER_INS_TMOVE
    try:
        idx = STR_SYMBOL.index(symbol)
        if idx < len(LadderInstructions):
            return LadderInstructions(idx)
    except ValueError:
        pass
    return LadderInstructions.LADDER_INS_INV

def get_register_code(type_str: str) -> LadderRegister:
    try:
        idx = STR_TYPES.index(type_str)
        return LadderRegister(idx)
    except ValueError:
        pass
    # Check basetime too? C code does checks str_basetime too but returns it as register code?
    # No, C code `get_register_code` checks `str_types` then `str_basetime`.
    # But `LadderRegister` enum doesn't overlap with `LadderBaseTime`.
    # Wait, `LADDER_REGISTER_NONE`=0. `LADDER_BASETIME_MS`=0.
    # The C code returns `i` from `str_basetime` loop.
    # This confirms that `type` field in `LadderValue` can hold `LadderBaseTime` enum value.
    try:
        idx = STR_BASETIME.index(type_str)
        return LadderRegister(idx) # This is technically casting BaseTime to Register enum type
    except ValueError:
        pass
    return LadderRegister.LADDER_REGISTER_INV

def parse_module_port(s: str) -> Optional[ModulePort]:
    try:
        parts = s.split('.')
        if len(parts) == 2:
            mod = int(parts[0])
            port = int(parts[1])
            if 0 <= mod <= 255 and 0 <= port <= 255:
                return ModulePort(mod, port)
    except:
        pass
    return None

def ladder_json_to_program(prg: str, lctx: LadderCtx) -> int:
    if not os.path.exists(prg):
        return 1 # JSON_ERROR_OPENFILE

    try:
        with open(prg, 'r') as f:
            data = json.load(f)
    except:
        return 2 # JSON_ERROR_PARSE

    if not isinstance(data, list):
        return 6 # JSON_ERROR_TYPE_INV

    ladder_clear_program(lctx)

    for net_obj in data:
        if not isinstance(net_obj, dict): continue

        nid = net_obj.get("id")
        if nid is None or nid >= lctx.ladder.quantity.networks: continue

        rows = net_obj.get("rows")
        cols = net_obj.get("cols")
        network_data = net_obj.get("networkData")

        net = lctx.network[nid]
        net.enable = True

        # In C, it reallocates if size differs. Python lists are dynamic.
        # We should resize if needed or just replace.
        # `ladder_ctx_init` already allocated default size.
        # If JSON specifies different size, we should respect it.

        # Helper to resize/create
        net.rows = rows
        net.cols = cols
        net.cells = []
        for r in range(rows):
            row_cells = []
            for c in range(cols):
                row_cells.append(LadderCell())
            net.cells.append(row_cells)

        if not network_data or len(network_data) != rows:
            # Error or skip
            continue

        for r in range(rows):
            row_arr = network_data[r]
            if len(row_arr) != cols: continue

            for c in range(cols):
                cell_obj = row_arr[c]
                symbol = cell_obj.get("symbol")
                code = get_instruction_code(symbol)

                cell = net.cells[r][c]
                cell.code = code
                cell.vertical_bar = cell_obj.get("bar", False)

                data_arr = cell_obj.get("data", [])
                cell.data_qty = len(data_arr)
                cell.data = []

                for d, data_obj in enumerate(data_arr):
                    val = LadderValue()
                    name = data_obj.get("name")
                    type_str = data_obj.get("type")
                    value_str = data_obj.get("value")

                    if code in (LadderInstructions.LADDER_INS_TON, LadderInstructions.LADDER_INS_TOF, LadderInstructions.LADDER_INS_TP) and d == 1:
                        # Basetime
                        bt_idx = -1
                        try:
                            bt_idx = STR_BASETIME.index(type_str)
                        except ValueError:
                            pass
                        if bt_idx != -1:
                            val.type = LadderRegister(bt_idx) # Hack reuse type field
                            val.i32 = int(value_str)
                    else:
                        reg_type = get_register_code(type_str)
                        val.type = reg_type

                        if reg_type == LadderRegister.LADDER_REGISTER_S:
                            val.value = value_str
                        elif reg_type == LadderRegister.LADDER_REGISTER_R:
                            val.value = float(value_str)
                        elif reg_type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q,
                                          LadderRegister.LADDER_REGISTER_IW, LadderRegister.LADDER_REGISTER_QW):
                            mp = parse_module_port(value_str)
                            if mp: val.mp = mp
                        else:
                            # Numeric
                            if value_str:
                                try:
                                    val.i32 = int(float(value_str)) # float() handles "0.0" if any
                                except:
                                    val.i32 = 0
                            else:
                                val.i32 = 0

                    cell.data.append(val)

    return 0 # JSON_ERROR_OK

def ladder_program_to_json(prg: str, lctx: LadderCtx) -> int:
    root = []

    for n, net in enumerate(lctx.network):
        net_obj = {
            "id": n,
            "rows": net.rows,
            "cols": net.cols,
            "networkData": []
        }

        for r in range(net.rows):
            row_arr = []
            for c in range(net.cols):
                cell = net.cells[r][c]
                cell_obj = {}

                try:
                    sym = STR_SYMBOL[cell.code]
                except IndexError:
                    sym = "INV"

                cell_obj["symbol"] = sym
                cell_obj["bar"] = cell.vertical_bar
                cell_obj["data"] = []

                # In C `get_data_name` logic is complex.
                # Simplified port based on logic or just generic names
                # For demo purposes, we can use generic or implement logic.

                for d, val in enumerate(cell.data):
                    data_obj = {}
                    # Name logic
                    name = "value"
                    # Simplified name logic from C
                    if cell.code in (LadderInstructions.LADDER_INS_TON, LadderInstructions.LADDER_INS_TOF, LadderInstructions.LADDER_INS_TP):
                        name = "timer" if d == 0 else "basetime"
                    elif cell.code in (LadderInstructions.LADDER_INS_CTU, LadderInstructions.LADDER_INS_CTD):
                        name = "counter" if d == 0 else "preset value"
                    # ... add more if needed
                    data_obj["name"] = name

                    type_str = "INV"
                    if val.type < len(STR_TYPES):
                        type_str = STR_TYPES[val.type]

                    # Special handling for basetime
                    if cell.code in (LadderInstructions.LADDER_INS_TON, LadderInstructions.LADDER_INS_TOF, LadderInstructions.LADDER_INS_TP) and d == 1:
                         if val.type < len(STR_BASETIME):
                             type_str = STR_BASETIME[val.type]

                    data_obj["type"] = type_str

                    val_str = ""
                    if cell.code in (LadderInstructions.LADDER_INS_TON, LadderInstructions.LADDER_INS_TOF, LadderInstructions.LADDER_INS_TP) and d == 1:
                        val_str = str(val.i32)
                    elif val.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q):
                        val_str = f"{val.mp.module}.{val.mp.port}"
                    elif val.type == LadderRegister.LADDER_REGISTER_S:
                        val_str = str(val.value)
                    elif val.type == LadderRegister.LADDER_REGISTER_R:
                        val_str = f"{float(val.value):f}"
                    else:
                        val_str = str(val.i32)

                    data_obj["value"] = val_str
                    cell_obj["data"].append(data_obj)

                row_arr.append(cell_obj)
            net_obj["networkData"].append(row_arr)
        root.append(net_obj)

    try:
        with open(prg, 'w') as f:
            json.dump(root, f, indent=2)
    except:
        return 16 # JSON_ERROR_WRITEFILE

    return 0
