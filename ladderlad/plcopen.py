import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import datetime
from typing import List, Any, Dict, Optional

class LogicTree:
    def __init__(self, ids: List[str], heads: List[str], tails: List[str], width: int, height: int):
        self.ids = ids
        self.heads = heads
        self.tails = tails
        self.width = width
        self.height = height

class PLCopenRenderer:
    def __init__(self):
        self.root = ET.Element("project", xmlns="http://www.plcopen.org/xml/tc6_0201")
        self.connection_id = 1
        self.current_y = 100
        self.left_rail_id = "0"
        self.stack: List[LogicTree] = []
        self.ld = None # LD body element

        # Mapping opcodes to PLCopen types/logic
        # 'contact': standard contact
        # 'coil': standard coil
        # 'block': function block (TON, CTU, etc)
        self.OPCODE_MAP = {
            'in': {'type': 'contact', 'negated': False},
            'not': {'type': 'modifier', 'action': 'negate_prev'},
            'out': {'type': 'coil', 'negated': False},
            # Basic logic is handled structurally (AND/OR), not as elements usually,
            # but if we had explicit blocks they would be here.
            # Extended blocks:
            'TON': {'type': 'block', 'name': 'TON'},
            'TOF': {'type': 'block', 'name': 'TOF'},
            'TP': {'type': 'block', 'name': 'TP'},
            'CTU': {'type': 'block', 'name': 'CTU'},
            'CTD': {'type': 'block', 'name': 'CTD'},
            'ADD': {'type': 'block', 'name': 'ADD'},
            # ... add more as needed
        }

    def _add_headers(self):
        now = datetime.now().isoformat()
        ET.SubElement(self.root, "fileHeader",
                      companyName="LadderLad Lib",
                      productName="LadderLad",
                      productVersion="1.0",
                      creationDateTime=now)

        ch = ET.SubElement(self.root, "contentHeader", name="LadderLogic", modificationDateTime=now)
        coord = ET.SubElement(ch, "coordinateInfo")
        for tag in ["fbd", "ld", "sfc"]:
            ET.SubElement(ET.SubElement(coord, tag), "scaling", x="1", y="1")

        addData = ET.SubElement(ch, "addData")
        data = ET.SubElement(addData, "data", name="http://www.3s-software.com/plcopenxml/projectinformation", handleUnknown="implementation")
        ET.SubElement(data, "ProjectInformation")

    def _create_interface(self, pou: ET.Element, instructions: List[List[Any]]):
        inputs = set()
        outputs = set()

        for instr in instructions:
            op = instr[0]
            if len(instr) > 1 and isinstance(instr[1], str):
                name = instr[1]
                if op == 'in': inputs.add(name)
                elif op == 'out': outputs.add(name)
                # Handle blocks args? e.g. ['call', 'TON', 'Timer1', '5s']
                # We should extract 'Timer1' as variable.
                elif op == 'call':
                    # Heuristic: args are variables?
                    for arg in instr[2:]:
                        # If simple alphanumeric, assume var?
                        # Or if it looks like a literal (number), ignore.
                        if isinstance(arg, str) and arg.isidentifier():
                             # Block vars usually local/inout
                             inputs.add(arg)

        in_out = inputs.intersection(outputs)
        pure_inputs = inputs - in_out
        pure_outputs = outputs - in_out

        iface = ET.SubElement(pou, "interface")

        # Simple categorization
        for group_name, var_set in [("inputVars", pure_inputs), ("outputVars", pure_outputs), ("inOutVars", in_out)]:
            if var_set:
                group_el = ET.SubElement(iface, group_name)
                for var_name in sorted(list(var_set)):
                    v = ET.SubElement(group_el, "variable", name=var_name)
                    t = ET.SubElement(v, "type")
                    ET.SubElement(t, "BOOL") # Default to BOOL

    def _create_element(self, tag: str, var: str, negated: bool = False, type_name: str = None) -> LogicTree:
        cid = str(self.connection_id)
        self.connection_id += 1
        attrs = {"localId": cid}

        el = None
        width = 150
        height = 0

        if tag == "contact":
            attrs["negated"] = "true" if negated else "false"
            el = ET.SubElement(self.ld, "contact", **attrs)
            ET.SubElement(el, "variable").text = var

        elif tag == "coil":
            attrs["negated"] = "true" if negated else "false"
            el = ET.SubElement(self.ld, "coil", **attrs)
            ET.SubElement(el, "variable").text = var

        elif tag == "block":
            attrs["typeName"] = type_name
            el = ET.SubElement(self.ld, "box", **attrs)
            # Add Inputs/Outputs for the box?
            # Basic standard blocks (TON) have IN, PT / Q, ET.
            # We need to define connection points.
            # For simplicity in this demo renderer, we assume generic box
            # and just attach the logic flow to first input/output.

            # This requires more complex knowledge of the block structure.
            # For now, placeholder.
            ET.SubElement(el, "inputVariables")
            ET.SubElement(el, "outputVariables")
            width = 200
            height = 100

        return LogicTree([cid], [cid], [cid], width, height)

    def _set_pos(self, cid: str, x: int, y: int):
        el = self.ld.find(f".//*[@localId='{cid}']")
        if el is not None:
            pos = el.find("position") or ET.SubElement(el, "position")
            pos.set("x", str(x))
            pos.set("y", str(y))

    def _add_conn(self, cid: str, refs: List[str]):
        el = self.ld.find(f".//*[@localId='{cid}']")
        if el is not None:
            # For boxes, we need to find specific input pin?
            # Assuming 'contact'/'coil' structure for now which puts connectionPointIn at root.
            cp = el.find("connectionPointIn") or ET.SubElement(el, "connectionPointIn")
            for r in refs:
                ET.SubElement(cp, "connection", refLocalId=str(r))

    def render(self, instructions: List[List[Any]]) -> str:
        self._add_headers()

        types = ET.SubElement(self.root, "types")
        ET.SubElement(types, "dataTypes")
        pous = ET.SubElement(types, "pous")

        pou = ET.SubElement(pous, "pou", name="Main", pouType="program")
        self._create_interface(pou, instructions)

        body = ET.SubElement(pou, "body")
        self.ld = ET.SubElement(body, "LD")

        rail = ET.SubElement(self.ld, "leftPowerRail", localId="0")
        ET.SubElement(rail, "position", x="40", y="0")

        i = 0
        while i < len(instructions):
            instr = instructions[i]
            cmd = instr[0]

            # Extensible Opcode Handling
            if cmd in self.OPCODE_MAP:
                info = self.OPCODE_MAP[cmd]

                if info['type'] == 'contact':
                    # Check next for NOT? Or parser handles it?
                    # Parser gives ['in', 'NAME']. Then ['not'].
                    # Original logic handled lookahead.
                    neg = info['negated']
                    if i + 1 < len(instructions) and instructions[i+1][0] == 'not':
                        neg = not neg
                        i += 1
                    self.stack.append(self._create_element("contact", instr[1], neg))

                elif info['type'] == 'coil':
                    # Output logic
                    # Connect to stack
                    cid = str(self.connection_id)
                    self.connection_id += 1
                    coil = ET.SubElement(self.ld, "coil", localId=cid)
                    ET.SubElement(coil, "variable").text = instr[1]

                    if self.stack:
                        tree = self.stack.pop()
                        # Connect heads to rail
                        for h in tree.heads: self._add_conn(h, [self.left_rail_id])
                        # Connect coil to tails
                        self._add_conn(cid, tree.tails)
                        self._set_pos(cid, 850, self.current_y)

                        # Layout
                        cursor_x = 100
                        for idx, lid in enumerate(tree.ids):
                            # Very naive layout from original snippet
                            # Logic: If ID is part of a tail but not the first tail...
                            # This needs a real graph layout alg for generic blocks.
                            # Reusing original logic for now:
                            y_offset = 0
                            if idx == 3: # Magic index from original example?
                                y_offset = 60
                                cx = 400
                            else:
                                cx = 100 + (idx * 150)
                                if idx > 3: cx -= 150
                            self._set_pos(lid, cx, self.current_y + y_offset)

                    self.current_y += 200
                    self.stack = []

                elif info['type'] == 'block':
                    # Function Block Call
                    # ['call', 'TON', 'T1', '5s']
                    pass

            # Structural Opcodes (AND/OR are not in MAP because they are structural)
            elif cmd == "and":
                if len(self.stack) >= 2:
                    right = self.stack.pop()
                    left = self.stack.pop()
                    for h in right.heads: self._add_conn(h, left.tails)
                    self.stack.append(LogicTree(left.ids + right.ids, left.heads, right.tails, left.width + right.width, max(left.height, right.height)))

            elif cmd == "or":
                if len(self.stack) >= 2:
                    bot = self.stack.pop()
                    top = self.stack.pop()
                    self.stack.append(LogicTree(top.ids + bot.ids, top.heads + bot.heads, top.tails + bot.tails, max(top.width, bot.width), top.height + bot.height + 60))

            # Handle generic CALL
            elif cmd == "call":
                # ['call', 'TON', 'args'...]
                # Create a BOX element
                type_name = instr[1]
                # We need to integrate this box into the logic flow.
                # A box has Enable In (EN) and Enable Out (ENO).
                # Logic flows through EN/ENO.
                # Other inputs (PT, etc) are data connections.

                # Simplified: Create box, connect EN to prev logic, ENO to next logic.
                pass

            i += 1

        xml_str = ET.tostring(self.root, encoding='utf-8')
        return minidom.parseString(xml_str).toprettyxml(indent="  ")
