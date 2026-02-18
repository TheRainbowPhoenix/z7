from typing import List, Dict, Any, Union

class Simulator:
    def __init__(self):
        self.variables: Dict[str, bool] = {}
        self.accumulators: List[bool] = []
        self.trace: Dict[int, bool] = {} # Map instruction index to output state

    def set_variable(self, name: str, value: bool):
        self.variables[name] = value

    def get_variable(self, name: str) -> bool:
        return self.variables.get(name, False)

    def reset(self):
        self.variables = {}
        self.accumulators = []
        self.trace = {}

    def run(self, instructions: List[List[Any]]):
        stack: List[bool] = []
        self.trace = {}

        for idx, instr in enumerate(instructions):
            op = instr[0]
            val = False

            if op == "in":
                name = instr[1]
                val = self.get_variable(name)
                stack.append(val)

            elif op == "not":
                if stack:
                    val = not stack.pop()
                    stack.append(val)

            elif op == "and":
                if len(stack) >= 2:
                    a = stack.pop()
                    b = stack.pop()
                    val = a and b
                    stack.append(val)

            elif op == "or":
                if len(stack) >= 2:
                    a = stack.pop()
                    b = stack.pop()
                    val = a or b
                    stack.append(val)

            elif op == "out":
                name = instr[1]
                val = stack[-1] if stack else False
                self.set_variable(name, val)

            else:
                pass

            # Store state for this instruction (used for coloring)
            self.trace[idx] = val
