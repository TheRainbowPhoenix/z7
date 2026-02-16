import os
import sys
import traceback

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.python_poc.lexer import Lexer
from src.python_poc.parser import Parser, VarDecl
from src.python_poc.transpiler import Transpiler
from src.python_poc.runtime import Runtime, DotDict

def transpile_file(scl_filepath, output_dir):
    try:
        with open(scl_filepath, 'r', encoding='utf-8-sig') as f:
            code = f.read()

        lexer = Lexer(code)
        parser = Parser(lexer)
        program = parser.program()

        transpiler = Transpiler()
        python_code = transpiler.generate(program)

        filename = os.path.basename(scl_filepath)
        module_name = os.path.splitext(filename)[0].replace('.', '_').replace('[', '_').replace(']', '_').replace(' ', '_').replace('{', '_').replace('}', '_')
        output_path = os.path.join(output_dir, f"{module_name}.py")

        with open(output_path, 'w') as f:
            f.write(python_code)

        print(f"Transpiled {scl_filepath} to {output_path}")
        return module_name, program, True
    except Exception as e:
        print(f"Failed to transpile {scl_filepath}: {e}")
        # traceback.print_exc()
        return None, None, False

def generate_test(module_name, program, output_dir):
    try:
        # Assuming one function per file for now, or taking the first one
        if not program.functions:
            return None

        func = program.functions[0]
        func_name_in_python = func.name.replace('"', '').replace('.', '_').replace('[', '_').replace(']', '_').replace(' ', '_').replace('{', '_').replace('}', '_')

        # Prepare context variables (8 spaces indent)
        context_setup = "        context = DotDict({\n"

        for decl in func.var_decls:
            if decl.section_type in ['VAR_INPUT', 'VAR_IN_OUT', 'VAR_OUTPUT', 'VAR', 'VAR CONSTANT']:
                for name, type_spec, init_val in decl.vars:
                    py_val = "0"
                    if "BOOL" in type_spec.upper():
                        py_val = "False"
                    elif "STRING" in type_spec.upper():
                        py_val = "''"
                    elif "ARRAY" in type_spec.upper():
                        py_val = "[0] * 100" # Default array size

                    context_setup += f"            '{name}': {py_val},\n"

        context_setup += "        })\n"

        test_content = f"""
import unittest
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from src.python_poc.runtime import Runtime, DotDict

# Mock functions for common SCL calls found in libraries
def mock_functions():
    return {{
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
    }}

class Test_{module_name}(unittest.TestCase):
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

        import scl_test.transpiled.{module_name} as transpiled_module

        # We need to find the function in the module
        func = getattr(transpiled_module, '{func_name_in_python}')

{context_setup}
        global_dbs = DotDict({{}})

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
            self.fail(f"Execution failed: {{e}}")

if __name__ == '__main__':
    unittest.main()
"""
        test_path = os.path.join(output_dir, f"test_{module_name}.py")
        with open(test_path, 'w') as f:
            f.write(test_content)
        return test_path
    except Exception as e:
        print(f"Failed to generate test for {module_name}: {e}")
        return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 tools/transpile_and_test.py <scl_file_or_dir> [log_file]")
        sys.exit(1)

    target = sys.argv[1]
    log_file = "scl_test_results.txt"
    if len(sys.argv) > 2:
        log_file = sys.argv[2]

    scl_files = []

    if os.path.isfile(target):
        scl_files.append(target)
    elif os.path.isdir(target):
        for root, dirs, files in os.walk(target):
            for file in files:
                if file.endswith(".scl"):
                    scl_files.append(os.path.join(root, file))

    output_dir = "scl_test/transpiled"
    test_dir = "scl_test/tests"
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(test_dir, exist_ok=True)

    # Create __init__.py in output dirs to make them packages
    open(os.path.join(output_dir, '__init__.py'), 'a').close()
    open(os.path.join(test_dir, '__init__.py'), 'a').close()
    open(os.path.join("scl_test", '__init__.py'), 'a').close()

    passed = 0
    failed = 0

    with open(log_file, 'w') as log:
        log.write(f"Test Run Start: {target}\n")
        log.write("==================================================\n\n")

    for scl_file in scl_files:
        print(f"Processing {scl_file}...")

        with open(log_file, 'a') as log:
            log.write(f"TEST: {scl_file}\n")
            log.write("--------------------------------------------------\n")
            log.write("Expectation: Transpilation and Unit Test should pass.\n")
            log.write(f"SCL File: {scl_file}\n")
            # Try to read first few lines
            try:
                with open(scl_file, 'r', encoding='utf-8-sig') as f:
                    head = [next(f) for _ in range(5)]
                log.write("SCL Header:\n")
                log.writelines(head)
                log.write("...\n")
            except StopIteration:
                pass
            except Exception as e:
                log.write(f"(Could not read SCL file content: {e})\n")
            log.write("\nTest Output:\n")

        module_name, program, success = transpile_file(scl_file, output_dir)

        with open(log_file, 'a') as log:
            if success:
                log.write(f"Transpilation: SUCCESS\n")
                test_path = generate_test(module_name, program, test_dir)
                if test_path:
                    # Run the test
                    import subprocess
                    try:
                        result = subprocess.run(['python3', test_path], capture_output=True, text=True, timeout=5)
                        log.write(result.stdout)
                        log.write(result.stderr)

                        if result.returncode == 0:
                            log.write("\nRESULT: PASSED\n")
                            print(f"Test PASSED: {scl_file}")
                            passed += 1
                        else:
                            log.write("\nRESULT: FAILED\n")
                            print(f"Test FAILED: {scl_file}")
                            failed += 1
                    except subprocess.TimeoutExpired:
                        log.write("\nRESULT: TIMEOUT\n")
                        print(f"Test TIMEOUT: {scl_file}")
                        failed += 1
                    except Exception as e:
                        log.write(f"\nRESULT: EXECUTION ERROR ({e})\n")
                        print(f"Test ERROR: {scl_file}")
                        failed += 1
                else:
                    log.write("Test Generation: FAILED (Could not generate test wrapper)\n")
                    print(f"Test Generation Failed: {scl_file}")
                    failed += 1
            else:
                log.write(f"Transpilation: FAILED\n")
                print(f"Transpilation Failed: {scl_file}")
                failed += 1
            log.write("\n==================================================\n\n")

    with open(log_file, 'a') as log:
        log.write(f"Summary: {passed} Passed, {failed} Failed.\n")
    print(f"\nSummary: {passed} Passed, {failed} Failed.")

if __name__ == '__main__':
    main()
