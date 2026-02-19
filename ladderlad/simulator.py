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

            elif op == "call":
                # ['call', 'BLOCKNAME', 'arg1', 'arg2'...]
                # Simulating blocks in RPN is tricky without standard memory model.
                # Assuming EN/ENO logic:
                # Top of stack is EN (Enable).
                # If EN is true, execute block logic.
                # Push ENO (Enable Out) to stack.
                # Block arguments might be variables (like timers).

                en = stack.pop() if stack else False
                block_name = instr[1]
                args = instr[2:]

                eno = en # Default ENO pass-through

                if block_name == "TON":
                    # Args: [TimerName, Preset]
                    # Logic: If EN true, accumulate.
                    # We need persistent storage for timer state.
                    # self.variables can store simple types.
                    # self.accumulators is list?
                    # Let's assume TimerName is a variable key prefix.
                    if len(args) >= 2:
                        t_name = args[0]
                        try:
                            preset = int(str(args[1]).replace('s','').replace('ms','')) # naive parsing
                        except:
                            preset = 0

                        # State: t_name.ACC, t_name.Q (Done)
                        acc_key = f"{t_name}.ACC"
                        done_key = f"{t_name}.Q" # Usually output?

                        acc = self.variables.get(acc_key, 0)

                        if en:
                            acc += 1 # Simulation tick
                            if acc >= preset:
                                acc = preset
                                self.set_variable(done_key, True)
                            else:
                                self.set_variable(done_key, False)
                        else:
                            acc = 0
                            self.set_variable(done_key, False)

                        self.set_variable(acc_key, acc)

                        # TON usually doesn't affect ENO, or ENO=EN.
                        # Output of TON block in ladder is Q?
                        # In RPN ladder, usually blocks have output pins.
                        # The block call might not push Q to stack, but update variable.
                        # Users access T1.Q later?
                        # Or does the block push Q?
                        # If schematic is `--[ ]--{TON}--( )--`, then result of TON is on stack.
                        # result of TON is Q.
                        val = self.get_variable(done_key)
                        stack.append(val)
                else:
                    # Generic: pass EN to ENO
                    stack.append(eno)
                    val = eno

            else:
                pass

            # Store state for this instruction (used for coloring)
            self.trace[idx] = val
