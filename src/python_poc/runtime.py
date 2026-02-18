from src.python_poc.lexer import Lexer
from src.python_poc.parser import Parser
from src.python_poc.transpiler import Transpiler

class RecursiveMock:
    def __init__(self, name="Mock"):
        self._name = name
        self._data = {} # Store attributes/items

    def __getattr__(self, name):
        if name in self._data:
            return self._data[name]
        return RecursiveMock(f"{self._name}.{name}")

    def __getitem__(self, key):
        if key in self._data:
            return self._data[key]
        return RecursiveMock(f"{self._name}[{key}]")

    def __setattr__(self, name, value):
        if name in ["_name", "_data"]:
            super().__setattr__(name, value)
        else:
            self._data[name] = value

    def __setitem__(self, key, value):
        self._data[key] = value

    def __call__(self, *args, **kwargs):
        return RecursiveMock(f"{self._name}()")

    def __int__(self): return 0
    def __float__(self): return 0.0
    def __str__(self): return ""
    def __bool__(self): return False
    def __len__(self): return 0
    def __iter__(self): return iter([])
    # Comparisons
    def __eq__(self, other): return False
    def __ne__(self, other): return True
    def __le__(self, other): return True
    def __ge__(self, other): return True
    def __lt__(self, other): return False
    def __gt__(self, other): return False
    # Arithmetic
    def __add__(self, other): return RecursiveMock()
    def __sub__(self, other): return RecursiveMock()
    def __mul__(self, other): return RecursiveMock()
    def __truediv__(self, other): return RecursiveMock()
    def __floordiv__(self, other): return RecursiveMock()
    def __mod__(self, other): return RecursiveMock()
    def __and__(self, other): return RecursiveMock()
    def __or__(self, other): return RecursiveMock()
    def __xor__(self, other): return RecursiveMock()
    def __invert__(self): return RecursiveMock()
    def __neg__(self): return RecursiveMock()
    def __radd__(self, other): return RecursiveMock()
    def __rsub__(self, other): return RecursiveMock()
    def __rmul__(self, other): return RecursiveMock()
    def __rtruediv__(self, other): return RecursiveMock()

class DotDict(dict):
    """
    A dictionary that supports dot notation for access.
    Automatically converts nested dictionaries to DotDicts on access.
    Returns RecursiveMock for missing keys to handle undefined variables gracefully.
    """
    def __getattr__(self, item):
        if item not in self:
            # Return RecursiveMock instead of empty DotDict to support arithmetic/operations
            self[item] = RecursiveMock(f"Missing_{item}")

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
        if item not in self:
             self[item] = RecursiveMock(f"Missing_{item}")

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
            "RecursiveMock": RecursiveMock,
            "DINT_TO_TIME": lambda x: x,
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
        # Pass context and global_dbs as kwargs because func signature is (*args, context=None, global_dbs=None, **kwargs)
        func(context=context, global_dbs=self.global_dbs)

        return context
