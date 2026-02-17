from src.python_poc.parser import *

class Transpiler:
    def __init__(self):
        self.indent_level = 0
        self.generated_code = ""

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
        code = "import math\n\n"
        for func in node.functions:
            code += self.visit(func) + "\n\n"
        return code

    def visit_Function(self, node):
        # We generate a function that takes 'context' and 'global_dbs'
        # context will hold all INPUT, OUTPUT, IN_OUT, TEMP variables.
        func_name = node.name.replace('"', '').replace('.', '_').replace('[', '_').replace(']', '_').replace(' ', '_').replace('{', '_').replace('}', '_')

        code = f"def {func_name}(context, global_dbs):\n"
        self.indent_level += 1

        # Initialize TEMP variables if needed, or rely on them being in context?
        # Typically TEMP are undefined at start.
        # We can document declared variables in comments
        code += f"{self.indent()}# Return Type: {node.return_type}\n"
        for decl in node.var_decls:
            code += f"{self.indent()}# {decl.section_type}:\n"
            for name, type_spec, init_val in decl.vars:
                code += f"{self.indent()}#   {name}: {type_spec}\n"
                if init_val:
                    val_code = self.visit(init_val)
                    # Initialize variable in context
                    # If it's a CONSTANT, we treat it as context variable initialized once
                    code += f"{self.indent()}context['{name}'] = {val_code}\n"

        code += self.visit(node.block)

        self.indent_level -= 1
        return code

    def visit_Block(self, node):
        code = ""
        for stmt in node.statements:
            stmt_code = self.visit(stmt)
            if stmt_code:
                code += f"{self.indent()}{stmt_code}\n"
        return code

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

        # SCL loops are inclusive TO end. Python range is exclusive.
        # Also need to handle loop variable assignment.
        # Since 'var' maps to context['var'], we need to update it in the loop.

        # We can't use 'for context["i"] in range...' directly in python.
        # So we use a temp python var, and assign it to context var inside loop.
        loop_var = f"_loop_var_{self.indent_level}"

        code = f"for {loop_var} in range(int({start}), int({end}) + 1):\n"
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
        return "return"

    def visit_GotoStmt(self, node):
        # Python has no GOTO. We generate a comment.
        return f"# GOTO {node.target} (Not supported)"

    def visit_LabelStmt(self, node):
        # Label.
        return f"# LABEL {node.name}"

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
        name = node.name.strip('"')
        if node.is_local:
             # #var means local context
             return f"context['{name}']"
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
                return f"context['{name}']"

    def visit_MemberAccess(self, node):
        expr = self.visit(node.expr)
        member = node.member.strip('"')
        # Accessing field of a DB or Struct.
        # Python: expr['member'] or expr.member
        # Since we use dicts for DBs/Structs:
        # If expr is `global_dbs['DB Services']` which is a dict (likely Mock object wrapping dict),
        # we can use attribute access if we implement `__getattr__` or dict access.
        # The SCL uses dots. `expr.member`.
        # If we map everything to objects, `expr.member` is fine.
        # If we map to dicts, `expr['member']`.
        # Let's try to use object-style access in Python for read, but we need it for write too.
        # `expr.member = val`.
        return f"{expr}.{member}"

    def visit_ArrayAccess(self, node):
        expr = self.visit(node.expr)
        index = self.visit(node.index)
        return f"{expr}[int({index})]"

    def visit_Literal(self, node):
        if node.type_name == 'STRING':
            return f"'{node.value}'"
        elif node.type_name == 'BOOL':
            return str(node.value)
        else:
            return str(node.value)

    def visit_Call(self, node):
        if isinstance(node.expr, Variable):
            # Special handling for direct function calls to sanitize name
            func_name = node.expr.name.replace('"', '').replace('.', '_').replace('[', '_').replace(']', '_').replace(' ', '_').replace('{', '_').replace('}', '_')
            args = [self.visit(arg) for arg in node.args]
            return f"{func_name}({', '.join(args)})"
        else:
            # Indirect call or member call
            func = self.visit(node.expr)
            args = [self.visit(arg) for arg in node.args]
            return f"{func}({', '.join(args)})"

    def visit_NamedArg(self, node):
        val = self.visit(node.expr)
        return f"{node.name}={val}"
