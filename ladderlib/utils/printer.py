import math
from ..ladder import (
    LadderCtx, LadderInstructions, LadderRegister, LadderBaseTime,
    LADDER_FN_IOCD, LadderValue, LADDER_MAX_ROWS, LADDER_MAX_COLS
)
from ..fn_commons import CELL_STATE, LADDER_VERTICAL_BAR

FN_SYMBOL = [
    "   ", "---", "(!)", "| |", "|/|", "-RE", "-FE", "( )", "(L)", "(U)",
    "TON", "TOF", "-TP", "CTU", "CTD", "MOV", "SUB", "ADD", "MUL", "DIV",
    "MOD", "SHL", "SHR", "ROL", "ROR", "AND", "OR-", "XOR", "NOT", "EQ-",
    "GT-", "GE-", "LT-", "LE-", "NE-", "FGN", "TMV", "???"
]

DT_GRAPH = [
    "--", " M", " Q", " I", "Cd", "Cr", "Td", "Tr", "IW", "QW",
    " C", " T", " D", "ST", "RE", "??"
]

BASETIME_GRAPH = ["ms   ", "10ms ", "100ms", "seg  ", "min  "]

def pin_out(lctx, n, r, c):
    net = lctx.network[n]
    bar = LADDER_VERTICAL_BAR(lctx, n, r, c)
    next_bar = False
    if r <= net.rows - 2:
        next_bar = LADDER_VERTICAL_BAR(lctx, n, r + 1, c)
    return "-+" if (bar or next_bar) else "--"

def space_bar(lctx, n, r, c):
    net = lctx.network[n]
    next_bar = False
    if r <= net.rows - 2:
        next_bar = LADDER_VERTICAL_BAR(lctx, n, r + 1, c)
    return "|" if next_bar else " "

def ftos(f, n, decimals):
    if abs(f) > 999999.99:
        return "OVF     "[:n]

    if decimals == 0:
        val = int(f + (-0.5 if f < 0 else 0.5))
        return f"{val}      "[:n]
    elif decimals < 0:
        scale = pow(10.0, -decimals)
        val = int(f / scale + (-0.5 if f < 0 else 0.5))
        return f"{val}      "[:n]
    else:
        sign = -1 if f < 0 else 1
        ifl = int(f)
        frac = abs(f - ifl)
        g = pow(10.0, decimals)
        frac *= g
        frac += 0.5
        if frac >= g:
            frac -= g
            ifl += sign
        E = int(frac)
        fmt = "{:d}.{:0" + str(decimals) + "d}  "
        return fmt.format(ifl, E)[:n]

def fn_to_str(lctx, net_idx, r, c):
    # Returns 6 lines of 32 chars
    cells = [""] * 6

    net = lctx.network[net_idx]
    cell = net.cells[r][c]
    code = cell.code

    if code == LadderInstructions.LADDER_INS_NOP:
        vb = "+" if LADDER_VERTICAL_BAR(lctx, net_idx, r, c) else " "
        cells[0] = f"                  {vb}"
        cells[1] = "                   "
        return cells

    if code == LadderInstructions.LADDER_INS_MULTI:
        cells[0] = "---+-ERR MULTI--+--"
        cells[1] = "---++++++++++++++--"
        return cells

    if code == LadderInstructions.LADDER_INS_FOREIGN:
        fid = cell.data[0].i32 if cell.data_qty > 0 else 0
        name = "FN?"
        if fid < lctx.foreign.qty:
            fn = lctx.foreign.fn[fid]
            name = fn.name if fn.name else "FN?"
            ioc = fn.description
        else:
            ioc = LADDER_FN_IOCD[LadderInstructions.LADDER_INS_FOREIGN] # Default

        cells[0] = f"---+-{name:<10}-+{pin_out(lctx, net_idx, r, c)}"
    else:
        ioc = LADDER_FN_IOCD.get(code)
        if not ioc: ioc = LADDER_FN_IOCD[LadderInstructions.LADDER_INS_NOP]

        sym = FN_SYMBOL[code] if code < len(FN_SYMBOL) else "???"

        if ioc.cells != 1:
            cells[0] = f"---+-{sym:<10}-+{pin_out(lctx, net_idx, r, c)}"
        else:
            cells[0] = f"--------{sym}------{pin_out(lctx, net_idx, r, c)}"

    if code == LadderInstructions.LADDER_INS_FOREIGN and (cell.data_qty == 0 or cell.data[0].i32 >= lctx.foreign.qty):
        pass # Error handling?

    if ioc.cells == 1:
        if cell.data_qty > 0:
            d0 = cell.data[0]
            if d0.type == LadderRegister.LADDER_REGISTER_S:
                val_str = str(d0.value)[:10]
                cells[1] = f"     {val_str:<10}   {space_bar(lctx, net_idx, r, c)}"
            elif d0.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q, LadderRegister.LADDER_REGISTER_R):
                if d0.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q):
                    val_str = f"{d0.mp.module}.{d0.mp.port}"
                else:
                    val_str = ftos(float(d0.value), 12, 2)

                type_str = DT_GRAPH[d0.type] if d0.type < len(DT_GRAPH) else "??"
                cells[1] = f"     {type_str} {val_str:<8}      {space_bar(lctx, net_idx, r, c)}"
            else:
                if code == LadderInstructions.LADDER_INS_CONN:
                    cells[1] = f"                  {space_bar(lctx, net_idx, r, c)}"
                else:
                    type_str = DT_GRAPH[d0.type] if d0.type < len(DT_GRAPH) else "??"
                    cells[1] = f"     {type_str} {int(d0.i32):04d}      {space_bar(lctx, net_idx, r, c)}"
        else:
            cells[1] = f"                  {space_bar(lctx, net_idx, r, c)}"

    elif ioc.cells == 2:
        if r <= net.rows - 1:
            if cell.data_qty > 0:
                d0 = cell.data[0]
                if d0.type == LadderRegister.LADDER_REGISTER_S:
                    val_str = str(d0.value)[:10]
                    cells[1] = f"   | {val_str:<10} |  "
                elif d0.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q, LadderRegister.LADDER_REGISTER_R):
                    if d0.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q):
                        val_str = f"{d0.mp.module}.{d0.mp.port}"
                    else:
                        val_str = ftos(float(d0.value), 12, 2)
                    type_str = DT_GRAPH[d0.type] if d0.type < len(DT_GRAPH) else "??"
                    cells[1] = f"   | {type_str} {val_str:<8}    |  "
                else:
                    if code == LadderInstructions.LADDER_INS_CONN:
                        cells[1] = "                   "
                    else:
                        type_str = DT_GRAPH[d0.type] if d0.type < len(DT_GRAPH) else "??"
                        cells[1] = f"   | {type_str} {int(d0.i32):04d}    |  "

            if cell.data_qty > 1:
                d1 = cell.data[1]
                if code in (LadderInstructions.LADDER_INS_TON, LadderInstructions.LADDER_INS_TOF, LadderInstructions.LADDER_INS_TP):
                    bt_str = BASETIME_GRAPH[d1.type] if d1.type < len(BASETIME_GRAPH) else "INV   "
                    inp_sym = "   " if ioc.inputs == 1 else "---"
                    out_sym = "  " if ioc.outputs == 1 else pin_out(lctx, net_idx, r, c)
                    cells[2] = f"{inp_sym}| {int(d1.i32):04d} {bt_str} |{out_sym}"
                else:
                    inp_sym = "   " if ioc.inputs == 1 else "---"
                    out_sym = "  " if ioc.outputs == 1 else pin_out(lctx, net_idx, r, c)

                    if d1.type == LadderRegister.LADDER_REGISTER_S:
                        val_str = str(d1.value)[:10]
                        cells[2] = f"{inp_sym}| {val_str:<10} |{out_sym}"
                    elif d1.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q, LadderRegister.LADDER_REGISTER_R):
                        if d1.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q):
                            val_str = f"{d1.mp.module}.{d1.mp.port}"
                        else:
                            val_str = ftos(float(d1.value), 12, 2)
                        type_str = DT_GRAPH[d1.type] if d1.type < len(DT_GRAPH) else "??"
                        cells[2] = f"{inp_sym}| {type_str} {val_str:<8}    |{out_sym}"
                    else:
                        type_str = DT_GRAPH[d1.type] if d1.type < len(DT_GRAPH) else "??"
                        cells[2] = f"{inp_sym}| {type_str} {int(d1.i32):04d}    |{out_sym}"
            else:
                cells[1] = "                   "
                cells[2] = "                   "

            cells[3] = f"   +------------+ {space_bar(lctx, net_idx, r, c)}"

    elif ioc.cells == 3:
        if r <= net.rows - 3:
            if cell.data_qty > 0:
                d0 = cell.data[0]
                # ... same pattern for d0 ...
                if d0.type == LadderRegister.LADDER_REGISTER_S:
                    val_str = str(d0.value)[:10]
                    cells[1] = f"   | {val_str:<10} |  "
                elif d0.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q, LadderRegister.LADDER_REGISTER_R):
                    # ...
                    if d0.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q):
                        val_str = f"{d0.mp.module}.{d0.mp.port}"
                    else:
                        val_str = ftos(float(d0.value), 12, 2)
                    type_str = DT_GRAPH[d0.type] if d0.type < len(DT_GRAPH) else "??"
                    cells[1] = f"   | {type_str} {val_str:<8}    |  "
                else:
                    type_str = DT_GRAPH[d0.type] if d0.type < len(DT_GRAPH) else "??"
                    cells[1] = f"   | {type_str} {int(d0.i32):04d}    |  "

            # d1
            if cell.data_qty > 1:
                d1 = cell.data[1]
                inp_sym = "   " if ioc.inputs < 2 else "---"
                out_sym = "  " if ioc.outputs < 2 else pin_out(lctx, net_idx, r, c)

                if d1.type == LadderRegister.LADDER_REGISTER_S:
                    val_str = str(d1.value)[:10]
                    cells[2] = f"{inp_sym}| {val_str:<10} |{out_sym}"
                elif d1.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q, LadderRegister.LADDER_REGISTER_R):
                    if d1.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q):
                        val_str = f"{d1.mp.module}.{d1.mp.port}"
                    else:
                        val_str = ftos(float(d1.value), 12, 2)
                    type_str = DT_GRAPH[d1.type] if d1.type < len(DT_GRAPH) else "??"
                    cells[2] = f"{inp_sym}| {type_str} {val_str:<8}    |{out_sym}"
                else:
                    type_str = DT_GRAPH[d1.type] if d1.type < len(DT_GRAPH) else "??"
                    cells[2] = f"{inp_sym}| {type_str} {int(d1.i32):04d}    |{out_sym}"

            # d2
            if cell.data_qty > 2:
                d2 = cell.data[2]
                if d2.type == LadderRegister.LADDER_REGISTER_S:
                    val_str = str(d2.value)[:10]
                    cells[3] = f"   | {val_str:<10} |  "
                elif d2.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q, LadderRegister.LADDER_REGISTER_R):
                    if d2.type in (LadderRegister.LADDER_REGISTER_I, LadderRegister.LADDER_REGISTER_Q):
                        val_str = f"{d2.mp.module}.{d2.mp.port}"
                    else:
                        val_str = ftos(float(d2.value), 12, 2)
                    type_str = DT_GRAPH[d2.type] if d2.type < len(DT_GRAPH) else "??"
                    cells[3] = f"   | {type_str} {val_str} |  "
                else:
                    type_str = DT_GRAPH[d2.type] if d2.type < len(DT_GRAPH) else "??"
                    cells[3] = f"   | {type_str} {int(d2.i32):04d}    |  "

            inp_sym = "   " if ioc.inputs < 3 else "---"
            out_sym = "  " if ioc.outputs < 3 else pin_out(lctx, net_idx, r, c)
            cells[4] = f"{inp_sym}|            |{out_sym}"
            cells[5] = f"   +------------+ {space_bar(lctx, net_idx, r, c)}"

    return cells

def ladder_print(lctx: LadderCtx):
    for n in range(lctx.ladder.quantity.networks):
        net = lctx.network[n]
        if net.rows > LADDER_MAX_ROWS or net.cols > LADDER_MAX_COLS:
            print(f"Error: Network {n} dimensions exceed limits.")
            continue

        print(f"[Network {n} ({'enabled' if net.enable else 'disabled'})]\n")

        # We need a 2D buffer of chars?
        # C code constructs a flat buffer.
        # Pythonic way: list of strings per row.
        # Each cell produces 6 lines of text.
        # We print cell by cell? No, we print line by line for the whole network.
        # So we iterate rows of the network, and for each row, we have 6 sub-rows of text.

        for r in range(net.rows):
            # We need to buffer the text for this row
            row_lines = ["" for _ in range(6)]

            for c in range(net.cols):
                # Only if not covered by previous multi-cell?
                # C code uses a big buffer and checks if null.
                # Here we can check if it's MULTI.
                if net.cells[r][c].code == LadderInstructions.LADDER_INS_MULTI:
                    # It's part of above cell. We just print empty/continuation?
                    # The `fn_to_str` logic handles the drawing of the main block.
                    # If it's MULTI, `fn_to_str` returns "ERR MULTI" if called directly?
                    # But in correct usage, `fn_to_str` is called on the head cell, and it returns multiple lines (2 or 3 cells high).
                    # So we need to handle vertical overlap.
                    pass
                else:
                    # Draw cell
                    pass

            # Actually, `ladder_print.c` allocates `network_str_raw`.
            # And populates it.
            # `NET_STR` macro accesses it.
            # If a cell is multi-cell (e.g. 2 cells high), `fn_to_str` fills 2 logical rows (12 text lines?).
            # Wait, `fn_to_str` returns 6 lines?
            # Looking at `fn_to_str` in C:
            # Case 2: writes to `(*cells)[0]`, `[1]`, `[2]`, `[3]`.
            # Wait, `cells` is `char (*cells)[6][32]`. It writes to index 0..5.
            # So one `fn_to_str` call produces 6 lines.
            # But a 2-cell instruction takes 2 *rows* in the network grid?
            # Yes. 2 rows * 6 lines/row = 12 lines?
            # No. `ladder_print.c` iterates `r` and `c`.
            # If `NET_STR` is empty, calls `fn_to_str`.
            # Then it copies `fn_str[0]`..`[5]` to `NET_STR` locations.
            # `NET_STR(r, c, 0, 0)` -> line 0 of cell r,c.
            # `NET_STR(r+1, c, 0, 0)` -> line 0 of cell r+1,c.
            # Ah, `fn_to_str` fills neighbor cells in the string buffer!
            # e.g. `strncpy(&NET_STR(r + 1, c, 0, 0), fn_str[2], 32);`
            # So `fn_str` contains slices for multiple cells?
            # No, `fn_str` has 6 lines.
            # For 2-cell instr:
            # `fn_str[0]` -> line 0 of cell (r,c) (Top part)
            # `fn_str[1]` -> line 1 of cell (r,c) (Top part)
            # `fn_str[2]` -> line 0 of cell (r+1,c) (Bottom part)
            # `fn_str[3]` -> line 1 of cell (r+1,c) (Bottom part)
            # `fn_str[4]` -> line 0 of cell (r+2,c) ... wait?
            # The C loop does:
            # `strncpy(&NET_STR(r, c, 0, 0), fn_str[0], 32);`
            # `strncpy(&NET_STR(r, c, 1, 0), fn_str[1], 32);`
            # `strncpy(&NET_STR(r + 1, c, 0, 0), fn_str[2], 32);`
            # `strncpy(&NET_STR(r + 1, c, 1, 0), fn_str[3], 32);`
            # `strncpy(&NET_STR(r + 2, c, 0, 0), fn_str[4], 32);`
            # `strncpy(&NET_STR(r + 2, c, 1, 0), fn_str[5], 32);`
            # So `fn_to_str` returns the visual representation for the *whole block* (up to 3 rows high),
            # split into 2-line chunks corresponding to network rows.

            # Implementation strategy:
            # Create a grid of text lines: `grid[rows][cols][2]`.
            # Iterate r, c.
            # If `grid[r][c]` is empty:
            #   call `fn_to_str`.
            #   distribute result to `grid[r][c]`, `grid[r+1][c]`, etc.

            pass

        # Buffer
        grid = [[["" for _ in range(2)] for _ in range(net.cols)] for _ in range(net.rows)]

        for r in range(net.rows):
            for c in range(net.cols):
                if grid[r][c][0] == "": # Empty
                    strs = fn_to_str(lctx, n, r, c)
                    # Fill current
                    grid[r][c][0] = strs[0]
                    grid[r][c][1] = strs[1]

                    # Fill next if applicable
                    # Note: `fn_to_str` returns fixed 6 lines even for 1-cell instr?
                    # Yes, but for 1-cell, lines 2-5 are probably not relevant/used?
                    # In C: `case 1:` sets [0] and [1]. [2]..[5] are not set (memset 0).
                    # But the loop copies [2]..[5] anyway?
                    # `memset(cells, 0, ...)`
                    # If empty, it overwrites with empty.
                    # Check C loop: `strncpy` ...
                    # If `fn_str[2]` is empty/null, `strncpy` copies empty.
                    # But we shouldn't overwrite existing if it's not part of us?
                    # The C code checks `if (NET_STR(...) == '\0')` before calling `fn_to_str`.
                    # But inside the loop, it overwrites `r+1` without checking?
                    # `strncpy` overwrites.
                    # So `fn_to_str` for a 1-cell instr must return empty for lines 2-5.

                    if r + 1 < net.rows:
                        grid[r+1][c][0] = strs[2]
                        grid[r+1][c][1] = strs[3]
                    if r + 2 < net.rows:
                        grid[r+2][c][0] = strs[4]
                        grid[r+2][c][1] = strs[5]

        # Print
        for r in range(net.rows):
            line0 = "    |"
            line1 = "    |"
            for c in range(net.cols):
                s0 = grid[r][c][0]
                s1 = grid[r][c][1]
                if not s0: s0 = "                   " # 19 spaces
                if not s1: s1 = "                   "

                # C code uses 32 chars buffer but prints with `%s`.
                # `fn_to_str` uses snprintf.
                # Pad to 19 chars?
                # `fn_to_str` output seems to be fixed width.
                # "--------%s------%s" -> 8 + 3 + 6 + 2 = 19.
                # "                  %s" -> 18 + 1 = 19.
                # "     %s %s      %s" -> 5 + 2 + 1 + ?

                line0 += s0.ljust(19)[:19] # Ensure length
                line1 += s1.ljust(19)[:19]

            line0 += "|"
            line1 += "|"
            print(line0)
            print(line1)

        print("\n")
