from src.python_poc.lexer import Lexer
from src.python_poc.parser import Parser
from src.python_poc.transpiler import Transpiler

class DotDict(dict):
    """
    A dictionary that supports dot notation for access.
    Automatically converts nested dictionaries to DotDicts on access.
    """
    def __getattr__(self, item):
        # Auto-create nested dict if missing for convenience in mocking
        if item not in self:
            self[item] = DotDict({})

        value = self[item]
        if isinstance(value, dict) and not isinstance(value, DotDict):
            value = DotDict(value)
            self[item] = value
        return value

    def __setattr__(self, key, value):
        self[key] = value

    def __delattr__(self, item):
        try:
            del self[item]
        except KeyError:
            raise AttributeError(item)

    def __getitem__(self, item):
        # Auto-create nested dict if missing for convenience in mocking
        if item not in self:
            self[item] = DotDict({})

        value = super().__getitem__(item)
        if isinstance(value, dict) and not isinstance(value, DotDict):
            value = DotDict(value)
            self[item] = value
        return value

class Runtime:
    def __init__(self):
        self.global_dbs = DotDict({})
        self.compiled_code = {}

    def load_scl(self, filepath):
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            code = f.read()

        lexer = Lexer(code)
        parser = Parser(lexer)
        program = parser.program()

        transpiler = Transpiler()
        python_code = transpiler.generate(program)

        # Execute the generated code to define functions
        # We execute it in a local namespace, but we need to capture the functions.
        local_scope = {}
        # Ensure builtins are available and common SCL functions
        global_scope = {
            "__builtins__": __builtins__,
            "DINT_TO_TIME": lambda x: x, # Simple passthrough for PoC
            "TIME_TO_DINT": lambda x: x,
            "INT_TO_DINT": lambda x: x,
            # Add more as needed
        }
        try:
            exec(python_code, global_scope, local_scope)
        except Exception as e:
            print(f"Error executing transpiled code:\n{python_code}")
            raise e

        # Store functions in compiled_code
        for name, func in local_scope.items():
            if callable(func):
                self.compiled_code[name] = func

        print(f"Loaded functions: {list(self.compiled_code.keys())}")
        return python_code # For debugging

    def run_function(self, func_name, context_vars=None):
        if func_name not in self.compiled_code:
            raise Exception(f"Function {func_name} not found.")

        func = self.compiled_code[func_name]

        # Prepare context (inputs, outputs, temps)
        context = DotDict(context_vars if context_vars else {})

        # Run
        func(context, self.global_dbs)

        return context
