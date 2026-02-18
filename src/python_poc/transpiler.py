from src.python_poc.parser import *

class Transpiler:
    def __init__(self):
        self.indent_level = 0
        self.generated_code = ""
        self.types_map = {} # SCL type name -> Python class name
        self.in_class = False
        self.current_function_name = None

    def indent(self):
        return "    " * self.indent_level

    def generate(self, ast):
        return self.visit(ast)

    def visit(self, node):
        method_name = f'visit_{type(node).__name__}'
        visitor = getattr(self, method_name, self.generic_visit)
        return visitor(node)

    def generic_visit(self, node):
        raise Exception(f'No visit_{type(node).__name__} method')

    def visit_Program(self, node):
        code = "import math\n"
        code += "from src.python_poc.runtime import DotDict, RecursiveMock\n\n"

        # Helper for Array Initialization
        code += "def Init_Array(size, default_val):\n"
        code += "    return DotDict({i: default_val for i in range(size)})\n\n"

        # Generate types first
        for type_decl in node.types:
            code += self.visit(type_decl) + "\n\n"

        for func in node.functions:
            code += self.visit(func) + "\n\n"
        return code

    def sanitize_name(self, name):
        if not isinstance(name, str):
            name = str(name)

        sanitized = name.replace('"', '').replace('.', '_').replace('[', '_').replace(']', '_').replace(' ', '_').replace('{', '_').replace('}', '_').replace(':', '_').replace('&', '_and_').replace('/', '_or_')

        import keyword
        if keyword.iskeyword(sanitized):
            return sanitized + "_"
        return sanitized

    def get_default_val(self, type_spec):
        if isinstance(type_spec, str):
            type_upper = type_spec.upper()
            if type_upper in ['BOOL']:
                return "False"
            elif type_upper in ['BYTE', 'WORD', 'DWORD', 'LWORD']:
                return "0" # Or RecursiveMock? Using 0 for bits manipulation if needed, or RecursiveMock if member access.
                           # Actually DWord.To_String uses .%B0, so RecursiveMock is better or we need a wrapper.
                           # My previous fix in transpile_and_test used RecursiveMock for these.
                           # But inside generated code we don't have RecursiveMock unless imported.
                           # The generated code imports math. We can inject RecursiveMock or use it if available.
                           # tools/transpile_and_test injects RecursiveMock.
                return "RecursiveMock()"
            elif type_upper in ['INT', 'SINT', 'USINT', 'UINT', 'DINT', 'UDINT', 'LINT', 'ULINT', 'REAL', 'LREAL', 'TIME', 'LTIME', 'S5TIME', 'DATE', 'TOD', 'TIME_OF_DAY', 'DT', 'DATE_AND_TIME', 'CHAR', 'WCHAR']:
                return "0"
            elif "STRING" in type_upper or "WSTRING" in type_upper:
                return "DotDict({})"
            elif "ARRAY" in type_upper:
                # Try to extract size?
                # Parser format: Array[start..end] of type
                # But here type_spec is just the string.
                # If we want correct size init, we need to parse it or use dynamic init.
                # For now, let's use DotDict({}) but maybe Init_Array if we could.
                # But get_default_val returns string code.
                return "DotDict({})"
            elif "VARIANT" in type_upper:
                return "DotDict({})"

            # Check if it is a known UDT
            # type_spec might be "Timer.Control" (with quotes in parser? parser eats quotes for string token?)
            # In parser.type_spec(), if it's a string token, we kept quotes?
            # Let's check Parser.type_spec:
            # if self.current_token.type == 'STRING': self.eat('STRING') -> val includes quotes if token has them.
            # Tokenizer for STRING includes quotes.

            clean_type = type_spec.strip('"')
            if clean_type in self.types_map:
                return f"{self.types_map[clean_type]}()"

            # If quoted and not found, maybe sanitize?
            # self.types_map keys are raw names from parser (with quotes if they had them).

            # Fallback
            return "RecursiveMock()"

        elif isinstance(type_spec, StructType):
             # Inline struct? We can't easily instantiate a class unless we define it.
             # Or we return a DotDict with initialized fields.
             # Generating inline DotDict initialization:
             # DotDict({'field': val, ...})
             init_str = "DotDict({"
             for name, m_type, init in type_spec.members:
                 val = "0"
                 if init:
                     val = self.visit(init)
                 else:
                     val = self.get_default_val(m_type)
                 init_str += f"'{name}': {val}, "
             init_str += "})"
             return init_str

        return "None"

    def visit_TypeDecl(self, node):
        self.in_class = True
        class_name = self.sanitize_name(node.name)
        # Store in map (handle potential quotes in node.name)
        clean_name = node.name.strip('"')
        self.types_map[clean_name] = class_name
        self.types_map[node.name] = class_name # Store raw too just in case

        code = f"class {class_name}:\n"
        self.indent_level += 1
        code += f"{self.indent()}def __init__(self):\n"
        self.indent_level += 1

        if isinstance(node.type_spec, StructType):
            code += self.visit_StructType(node.type_spec)
        else:
            code += f"{self.indent()}pass\n"

        self.indent_level -= 2
        self.in_class = False
        return code

    def visit_StructType(self, node):
        code = ""
        for name, type_spec, init_val in node.members:
            val = "0"
            if init_val:
                val = self.visit(init_val)
            else:
                val = self.get_default_val(type_spec)

            sanitized_name = self.sanitize_name(name)
            code += f"{self.indent()}self.{sanitized_name} = {val}\n"

        if not code:
             code += f"{self.indent()}pass\n"
        return code

    def visit_Function(self, node):
        # We generate a function that takes 'context' and 'global_dbs'
        # context will hold all INPUT, OUTPUT, IN_OUT, TEMP variables.
        func_name = self.sanitize_name(node.name)
        self.current_function_name = func_name

        # Define function to accept positional args (mapped to inputs) and kw-only context
        code = f"def {func_name}(*args, context=None, global_dbs=None, **kwargs):\n"
        self.indent_level += 1

        code += f"{self.indent()}if context is None: context = {{}}\n"
        code += f"{self.indent()}if global_dbs is None: global_dbs = {{}}\n"

        # Map positional args to VAR_INPUT/VAR_IN_OUT names
        input_vars = []
        for decl in node.var_decls:
            if decl.section_type in ['VAR_INPUT', 'VAR_IN_OUT']:
                for name, _, _ in decl.vars:
                    input_vars.append(name)

        code += f"{self.indent()}# Mapping inputs\n"
        for i, var_name in enumerate(input_vars):
            sanitized_var_name = self.sanitize_name(var_name)
            code += f"{self.indent()}if len(args) > {i}: context['{sanitized_var_name}'] = args[{i}]\n"

        code += f"{self.indent()}for k, v in kwargs.items():\n"
        code += f"{self.indent()}    context[k] = v\n"

        # Initialize TEMP variables if needed, or rely on them being in context?
        # Typically TEMP are undefined at start.
        # We can document declared variables in comments
        code += f"{self.indent()}# Return Type: {node.return_type}\n"
        for decl in node.var_decls:
            code += f"{self.indent()}# {decl.section_type}:\n"
            for name, type_spec, init_val in decl.vars:
                code += f"{self.indent()}#   {name}: {type_spec}\n"
                sanitized_name = self.sanitize_name(name)

                # Check if it needs initialization (TEMP, VAR) or if init_val is present
                # VAR_INPUT/IN_OUT are passed in, but if missing, we might want default?
                # VAR and VAR_TEMP should be initialized.

                needs_init = True # Default to init
                if decl.section_type in ['VAR_INPUT', 'VAR_IN_OUT']:
                    # Only init if not in context?
                    # Python kwargs handling does this.
                    # But if we want defaults for missing inputs?
                    # For now, rely on context check
                    needs_init = False # Initialized by args/kwargs

                if init_val:
                    val_code = self.visit(init_val)
                    # Check if array init
                    if "Array" in str(type_spec) and "[" in str(type_spec) and ".." in str(type_spec):
                         # Extract size. Format: Array[start..end] ...
                         try:
                             import re
                             match = re.search(r"Array\[(\d+)\.\.(\d+)\]", str(type_spec))
                             if match:
                                 start = int(match.group(1))
                                 end = int(match.group(2))
                                 size = end - start + 1
                                 code += f"{self.indent()}if '{sanitized_name}' not in context: context['{sanitized_name}'] = Init_Array({size}, {val_code})\n"
                             else:
                                 # Fallback
                                 code += f"{self.indent()}if '{sanitized_name}' not in context: context['{sanitized_name}'] = {val_code}\n"
                         except:
                             code += f"{self.indent()}if '{sanitized_name}' not in context: context['{sanitized_name}'] = {val_code}\n"
                    else:
                        code += f"{self.indent()}if '{sanitized_name}' not in context: context['{sanitized_name}'] = {val_code}\n"
                elif needs_init or decl.section_type in ['VAR', 'VAR_TEMP']:
                     # Init with default value based on type
                     default_val = self.get_default_val(type_spec)
                     code += f"{self.indent()}if '{sanitized_name}' not in context: context['{sanitized_name}'] = {default_val}\n"

        block_code = self.visit(node.block)
        code += block_code

        # Check if we generated any statements in the body (assignments or block)
        has_init = False
        for decl in node.var_decls:
            for _, _, init_val in decl.vars:
                if init_val:
                    has_init = True
                    break
            if has_init: break

        if not block_code and not has_init:
             code += f"{self.indent()}pass\n"

        if node.return_type and str(node.return_type).upper() != 'VOID':
             code += f"{self.indent()}return context.get('{func_name}')\n"

        self.indent_level -= 1
        self.current_function_name = None
        return code

    def visit_Block(self, node):
        code = ""
        for stmt in node.statements:
            stmt_code = self.visit(stmt)
            if stmt_code:
                # If stmt_code is multi-line (e.g. Region), we need to be careful?
                # No, if visit_Region returns correctly indented block, we append it.
                # But here we append self.indent() to the first line.
                code += f"{self.indent()}{stmt_code}\n"
        return code

    def visit_Region(self, node):
        # Visit block with current indent level
        code = self.visit_Block(node)
        # Outer visit_Block will add indentation to the first line.
        # So we strip leading whitespace from the first line (which visit_Block added).
        # We also remove trailing newline to avoid double newline in outer block.
        return code.lstrip().rstrip()

    def visit_Assignment(self, node):
        left = self.visit(node.left)
        right = self.visit(node.right)
        return f"{left} = {right}"

    def visit_IfStmt(self, node):
        cond = self.visit(node.condition)
        code = f"if {cond}:\n"

        self.indent_level += 1
        code += self.visit(node.then_block)
        if not node.then_block.statements:
            code += f"{self.indent()}pass\n"
        self.indent_level -= 1

        if node.else_block:
            # Check if else_block contains a single IfStmt (ELSIF case optimization)
            if isinstance(node.else_block, Block) and len(node.else_block.statements) == 1 and isinstance(node.else_block.statements[0], IfStmt):
                 # This is an ELSIF
                 # Actually standard python 'elif'
                 # We can recursively print it as elif
                 # But my visit_Block iterates statements.
                 # Let's just output else: and indent
                 code += f"{self.indent()}else:\n"
                 self.indent_level += 1
                 code += self.visit(node.else_block)
                 self.indent_level -= 1
            else:
                 code += f"{self.indent()}else:\n"
                 self.indent_level += 1
                 code += self.visit(node.else_block)
                 if not node.else_block.statements:
                    code += f"{self.indent()}pass\n"
                 self.indent_level -= 1

        return code.strip() # Strip trailing newline to let visit_Block handle it

    def visit_CaseStmt(self, node):
        expr = self.visit(node.expr)

        # We need to evaluate expr once.
        var_name = f"_case_val_{self.indent_level}"
        code = f"{var_name} = {expr}\n"

        first = True
        for labels, block in node.cases:
            conditions = []
            for label in labels:
                if isinstance(label, tuple): # Range (start, end)
                    start = self.visit(label[0])
                    end = self.visit(label[1])
                    conditions.append(f"({var_name} >= {start} and {var_name} <= {end})")
                else: # Single value
                    val = self.visit(label)
                    conditions.append(f"{var_name} == {val}")

            condition_str = " or ".join(conditions)

            if first:
                code += f"{self.indent()}if {condition_str}:\n"
                first = False
            else:
                code += f"{self.indent()}elif {condition_str}:\n"

            self.indent_level += 1
            code += self.visit(block)
            if not block.statements:
                 code += f"{self.indent()}pass\n"
            self.indent_level -= 1

        if node.else_block:
            code += f"{self.indent()}else:\n"
            self.indent_level += 1
            code += self.visit(node.else_block)
            if not node.else_block.statements:
                 code += f"{self.indent()}pass\n"
            self.indent_level -= 1

        return code.strip()

    def visit_ForStmt(self, node):
        var = self.visit(node.variable)
        start = self.visit(node.start)
        end = self.visit(node.end)

        step_val = "1"
        if node.step:
            step_val = self.visit(node.step)

        # SCL loops are inclusive TO end. Python range is exclusive.
        # Also need to handle loop variable assignment.
        # Since 'var' maps to context['var'], we need to update it in the loop.

        # We can't use 'for context["i"] in range...' directly in python.
        # So we use a temp python var, and assign it to context var inside loop.
        loop_var = f"_loop_var_{self.indent_level}"

        # Handle step logic for range
        # If step is positive: range(start, end + 1, step)
        # If step is negative: range(start, end - 1, step)
        # Since step might be an expression, we need dynamic handling or assumption?
        # For simplicity, if step_val string starts with '-', assume negative.
        # Ideally we generate code to determine this at runtime if it's dynamic.

        # Safe python approach:
        # range(start, end + 1) if step > 0 else range(start, end - 1, step)

        # But wait, Python's range(start, stop, step) logic:
        # if step > 0, stop is exclusive upper bound. So end + 1.
        # if step < 0, stop is exclusive lower bound. So end - 1.

        # Construct dynamic range call
        code = f"for {loop_var} in range(int({start}), int({end}) + (1 if int({step_val}) > 0 else -1), int({step_val})):\n"
        self.indent_level += 1
        code += f"{self.indent()}{var} = {loop_var}\n"
        code += self.visit(node.block)
        self.indent_level -= 1
        return code.strip()

    def visit_WhileStmt(self, node):
        cond = self.visit(node.condition)
        code = f"while {cond}:\n"
        self.indent_level += 1
        code += self.visit(node.block)
        if not node.block.statements:
             code += f"{self.indent()}pass\n"
        self.indent_level -= 1
        return code.strip()

    def visit_ExitStmt(self, node):
        return "break"

    def visit_ReturnStmt(self, node):
        if self.current_function_name:
            return f"return context.get('{self.current_function_name}')"
        return "return"

    def visit_GotoStmt(self, node):
        # Python has no GOTO. We generate a comment.
        return f"pass # GOTO {node.target} (Not supported)"

    def visit_LabelStmt(self, node):
        # Label.
        return f"pass # LABEL {node.name}"

    def visit_BinOp(self, node):
        left = self.visit(node.left)
        right = self.visit(node.right)
        op_map = {
            'PLUS': '+', 'MINUS': '-', 'MUL': '*', 'DIV': '/',
            'EQ': '==', 'LT': '<', 'GT': '>',
            'NE': '!=', 'LE': '<=', 'GE': '>='
        }

        # Handle keywords (AND, OR, XOR, MOD)
        if node.op.type == 'KEYWORD':
            val = node.op.value.upper()
            if val == 'AND': op = 'and'
            elif val == 'OR': op = 'or'
            elif val == 'XOR': op = '^' # Python XOR is ^
            elif val == 'MOD': op = '%'
            else: op = val
        else:
            op = op_map.get(node.op.type, node.op.type)

        return f"({left} {op} {right})"

    def visit_UnaryOp(self, node):
        expr = self.visit(node.expr)
        op_map = {'PLUS': '+', 'MINUS': '-'}

        if node.op.type == 'KEYWORD' and node.op.value.upper() == 'NOT':
            op = 'not '
        else:
            op = op_map.get(node.op.type, node.op.type)

        return f"({op}{expr})"

    def visit_Variable(self, node):
        # Remove quotes if present
        if not isinstance(node.name, str):
            print(f"DEBUG: Variable name is not string: {node.name} (type {type(node.name)}) in node {node}")
            name = str(node.name).strip('"')
        else:
            name = node.name.strip('"')

        sanitized = self.sanitize_name(name)

        if self.in_class:
            # If inside a class definition (TypeDecl), we cannot access context.
            # Return a RecursiveMock or literal assumption if it is a constant.
            # Since SCL constants used in initial values are usually resolved at compile time or global,
            # and we don't have global constants loaded in the class scope, we use a Mock.
            return f"RecursiveMock('{sanitized}')"

        if node.is_local:
             # #var means local context
             return f"context['{sanitized}']"
        else:
            # Could be global or local without hash (if allowed/ambiguous)
            # In SCL, # is usually mandatory for temps/params in some editors, but optional in others?
            # Based on example: #"diTimeLeft[s]" used for locals.
            # "DB Services" used for globals.
            # So if it starts with #, it's local (handled by parser setting is_local).
            # If not, it might be local or global.
            # Lexer/Parser distinguishes #.
            # We will assume if not local, we try global_dbs first?
            # Or if it contains spaces/dots, it's likely global DB or complex access.
            # But the parser splits dots into MemberAccess.
            # So here we just have the base name.

            # If the name corresponds to a known DB (we don't know them statically easily), use global_dbs.
            # For PoC, let's assume if it is NOT in context, it is global?
            # But we are generating code.
            # Let's try context first, then global_dbs?
            # Or use a helper function `get_var(name, context, global_dbs)`.
            # But we want assignments to work: `get_var(...) = val` is invalid.

            # If it's on the LHS of assignment, we need a valid lvalue.
            # `context['name']` is valid. `global_dbs['name']` is valid.

            # Strategy:
            # If name looks like a DB (e.g. "DB Services"), use global_dbs.
            # If it looks like a variable (no spaces usually, unless quoted), context.
            # But "DB Services" is quoted.

            if "DB " in name or " " in name: # Heuristic for DB names in this example
                return f"global_dbs['{name}']"
            else:
                return f"context['{sanitized}']"

    def visit_MemberAccess(self, node):
        expr = self.visit(node.expr)
        member = node.member.strip('"')

        # Check if member is a valid python identifier and not a keyword
        import keyword
        if not member.isidentifier() or keyword.iskeyword(member):
             return f"{expr}['{member}']"
        else:
             return f"{expr}.{member}"

    def visit_ArrayAccess(self, node):
        expr = self.visit(node.expr)
        index = self.visit(node.index)
        return f"{expr}[int({index})]"

    def visit_Literal(self, node):
        if node.type_name.upper() in ['STRING', 'WSTRING', 'CHAR', 'WCHAR']:
            return f"'{node.value}'"
        elif node.type_name.upper() == 'BOOL':
            return "True" if node.value else "False"
        else:
            return str(node.value)

    def visit_Call(self, node):
        if isinstance(node.expr, Variable):
            # Special handling for direct function calls to sanitize name
            func_name = self.sanitize_name(node.expr.name)
            args = [self.visit(arg) for arg in node.args]

            # Check if it's a known standard function or an internal function call.
            # Internal functions need context and global_dbs passed.
            # Standard functions (like SCL builtins) might not, but we mocked them to ignore extra args or we can check.
            # However, our generated functions signature is (context=None, global_dbs=None, **kwargs).
            # So passing them is safe if the target function accepts **kwargs.
            # Our mocks should accept **kwargs too or be robust.
            # But wait, standard functions like ABS(x) don't take context.
            # If we pass ABS(x, context=context), it will fail if ABS is math.abs.
            # We need to distinguish between internal function calls and standard library calls.
            # We don't have a symbol table here easily.
            # Heuristic: SCL standard functions are usually uppercase. User functions are MixedCase or have underscores/dots.
            # But this is risky.

            # Better approach: The generated function signature uses **kwargs.
            # If we pass context=context, global_dbs=global_dbs as named args,
            # our generated functions will pick them up.
            # Standard mocks defined in tools/transpile_and_test.py are lambdas like lambda x: x.
            # These lambdas will choke on extra keyword arguments.
            # So we SHOULD NOT pass context/global_dbs to standard functions.

            # List of standard SCL functions to exclude from context propagation
            std_funcs = {
                'ABS', 'ACOS', 'ASIN', 'ATAN', 'COS', 'EXP', 'LN', 'LOG', 'SIN', 'SQRT', 'TAN',
                'MOD', 'EXPT', 'MOVE', 'LEN', 'LEFT', 'RIGHT', 'MID', 'CONCAT', 'INSERT', 'DELETE', 'REPLACE', 'FIND',
                'EQ_STRING', 'GE_STRING', 'GT_STRING', 'LE_STRING', 'LT_STRING', 'NE_STRING',
                'LIMIT', 'MAX', 'MIN', 'MUX', 'SEL',
                'AND', 'OR', 'XOR', 'NOT',
                'INT_TO_DINT', 'DINT_TO_INT', 'REAL_TO_INT', 'INT_TO_REAL', 'DINT_TO_REAL', 'REAL_TO_DINT',
                'TIME_TO_DINT', 'DINT_TO_TIME', 'DATE_AND_TIME_TO_TIME_OF_DAY', 'TIME_OF_DAY_TO_DINT', 'DINT_TO_TIME_OF_DAY',
                'DATE_TO_DINT', 'DINT_TO_DATE', 'CHAR_TO_INT', 'INT_TO_CHAR', 'STRING_TO_CHAR', 'CHAR_TO_STRING',
                'BOOL_TO_BYTE', 'BYTE_TO_BOOL', 'BYTE_TO_INT', 'INT_TO_BYTE', 'WORD_TO_INT', 'INT_TO_WORD',
                'DWORD_TO_DINT', 'DINT_TO_DWORD', 'REAL_TO_DWORD', 'DWORD_TO_REAL', 'REAL_TO_UDINT',
                'S_CONV', 'CONVERT', 'ROUND', 'TRUNC', 'FLOOR', 'CEIL',
                'SWAP', 'ROL', 'ROR', 'SHL', 'SHR',
                'SCALE_X', 'NORM_X',
                'UDINT_TO_INT', 'UDINT_TO_DINT', 'LREAL_TO_INT', 'LREAL_TO_DINT', 'LREAL_TO_REAL',
                'UINT_TO_INT', 'INT_TO_UINT', 'SINT_TO_INT', 'INT_TO_SINT',
                'WSTRING_TO_STRING', 'STRING_TO_WSTRING', 'CONCAT_STRING', 'CONCAT_WSTRING',
                'TypeOf', 'MOVE_BLK_VARIANT', 'Strg_TO_Chars', 'Chars_TO_Strg', 'SCATTER', 'GATHER',
                'PEEK', 'POKE', 'PEEK_BOOL', 'POKE_BOOL',
                'CountOfElements', 'Int___CountOfElements', 'INT_TO_STRING', 'LEFT_STRING', 'RIGHT_STRING',
                'RUNTIME', 'UINT_TO_INT', 'RD_SYS_T', 'DINT_TO_DWORD', 'SHR_BYTE', 'DINT_TO_WSTRING', 'WCHAR_TO_DINT', 'CHAR_TO_BYTE'
            }

            if func_name.upper() not in {f.upper() for f in std_funcs}:
                # Assume internal function, append context args
                args.append("context=context")
                args.append("global_dbs=global_dbs")

            return f"{func_name}({', '.join(args)})"
        else:
            # Indirect call or member call
            func = self.visit(node.expr)
            args = [self.visit(arg) for arg in node.args]
            # Indirect calls usually don't need context injection unless we know what they are.
            # If it's a FB call `inst(IN:=...)`, in SCL it's `inst(...)`.
            # In Python `context['inst'](...)`.
            # `inst` is likely a RecursiveMock or a generated class instance.
            # If generated class, it might need context.
            # But usually FBs maintain their own state.
            # Let's assume for now we don't inject context into member calls to avoid breaking objects.
            return f"{func}({', '.join(args)})"

    def visit_NamedArg(self, node):
        val = self.visit(node.expr)
        name = self.sanitize_name(node.name)
        return f"{name}={val}"
