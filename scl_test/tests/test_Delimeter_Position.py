
import unittest
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from src.python_poc.runtime import Runtime, DotDict


class RecursiveMock:
    def __init__(self, name="Mock"):
        self._name = name
    def __getattr__(self, name):
        return RecursiveMock(f"{self._name}.{name}")
    def __getitem__(self, key):
        return RecursiveMock(f"{self._name}[{key}]")
    def __setattr__(self, name, value):
        if name == "_name":
            super().__setattr__(name, value)
        pass # Ignore sets
    def __setitem__(self, key, value):
        pass # Ignore sets
    def __call__(self, *args, **kwargs):
        return RecursiveMock(f"{self._name}()")
    def __int__(self): return 0
    def __float__(self): return 0.0
    def __str__(self): return ""
    def __bool__(self): return False
    def __len__(self): return 0
    def __iter__(self): return iter([])
    def __eq__(self, other): return False
    def __ne__(self, other): return True
    def __le__(self, other): return True
    def __ge__(self, other): return True
    def __lt__(self, other): return False
    def __gt__(self, other): return False
    # Add arithmetic operations if needed
    def __add__(self, other): return RecursiveMock()
    def __sub__(self, other): return RecursiveMock()
    def __mul__(self, other): return RecursiveMock()
    def __truediv__(self, other): return RecursiveMock()
    def __and__(self, other): return RecursiveMock()
    def __or__(self, other): return RecursiveMock()
    def __xor__(self, other): return RecursiveMock()
    def __mod__(self, other): return RecursiveMock()
    def __invert__(self): return RecursiveMock()
    def __neg__(self): return RecursiveMock()


# Mock functions for common SCL calls found in libraries
def mock_functions():
    return {
        '__builtins__': __builtins__,
        'RecursiveMock': RecursiveMock,
        'DINT_TO_TIME': lambda x: x,
        'TIME_TO_DINT': lambda x: x,
        'INT_TO_DINT': lambda x: x,
        'REAL_TO_UDINT': lambda x: int(x),
        'UDINT_TO_DINT': lambda x: int(x),
        'REAL_TO_DINT': lambda x: int(x),
        'DINT_TO_REAL': lambda x: float(x),
        'ABS': abs,
        'MAX': max,
        'MIN': min,
        'LIMIT': lambda mn, val, mx: max(mn, min(val, mx)),
        'CONCAT_STRING': lambda **kwargs: "".join(str(v) for v in kwargs.values()),
        'INT_TO_STRING': lambda x: str(x),
        'CountOfElements': lambda x: len(x) if isinstance(x, list) else 0,
        'Int___CountOfElements': lambda x: len(x) if isinstance(x, list) else 0,
        'DINT_TO_WSTRING': lambda IN: str(IN),
        'CONCAT_WSTRING': lambda **kwargs: "".join(str(v) for v in kwargs.values()),
        'Strip_Sign': lambda **kwargs: kwargs.get('WString', ''),
        'Add_Leading': lambda **kwargs: kwargs.get('String', ''),
        'LEFT': lambda IN, L: IN[:L] if isinstance(IN, str) else IN,
        'RIGHT': lambda IN, L: IN[-L:] if isinstance(IN, str) else IN,
        'LEN': len,
        'DELETE': lambda IN, L, P: IN[:P-1] + IN[P-1+L:] if isinstance(IN, str) else IN,
        'MID': lambda IN, L, P: IN[P-1:P-1+L] if isinstance(IN, str) else IN,
        'FIND': lambda IN1, IN2: IN1.find(IN2) + 1 if isinstance(IN1, str) else 0,
        'INSERT': lambda IN1, IN2, P: IN1[:P-1] + IN2 + IN1[P-1:] if isinstance(IN1, str) else IN1,
        'REPLACE': lambda IN1, IN2, L, P: IN1[:P-1] + IN2 + IN1[P-1+L:] if isinstance(IN1, str) else IN1,
        'CHAR_TO_INT': lambda x: ord(x) if isinstance(x, str) and len(x) > 0 else int(x),
        'STRING_TO_CHAR': lambda x: x[0] if isinstance(x, str) and len(x) > 0 else '',
        'UDINT_TO_INT': lambda x: int(x),
        'CHAR_TO_STRING': lambda x: str(x),
        'WString_to_Time': lambda x: 0,
        'RUNTIME': lambda x: 0,
        'LREAL_TO_INT': lambda x: int(x),
        # Add more mocks as needed by specific files
    }

class Test_Delimeter_Position(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        # Load the specific transpiled module content to runtime
        # Actually runtime.load_scl transpiles from SCL.
        # But here we want to test the already transpiled code if possible?
        # Or we can just use runtime.load_scl pointing to the original SCL file.
        # But the requirement is to use the transpiled file.
        # The runtime currently takes SCL path.
        # Let's override or use exec.
        pass

    def test_run(self):
        # We will load the SCL file using runtime to ensure it matches our transpilation flow
        # This is slightly redundant with transpile_file but verifies integration.
        # But wait, transpile_file created a .py file.
        # Let's import that .py file?
        # Since the generated code is just a function def, we can just exec it.

        import scl_test.transpiled.Delimeter_Position as transpiled_module

        # We need to find the function in the module
        func = getattr(transpiled_module, 'Is_Symbol')

        context = DotDict({
            'character': RecursiveMock(f'character'),
            'ret': False,
            '0': 0,
            '9': 0,
            'A': 0,
            'Z': 0,
            '_a': 0,
            '_z': 0,
        })

        global_dbs = DotDict({})

        # Add mocks to globals if needed (Runtime does this internally for load_scl)
        # But here we are calling the function directly.
        # The function expects (context, global_dbs).
        # And it might use global functions like DINT_TO_TIME.
        # These need to be in the function's globals.
        # Since we imported the module, its globals are the module's globals.
        # We need to inject mocks into the module's globals.

        mocks = mock_functions()
        for k, v in mocks.items():
            setattr(transpiled_module, k, v)

        # Load all other transpiled modules and inject them
        try:
            import pkgutil
            import importlib
            import scl_test.transpiled as pkg

            for _, name, _ in pkgutil.iter_modules(pkg.__path__):
                if name == 'Delimeter_Position': continue
                try:
                    mod = importlib.import_module(f"scl_test.transpiled.{name}")
                    # Inject functions from sibling module
                    for attr_name in dir(mod):
                        if not attr_name.startswith('__'):
                            attr = getattr(mod, attr_name)
                            if callable(attr):
                                setattr(transpiled_module, attr_name, attr)
                except Exception as e:
                    print(f"Warning: Failed to import sibling module {name}: {e}")
        except Exception as e:
            print(f"Warning: Failed to load sibling modules: {e}")

        try:
            func(context, global_dbs)
            print("Execution successful")
        except Exception as e:
            self.fail(f"Execution failed: {e}")

if __name__ == '__main__':
    unittest.main()
