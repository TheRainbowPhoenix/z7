
import unittest
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from src.python_poc.runtime import Runtime, DotDict

# Mock functions for common SCL calls found in libraries
def mock_functions():
    return {
        '__builtins__': __builtins__,
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
        # Add more mocks as needed by specific files
    }

class Test_String_PercentComplete(unittest.TestCase):
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

        import scl_test.transpiled.String_PercentComplete as transpiled_module

        # We need to find the function in the module
        func = getattr(transpiled_module, 'String_PercentComplete')

        context = DotDict({
            'percent_complete': 0,
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

        try:
            func(context, global_dbs)
            print("Execution successful")
        except Exception as e:
            self.fail(f"Execution failed: {e}")

if __name__ == '__main__':
    unittest.main()
