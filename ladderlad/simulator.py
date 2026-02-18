from typing import List, Dict, Any, Union

class Simulator:
    def __init__(self):
        self.variables: Dict[str, bool] = {}
        self.accumulators: List[bool] = []

    def set_variable(self, name: str, value: bool):
        self.variables[name] = value

    def get_variable(self, name: str) -> bool:
        return self.variables.get(name, False)

    def reset(self):
        self.variables = {}
        self.accumulators = []

    def run(self, instructions: List[List[Any]]):
        # Flatten instructions if needed or process as stream
        # Instructions are list of lists: e.g. ['in', 'ESTOP'], ['not'], ['or'], etc.
        # We need to process them sequentially.

        # Based on ladder_logic.py visitors, the logic is tree-like for rendering but linear for execution?
        # The parser outputs linear instruction list (mostly RPN-ish).
        # Let's look at `TextParser` output.
        # It scans and appends.
        # Structure:
        # AND Logic: operand1, operand2, ['and']
        # OR Logic: operand1, operand2, ['or']
        # NOT: operand, ['not']
        # IN: ['in', name]
        # OUT: operand, ['out', name]

        # This structure is essentially RPN (Reverse Polish Notation).
        # We can use a stack (accumulator stack).

        stack: List[bool] = []

        for instr in instructions:
            op = instr[0]

            if op == "in":
                name = instr[1]
                val = self.get_variable(name)
                # Handle negation if embedded? No, "not" is separate instruction in parser output.
                # However, parser `_scan_in` appends `['in', name]` then optionally `['not']`.
                # Wait, `_scan_in` handles `/` prefix in name string for internal use?
                # No, `_scan_in` in parser: `self.instructions.append(["in", name])` then `if is_not: ... append(["not"])`.
                # So we just push value.
                stack.append(val)

            elif op == "not":
                if stack:
                    val = stack.pop()
                    stack.append(not val)

            elif op == "and":
                if len(stack) >= 2:
                    a = stack.pop()
                    b = stack.pop()
                    stack.append(a and b)

            elif op == "or":
                if len(stack) >= 2:
                    a = stack.pop()
                    b = stack.pop()
                    stack.append(a or b)

            elif op == "out":
                name = instr[1]
                val = stack[-1] if stack else False # Peek or pop?
                # OUT instruction usually passes value through (it's a coil, not a sink in chain).
                # But in RPN for ladder, usually OUT is a terminator for that rung branch?
                # Let's check `TextParser._scan_out`.
                # It appends `['out', name]` then recurses `_scan`.
                # If we are in RPN, `out` should probably pop?
                # Or peek if we want to continue?
                # Ladder logic "coils" don't stop power flow (you can have series coils).
                # So we peek.
                self.set_variable(name, val)
                # But wait, parser structure for `out`?
                # `TextParser` logic: `_scan_out` calls `_scan` for *next* elements.
                # So `out` is just an instruction in the stream.
                # In RPN, it should consume the top value?
                # If we have `[in A] [out B] [in C] [out D]`, that's series?
                # `A -> B -> C -> D`?
                # `_scan` calls `_scan_out` which appends instruction then calls `_scan` for rest of line.
                # `_scan_and` adds `and` if count > 1.
                # So `[in A] [out B]` -> `['in', 'A'], ['out', 'B']`.
                # `[in A] [in B]` -> `['in', 'A'], ['in', 'B'], ['and']`.
                # So `out` takes the current accumulator.
                # Does it modify the stack?
                # If we have `[in A] [out B] [in C] [out D]`:
                # Stack: [A]
                # Out B (sets B=A). Stack: [A]?
                # Next: `in C`. Stack: [A, C].
                # Next: `and`. Stack: [A and C].
                # Out D.
                # This implies `out` does NOT pop. It just reads.
                pass

            else:
                # Unknown
                pass

        # End of scan
