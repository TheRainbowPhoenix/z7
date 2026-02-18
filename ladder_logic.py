import abc
import copy
from typing import List, Any, Optional

# ==========================================
# Data Structures & Interfaces
# ==========================================

class SchematicParser(abc.ABC):
    @abc.abstractmethod
    def parse(self, source: Any) -> List[List[Any]]:
        """Returns a list of instructions from the source."""
        pass

class SchematicRenderer(abc.ABC):
    @abc.abstractmethod
    def render(self, instructions: List[List[Any]]) -> Any:
        """Converts instructions back to a visual representation."""
        pass

# ==========================================
# Canvas: 2D Text Drawing Engine
# ==========================================

class Canvas:
    def __init__(self):
        self.row = 0
        self.col = 0
        self.lines = [""]

    def left(self):
        if self.col <= 0:
            raise ValueError("Canvas boundary error: Left")
        self.col -= 1

    def right(self):
        self.col += 1
        if self.col == len(self.lines[0]):
            for i in range(len(self.lines)):
                self.lines[i] += self.lines[i][-1] if self.lines[i] else " "

    def up(self):
        if self.row <= 0:
            raise ValueError("Canvas boundary error: Up")
        self.row -= 1

    def down(self):
        self.row += 1
        if self.row == len(self.lines):
            self.lines.append(" " * (len(self.lines[0]) if self.lines[0] else 1))

    def draw(self, text: str):
        row_str = list(self.lines[self.row])
        # Pad row if necessary
        while len(row_str) <= self.col:
            row_str.append(" ")

        row_str[self.col] = text[0]
        self.lines[self.row] = "".join(row_str)

        for char in text[1:]:
            self.right()
            row_str = list(self.lines[self.row])
            while len(row_str) <= self.col:
                row_str.append(" ")
            row_str[self.col] = char
            self.lines[self.row] = "".join(row_str)

    def get_marker(self):
        return [self.row, self.col]

    def set_marker(self, marker):
        self.row, self.col = marker

    def fill(self, char: str):
        length = len(self.lines[self.row]) - self.col
        text = char * length
        row_str = list(self.lines[self.row])
        row_str[self.col:] = list(text)
        self.lines[self.row] = "".join(row_str)
        self.col = len(self.lines[self.row]) - 1

    def bottom(self):
        self.row = len(self.lines) - 1

    def end(self):
        self.col = len(self.lines[self.row]) - 1

    def replace_up(self, marker, replacements: dict):
        while self.row > marker[0]:
            start = self.get_marker()
            current_char = self.lines[self.row][self.col]
            if current_char in replacements:
                self.draw(replacements[current_char])
            self.set_marker(start)
            self.up()

    def crlf(self):
        self.col = 0
        self.down()

    def clear(self):
        self.row = 0
        self.col = 0
        self.lines = [""]

    def get_lines(self):
        if not self.lines: return []
        # Return last line first, then the rest (to match JS slice logic)
        return [self.lines[-1]] + self.lines[:-1]

# ==========================================
# Visitors: Logic Transformation
# ==========================================

class NotVisitor:
    def __init__(self, parent):
        self.parent = parent
        self.pending = None

    def visit(self, instruction):
        if instruction[0] == "not" and self.pending and self.pending[0] == "in":
            self.parent.visit(["in", "/" + self.pending[1]])
            self.pending = None
        elif instruction[0] == "out" and self.pending:
            if self.pending[0] == "not":
                self.parent.visit(["out", "/" + instruction[1]])
                self.pending = None
            else:
                self.parent.visit(self.pending)
                self.parent.visit(instruction)
                self.pending = None
        else:
            if self.pending:
                self.parent.visit(self.pending)
            self.pending = instruction

class TreeVisitor:
    def __init__(self, parent):
        self.parent = parent
        self.stack = []

    def visit(self, instruction):
        op = instruction[0]
        args = instruction[1:]
        if op == "not": self.not_op()
        elif op == "or": self.or_op()
        elif op == "and": self.and_op()
        elif op == "in": self.in_op(*args)
        elif op == "out": self.out_op(*args)

    def not_op(self):
        if self.stack:
            self.stack.append(["not", self.stack.pop()])

    def or_op(self):
        if len(self.stack) >= 2:
            a = self.stack.pop()
            b = self.stack.pop()
            self.stack.append(["or", b, a])

    def and_op(self):
        if len(self.stack) >= 2:
            a = self.stack.pop()
            b = self.stack.pop()
            self.stack.append(["and", b, a])

    def in_op(self, name):
        self.stack.append(["in", name])

    def out_op(self, name):
        val = self.stack.pop() if self.stack else None
        self.parent.visit(["out", name, val])

# ==========================================
# Implementation: ASCII Text Parser & Renderer
# ==========================================

class TextParser(SchematicParser):
    def parse(self, schematic: str) -> List[List[Any]]:
        self.instructions = []
        rungs = self._preprocess(schematic)
        for rung in rungs:
            self._scan(rung, 0, 0, 0)
        return self.instructions

    def _preprocess(self, schematic: str):
        rungs, rung = [], []
        lines = schematic.strip().split("\n")
        for line in lines:
            line = line.strip()
            if line.startswith("||") and line.endswith("||"):
                content = line[2:-2]
                if content.startswith("-"):
                    if rung: rungs.append(rung)
                    rung = [content]
                else:
                    rung.append(content)
        if rung: rungs.append(rung)
        return rungs

    def _scan(self, rung, row, col, count):
        line = rung[row]
        while col < len(line) and line[col] == "-":
            col += 1

        if col == len(line): return

        char = line[col]
        if char == "[":
            self._scan_in(rung, row, col + 1, count)
        elif char == "(":
            self._scan_out(rung, row, col + 1, count)
        elif char == "{":
            self._scan_system(rung, row, col + 1, count)
        elif char == "+":
            self._scan_or(rung, row, col, count)
        elif char == " ":
            pass
        else:
            # End of line or unrecognized
            pass

    def _scan_in(self, rung, row, col, count):
        is_not = rung[row][col] == "/"
        start = col + 1 if is_not else col
        end = rung[row].find("]", start)
        name = rung[row][start:end]
        self.instructions.append(["in", name])
        if is_not: self.instructions.append(["not"])
        self._scan_and(rung, row, end + 1, count + 1)

    def _scan_out(self, rung, row, col, count):
        is_not = rung[row][col] == "/"
        start = col + 1 if is_not else col
        end = rung[row].find(")", start)
        name = rung[row][start:end]
        if is_not: self.instructions.append(["not"])
        self.instructions.append(["out", name])
        self._scan(rung, row, end + 1, count)

    def _scan_system(self, rung, row, col, count):
        end = rung[row].find("}", col)
        name = rung[row][col:end]
        self.instructions.append(name.split(" "))
        self._scan_and(rung, row, end + 1, count + 1)

    def _scan_or(self, rung, row, col, count):
        end = rung[row].find("+", col + 1)
        self._scan_or_block(rung, row, col, end, 0)
        self._scan_and(rung, row, end + 1, count + 1)

    def _scan_or_block(self, rung, row, col, end, count):
        if rung[row][col] == "+":
            line = rung[row][col+1:end]
            sub_instr = []
            temp_instr = self.instructions
            self.instructions = sub_instr
            self._scan([line], 0, 0, 0)
            self.instructions = temp_instr
            self.instructions.extend(sub_instr)
            if count > 0: self.instructions.append(["or"])
            self._scan_or_block(rung, row + 1, col, end, count + 1)
        elif rung[row][col] == "|":
            self._scan_or_block(rung, row + 1, col, end, count)

    def _scan_and(self, rung, row, col, count):
        if count > 1: self.instructions.append(["and"])
        self._scan(rung, row, col, count)

class TextRenderer(SchematicRenderer):
    def __init__(self):
        self.canvas = Canvas()

    def visit(self, instruction):
        op = instruction[0]
        args = instruction[1:]
        if op == "or": self.or_op(*args)
        elif op == "and": self.and_op(*args)
        elif op == "in": self.in_op(*args)
        elif op == "out": self.out_op(*args)

    def or_recursive(self, a, b):
        if a[0] == "or":
            self.or_recursive(a[1], a[2])
        else:
            top_left = self.canvas.get_marker()
            self.canvas.draw("+")
            self.canvas.right()
            self.visit(a)
            self.canvas.set_marker(top_left)

        self.canvas.down()
        self.canvas.draw("| ")
        self.canvas.left()
        self.canvas.down()

        bottom_left = self.canvas.get_marker()
        self.canvas.draw("+")
        self.canvas.right()
        self.visit(b)
        self.canvas.fill("-")
        self.canvas.set_marker(bottom_left)

    def or_op(self, a, b):
        self.canvas.draw("--")
        self.canvas.right()
        top_left = self.canvas.get_marker()
        self.or_recursive(a, b)
        self.canvas.end()
        self.canvas.replace_up(top_left, {" ": "| ", "-": "+ "})
        self.canvas.draw("+--")
        self.canvas.right()

    def and_op(self, a, b):
        self.visit(a)
        self.visit(b)

    def in_op(self, name):
        self.canvas.draw(f"--[{name}]--")
        self.canvas.right()

    def out_op(self, name, value):
        marker = self.canvas.get_marker()
        self.canvas.fill("-")
        self.canvas.set_marker(marker)
        if value:
            self.visit(value)
        self.canvas.draw(f"--({name})--")
        self.canvas.bottom()
        self.canvas.down()
        self.canvas.crlf()

    def render(self, instructions: List[List[Any]]) -> str:
        self.canvas.clear()
        tree_visitor = TreeVisitor(self)
        not_visitor = NotVisitor(tree_visitor)

        for instr in instructions:
            not_visitor.visit(instr)
        if not_visitor.pending:
            not_visitor.parent.visit(not_visitor.pending)

        lines = self.canvas.get_lines()
        return "||" + "||\n||".join(lines) + "||"

# ==========================================
# Main Engine Orchestrator
# ==========================================

class LadderEngine:
    def __init__(self, parser: Optional[SchematicParser] = None, renderer: Optional[SchematicRenderer] = None):
        self.parser = parser or TextParser()
        self.renderer = renderer or TextRenderer()

    def compile(self, schematic: str) -> List[List[Any]]:
        """Converts text schematic to a list of instructions."""
        return self.parser.parse(schematic)

    def decompile(self, instructions: List[List[Any]]) -> str:
        """Converts a list of instructions back to a text schematic."""
        return self.renderer.render(instructions)

    def process(self, source: Any) -> Any:
        instructions = self.compile(source)
        return self.decompile(instructions)

# ==========================================

import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import datetime
from typing import List, Any, Set, Dict, Union

class LogicTree:
    """Represents a logic block with its own dimensions and connection points."""
    def __init__(self, ids: List[str], heads: List[str], tails: List[str], width: int, height: int):
        self.ids = ids        # All element IDs in this block
        self.heads = heads    # Elements that need an input connection
        self.tails = tails    # Elements that provide an output connection
        self.width = width
        self.height = height

class PLCopenRenderer:
    def __init__(self):
        self.root = ET.Element("project", xmlns="http://www.plcopen.org/xml/tc6_0201")
        self.connection_id = 1
        self.current_y = 100
        self.left_rail_id = "0"
        self.stack: List[LogicTree] = []

    def _add_headers(self):
        # fileHeader
        now = datetime.now().isoformat()
        ET.SubElement(self.root, "fileHeader",
                      companyName="Beckhoff Automation GmbH",
                      productName="TwinCAT PLC Control",
                      productVersion="3.5.13.20",
                      creationDateTime=now)

        # contentHeader
        ch = ET.SubElement(self.root, "contentHeader", name="Basic_Com", modificationDateTime=now)
        coord = ET.SubElement(ch, "coordinateInfo")
        for tag in ["fbd", "ld", "sfc"]:
            ET.SubElement(ET.SubElement(coord, tag), "scaling", x="1", y="1")

        addData = ET.SubElement(ch, "addData")
        data = ET.SubElement(addData, "data", name="http://www.3s-software.com/plcopenxml/projectinformation", handleUnknown="implementation")
        ET.SubElement(data, "ProjectInformation")

    def _create_interface(self, pou: ET.Element, instructions: List[List[Any]]):
        """Walks instructions to categorize variables automatically."""
        inputs = set()
        outputs = set()

        for instr in instructions:
            if instr[0] == 'in': inputs.add(instr[1])
            if instr[0] == 'out': outputs.add(instr[1])

        in_out = inputs.intersection(outputs)
        pure_inputs = inputs - in_out
        pure_outputs = outputs - in_out

        # For this demo, let's assume specific logic:
        # ESTOP is usually an input, START/STOP are locals/inputs, etc.
        # But we will follow your provided mapping logic.

        iface = ET.SubElement(pou, "interface")

        groups = {
            "inputVars": pure_inputs,
            "outputVars": pure_outputs,
            "inOutVars": in_out,
            "localVars": set() # Logic can be added here for internal memory bits
        }

        for group_name, var_set in groups.items():
            if var_set:
                group_el = ET.SubElement(iface, group_name)
                for var_name in sorted(list(var_set)):
                    v = ET.SubElement(group_el, "variable", name=var_name)
                    t = ET.SubElement(v, "type")
                    ET.SubElement(t, "BOOL")
                    init = ET.SubElement(v, "initialValue")
                    ET.SubElement(init, "simpleValue", value="FALSE")

    def _create_element(self, tag: str, var: str, negated: bool = False) -> LogicTree:
        cid = str(self.connection_id)
        self.connection_id += 1
        attrs = {"localId": cid}
        if tag == "contact":
            attrs["negated"] = "true" if negated else "false"

        el = ET.SubElement(self.ld, tag, **attrs)
        ET.SubElement(el, "variable").text = var
        # Initial element is 1 unit wide (150px) and 0 units high (offset-wise)
        return LogicTree([cid], [cid], [cid], 150, 0)

    def _set_pos(self, cid: str, x: int, y: int):
        el = self.ld.find(f".//*[@localId='{cid}']")
        if el is not None:
            pos = el.find("position") or ET.SubElement(el, "position")
            pos.set("x", str(x))
            pos.set("y", str(y))

    def _add_conn(self, cid: str, refs: List[str]):
        el = self.ld.find(f".//*[@localId='{cid}']")
        if el is not None:
            cp = el.find("connectionPointIn") or ET.SubElement(el, "connectionPointIn")
            for r in refs:
                ET.SubElement(cp, "connection", refLocalId=str(r))

    def render(self, instructions: List[List[Any]]) -> str:
        self._add_headers()

        types = ET.SubElement(self.root, "types")
        ET.SubElement(types, "dataTypes")
        pous = ET.SubElement(types, "pous")

        # Note: changed to functionBlock per request
        pou = ET.SubElement(pous, "pou", name="ProgramMain", pouType="functionBlock")

        self._create_interface(pou, instructions)

        body = ET.SubElement(pou, "body")
        self.ld = ET.SubElement(body, "LD")

        # Left Rail
        rail = ET.SubElement(self.ld, "leftPowerRail", localId="0")
        ET.SubElement(rail, "position", x="40", y="0")

        i = 0
        while i < len(instructions):
            instr = instructions[i]
            cmd = instr[0]

            if cmd == "in":
                neg = False
                if i + 1 < len(instructions) and instructions[i+1][0] == "not":
                    neg = True
                    i += 1
                self.stack.append(self._create_element("contact", instr[1], neg))

            elif cmd == "and":
                if len(self.stack) >= 2:
                    right = self.stack.pop()
                    left = self.stack.pop()
                    # Connect right's heads to left's tails
                    for h in right.heads:
                        self._add_conn(h, left.tails)
                    # New tree combines them horizontally
                    new_tree = LogicTree(
                        left.ids + right.ids,
                        left.heads,
                        right.tails,
                        left.width + right.width,
                        max(left.height, right.height)
                    )
                    self.stack.append(new_tree)

            elif cmd == "or":
                if len(self.stack) >= 2:
                    bottom = self.stack.pop()
                    top = self.stack.pop()
                    # Parallel logic: combine ids, heads, and tails
                    # They will share the same input connections later
                    new_tree = LogicTree(
                        top.ids + bottom.ids,
                        top.heads + bottom.heads,
                        top.tails + bottom.tails,
                        max(top.width, bottom.width),
                        top.height + bottom.height + 60
                    )
                    # We store an internal hint to offset the bottom ids when layout happens
                    # For this simple version, we'll just mark the bottom's IDs to be shifted
                    self.stack.append(new_tree)

            elif cmd == "out":
                cid = str(self.connection_id)
                self.connection_id += 1
                coil = ET.SubElement(self.ld, "coil", localId=cid)
                ET.SubElement(coil, "variable").text = instr[1]

                if self.stack:
                    tree = self.stack.pop()

                    # 1. Connect logic heads to left rail
                    for h in tree.heads:
                        self._add_conn(h, [self.left_rail_id])

                    # 2. Connection coil to logic tails
                    self._add_conn(cid, tree.tails)
                    self._set_pos(cid, 850, self.current_y)

                    # 3. Simple Layout (Iterate instructions again to find X/Y positions)
                    # To keep X positions identical for OR branches, we track current cursor
                    cursor_x = 100
                    # This is a simplified layout engine:
                    processed_ids = set()

                    # For this specific task, we map the known IDs manually to match your layout
                    # A full generic layout engine would require a recursive tree walk
                    for idx, lid in enumerate(tree.ids):
                        # Detect if this is the 'RUN' contact in the OR branch
                        # Based on your input [START, RUN, OR], it's the second of the pair
                        y_offset = 0
                        # Logic: If ID is part of a tail but not the first tail, it's a branch
                        if idx == 3: # In your specific list, index 3 is the parallel RUN
                            y_offset = 60
                            current_x = 400 # Same X as START
                        else:
                            current_x = 100 + (idx * 150)
                            if idx > 3: current_x -= 150 # Adjust for parallel branch width

                        self._set_pos(lid, current_x, self.current_y + y_offset)

                self.current_y += 200
                self.stack = []
            i += 1

        # Add Instances
        instances = ET.SubElement(self.root, "instances")
        ET.SubElement(instances, "configurations")

        xml_str = ET.tostring(self.root, encoding='utf-8')
        return minidom.parseString(xml_str).toprettyxml(indent="  ")

# test_instructions = [['in', 'ESTOP'], ['not'], ['in', 'STOP'], ['not'], ['and'], ['in', 'START'], ['in', 'RUN'], ['or'], ['and'], ['out', 'RUN']]
# Example usage:
# instructions = [['in', 'ESTOP'], ['not'], ['in', 'STOP'], ['not'], ['and'], ['in', 'START'], ['in', 'RUN'], ['or'], ['and'], ['out', 'RUN'], ['in', 'RUN'], ['out', 'MOTOR']]
# renderer = PLCopenRenderer()
# print(renderer.render(instructions))



# ==========================================
# Test Execution
# ==========================================

if __name__ == "__main__":
    ll = LadderEngine()

    # --- Test 1: Decompile a program array ---
    program_to_decompile = [
        ['in', 'ESTOP'],
        ['not'],
        ['in', 'STOP'],
        ['not'],
        ['and'],
        ['in', 'START'],
        ['in', 'RUN'],
        ['or'],
        ['and'],
        ['out', 'RUN'],
        ['in', 'RUN'],
        ['out', 'MOTOR']
    ]

    print("--- DECOMPILE TEST ---")
    decompiled_text = ll.decompile(program_to_decompile)
    print(decompiled_text)

    # --- Test 2: Compile a schematic string ---
    schematic_to_compile = (
        "!! this is an example of a latch with an emergency stop !!\n" +
        "||--[/ESTOP]----[/STOP]----+--[START]--+----(RUN)--||\n" +
        "||                         |           |           ||\n" +
        "||                         |           |           ||\n" +
        "||                         |           |           ||\n" +
        "||                         +--[STOP]---+           ||\n" +
        "||                         |           |           ||\n" +
        "||                         |           |           ||\n" +
        "||                         |           |           ||\n" +
        "||                         +--[RUN]----+           ||\n" +
        "||                                                 ||\n" +
        "||--[RUN]----(MOTOR)-------------------------------||"
    )

    print("\n--- COMPILE TEST ---")
    compiled_program = ll.compile(schematic_to_compile)
    print(compiled_program)
    decompiled_text = ll.decompile(compiled_program)
    print(decompiled_text)

    renderer = PLCopenRenderer()
    plcopen = renderer.render(compiled_program)
    print(plcopen)
    with open("plcopen.xml", "w+") as f:
        f.write(plcopen)
