from typing import List, Dict, Any, Union, Callable

class Simulator:
    def __init__(self):
        self.variables: Dict[str, bool] = {}
        self.accumulators: List[bool] = []
        self.trace: Dict[int, bool] = {} # Map instruction index to output state
        self.callbacks: Dict[str, Callable] = {}

    def set_variable(self, name: str, value: Any):
        self.variables[name] = value

    def get_variable(self, name: str) -> Any:
        return self.variables.get(name, False)

    def register_function(self, name: str, callback: Callable):
        self.callbacks[name] = callback

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
                val = bool(self.get_variable(name))
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
                en = stack.pop() if stack else False
                block_name = instr[1]
                args = instr[2:]

                # Check for registered callback first
                if block_name in self.callbacks:
                    # Callback signature: (simulator_instance, enable_in, args) -> (enable_out, result_value)
                    # Or simpler: just returns result, ENO=EN?
                    # Let's assume standard (en, args) -> (eno, val)
                    try:
                        eno, val = self.callbacks[block_name](self, en, args)
                    except Exception as e:
                        print(f"Error calling {block_name}: {e}")
                        eno = en
                        val = False

                    stack.append(val)
                    # We might want to push ENO too if the logic supports it, but RPN here expects 1 result.
                    # Usually block result is Q. ENO is implicit flow?
                    # Our 'val' tracks logic flow color.
                    # So 'val' should be logic flow (ENO? or Q?).
                    # If connected to coil, it should be Q?
                    # In ladder, --{ }-- usually passes ENO.
                    # Q is often an output pin assigned to var.
                    # But if used in expression --{ }--( ), the value passed is usually ENO.
                    # BUT for TON, we returned Q in previous logic?
                    # "val = self.get_variable(done_key)" -> Q.
                    pass

                elif block_name == "TON":
                    if len(args) >= 2:
                        t_name = args[0]
                        try:
                            preset = int(str(args[1]).replace('s','').replace('ms',''))
                        except:
                            preset = 0

                        acc_key = f"{t_name}.ACC"
                        done_key = f"{t_name}.Q"

                        acc = self.variables.get(acc_key, 0)

                        if en:
                            acc += 1
                            if acc >= preset:
                                acc = preset
                                self.set_variable(done_key, True)
                            else:
                                self.set_variable(done_key, False)
                        else:
                            acc = 0
                            self.set_variable(done_key, False)

                        self.set_variable(acc_key, acc)
                        val = self.get_variable(done_key) # Return Q? Or ENO?
                        # If we return Q, we can do --{TON}--(Q).
                        # If we return ENO, we can chain blocks.
                        # Standard TON in ladder usually has Q pin.
                        # If embedded in rung, it usually passes power (ENO) or Q?
                        # Let's return Q for now as per previous logic.
                        stack.append(val)
                else:
                    val = en # Default passthrough
                    stack.append(val)

            else:
                pass

            self.trace[idx] = val
