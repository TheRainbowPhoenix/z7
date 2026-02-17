import os
import sys
import traceback

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.python_poc.lexer import Lexer
from src.python_poc.parser import Parser, VarDecl, StructType
from src.python_poc.transpiler import Transpiler
from src.python_poc.runtime import Runtime, DotDict, RecursiveMock

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

def sanitize(name):
    if not isinstance(name, str):
        name = str(name)
    return name.replace('"', '').replace('.', '_').replace('[', '_').replace(']', '_').replace(' ', '_').replace('{', '_').replace('}', '_').replace(':', '_').replace('&', '_and_')

def generate_test(module_name, program, output_dir):
    try:
        if not program.functions:
            return None

        # Collect defined types
        defined_types = {}
        if hasattr(program, 'types'):
            for t in program.types:
                clean_name = t.name.strip('"')
                class_name = sanitize(t.name)
                defined_types[clean_name] = class_name

        # Try to find the "main" function matching the module name
        target_func = program.functions[0] # Default to first
        normalized_mod = module_name.lower().replace('_', '')

        for func in program.functions:
            normalized_func = func.name.lower().replace('.', '').replace('_', '').replace('"', '')
            if normalized_func in normalized_mod or normalized_mod in normalized_func:
                target_func = func
                break

        func = target_func
        func_name_in_python = sanitize(func.name)

        # Prepare context variables (8 spaces indent)
        context_setup = "        context = DotDict({\n"

        for decl in func.var_decls:
            if decl.section_type in ['VAR_INPUT', 'VAR_IN_OUT', 'VAR_OUTPUT', 'VAR', 'VAR CONSTANT', 'VAR_TEMP']:
                for name, type_spec, init_val in decl.vars:
                    # Sanitize name
                    sanitized_name = sanitize(name)

                    # Determine initial value
                    py_val = "RecursiveMock(f'" + sanitized_name + "')"

                    type_str = str(type_spec).strip('"')
                    type_upper = type_str.upper()

                    if isinstance(type_spec, StructType):
                        py_val = "DotDict({})"
                    elif type_str in defined_types:
                        py_val = f"transpiled_module.{defined_types[type_str]}()"
                    elif "ARRAY" in type_upper:
                        py_val = "DotDict({})"
                    elif "BOOL" == type_upper or type_upper == "BOOL":
                        py_val = "False"
                    elif "STRING" in type_upper or "WSTRING" in type_upper:
                        py_val = "DotDict({})"
                    elif "VARIANT" in type_upper:
                         py_val = "DotDict({})"
                    elif type_upper in ['BYTE', 'WORD', 'DWORD', 'LWORD']:
                        py_val = "RecursiveMock(f'" + sanitized_name + "')"
                    elif type_upper in ['INT', 'SINT', 'USINT', 'UINT', 'DINT', 'UDINT', 'LINT', 'ULINT', 'REAL', 'LREAL', 'TIME', 'LTIME', 'S5TIME', 'DATE', 'TOD', 'TIME_OF_DAY', 'DT', 'DATE_AND_TIME', 'CHAR', 'WCHAR']:
                        py_val = "0"

                    context_setup += f"            '{sanitized_name}': {py_val},\n"

        context_setup += "        })\n"

        test_content = f"""
import unittest
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from src.python_poc.runtime import Runtime, DotDict, RecursiveMock

# Mock functions for common SCL calls found in libraries
def mock_functions():
    return {{
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
        'UDINT_TO_DINT': lambda x: int(x),
        'Strg_TO_Chars': lambda **kwargs: None, # Mock side effect?
        'Chars_TO_Strg': lambda **kwargs: None,
        'LEFT_STRING': lambda IN, L: IN[:L] if isinstance(IN, str) else IN,
        'RIGHT_STRING': lambda IN, L: IN[-L:] if isinstance(IN, str) else IN,
        'UINT_TO_INT': lambda x: int(x),
        'RD_SYS_T': lambda x: 0,
        'DINT_TO_DWORD': lambda x: int(x),
        'SHR_BYTE': lambda **kwargs: 0,
        'WCHAR_TO_DINT': lambda IN: int(IN),
        'BYTE_TO_INT': lambda x: int(x),
        'CHAR_TO_BYTE': lambda x: ord(x) if isinstance(x, str) and len(x) > 0 else int(x),
        'INT_TO_BYTE': lambda x: int(x),
        'STRING_TO_UINT': lambda x: int(x),
        'WORD_TO_INT': lambda x: int(x),
        'DWORD_TO_DINT': lambda x: int(x),
        # Add more mocks as needed by specific files
    }}

class Test_{module_name}(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        pass

    def test_run(self):
        import scl_test.transpiled.{module_name} as transpiled_module

        # We need to find the function in the module
        func = getattr(transpiled_module, '{func_name_in_python}')

{context_setup}
        global_dbs = DotDict({{}})

        # Add mocks to globals
        mocks = mock_functions()
        for k, v in mocks.items():
            setattr(transpiled_module, k, v)

        # Load all other transpiled modules and inject them
        try:
            import pkgutil
            import importlib
            import scl_test.transpiled as pkg

            for _, name, _ in pkgutil.iter_modules(pkg.__path__):
                if name == '{module_name}': continue
                try:
                    mod = importlib.import_module(f"scl_test.transpiled.{{name}}")

                    # Inject mocks into sibling module so they can run standard functions
                    for k, v in mocks.items():
                        setattr(mod, k, v)

                    # Inject functions from sibling module into current module
                    for attr_name in dir(mod):
                        if not attr_name.startswith('__'):
                            attr = getattr(mod, attr_name)
                            if callable(attr):
                                setattr(transpiled_module, attr_name, attr)
                except Exception as e:
                    print(f"Warning: Failed to import sibling module {{name}}: {{e}}")
        except Exception as e:
            print(f"Warning: Failed to load sibling modules: {{e}}")

        try:
            func(context=context, global_dbs=global_dbs)
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
        traceback.print_exc()
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
