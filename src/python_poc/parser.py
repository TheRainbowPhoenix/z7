from src.python_poc.lexer import Lexer, Token

class AST:
    pass

class Program(AST):
    def __init__(self, functions, types=None):
        self.functions = functions
        self.types = types if types else []

    def __repr__(self):
        return f"Program({self.functions}, {self.types})"

class TypeDecl(AST):
    def __init__(self, name, type_spec, version=None):
        self.name = name
        self.type_spec = type_spec
        self.version = version

    def __repr__(self):
        return f"TypeDecl({self.name}, {self.type_spec})"

class StructType(AST):
    def __init__(self, members):
        self.members = members # List of (name, type, init_val)

    def __repr__(self):
        return f"StructType({self.members})"

class Function(AST):
    def __init__(self, name, return_type, var_decls, block, attributes=None, version=None):
        self.name = name
        self.return_type = return_type
        self.var_decls = var_decls
        self.block = block
        self.attributes = attributes
        self.version = version

    def __repr__(self):
        return f"Function({self.name}, {self.return_type}, {self.var_decls}, {self.block})"

class VarDecl(AST):
    def __init__(self, section_type, vars):
        self.section_type = section_type # VAR_INPUT, VAR_OUTPUT, etc.
        self.vars = vars # List of (name, type, init_val) tuples

    def __repr__(self):
        return f"VarDecl({self.section_type}, {self.vars})"

class Block(AST):
    def __init__(self, statements):
        self.statements = statements

    def __repr__(self):
        return f"Block({self.statements})"

class Assignment(AST):
    def __init__(self, left, right):
        self.left = left
        self.right = right

    def __repr__(self):
        return f"Assignment({self.left}, {self.right})"

class IfStmt(AST):
    def __init__(self, condition, then_block, else_block=None):
        self.condition = condition
        self.then_block = then_block
        self.else_block = else_block

    def __repr__(self):
        return f"IfStmt({self.condition}, {self.then_block}, {self.else_block})"

class CaseStmt(AST):
    def __init__(self, expr, cases, else_block=None):
        self.expr = expr
        self.cases = cases # List of (labels, statement_list)
        self.else_block = else_block

    def __repr__(self):
        return f"CaseStmt({self.expr}, {self.cases}, {self.else_block})"

class ForStmt(AST):
    def __init__(self, variable, start, end, step, block):
        self.variable = variable
        self.start = start
        self.end = end
        self.step = step
        self.block = block

    def __repr__(self):
        return f"ForStmt({self.variable}, {self.start}..{self.end}, step={self.step}, {self.block})"

class WhileStmt(AST):
    def __init__(self, condition, block):
        self.condition = condition
        self.block = block

    def __repr__(self):
        return f"WhileStmt({self.condition}, {self.block})"

class Region(AST):
    def __init__(self, statements):
        self.statements = statements

    def __repr__(self):
        return f"Region({self.statements})"

class ExitStmt(AST):
    def __repr__(self):
        return "ExitStmt()"

class ReturnStmt(AST):
    def __repr__(self):
        return "ReturnStmt()"

class GotoStmt(AST):
    def __init__(self, target):
        self.target = target
    def __repr__(self):
        return f"GotoStmt({self.target})"

class LabelStmt(AST):
    def __init__(self, name):
        self.name = name
    def __repr__(self):
        return f"LabelStmt({self.name})"

class BinOp(AST):
    def __init__(self, left, op, right):
        self.left = left
        self.op = op
        self.right = right

    def __repr__(self):
        return f"BinOp({self.left}, {self.op.value}, {self.right})"

class UnaryOp(AST):
    def __init__(self, op, expr):
        self.op = op
        self.expr = expr

    def __repr__(self):
        return f"UnaryOp({self.op.value}, {self.expr})"

class Variable(AST):
    def __init__(self, name, is_local=False):
        self.name = name
        self.is_local = is_local # True if prefixed with #

    def __repr__(self):
        return f"Variable({self.name}, local={self.is_local})"

class MemberAccess(AST):
    def __init__(self, expr, member):
        self.expr = expr
        self.member = member

    def __repr__(self):
        return f"MemberAccess({self.expr}, {self.member})"

class ArrayAccess(AST):
    def __init__(self, expr, index):
        self.expr = expr
        self.index = index

    def __repr__(self):
        return f"ArrayAccess({self.expr}, {self.index})"

class Literal(AST):
    def __init__(self, value, type_name):
        self.value = value
        self.type_name = type_name

    def __repr__(self):
        return f"Literal({self.value}, {self.type_name})"

class Call(AST):
    def __init__(self, expr, args):
        self.expr = expr
        self.args = args

    def __repr__(self):
        return f"Call({self.expr}, {self.args})"

class NamedArg(AST):
    def __init__(self, name, expr):
        self.name = name
        self.expr = expr

    def __repr__(self):
        return f"NamedArg({self.name}, {self.expr})"

class Parser:
    def __init__(self, lexer):
        self.lexer = lexer
        self.token_buffer = []
        self.current_token = self.lexer.get_next_token()

    def peek(self, n=1):
        # print(f"DEBUG: peek({n})")
        while len(self.token_buffer) < n:
            tok = self.lexer.get_next_token()
            # print(f"DEBUG: peek read {tok}")
            self.token_buffer.append(tok)
        return self.token_buffer[n-1]

    def error(self, msg):
        raise Exception(f"Parser error at line {self.current_token.line}, column {self.current_token.column}: {msg}. Got {self.current_token}")

    def eat(self, token_type):
        if self.current_token.type == token_type:
            self.advance()
        else:
            print(f"DEBUG: eat failed. expected={token_type}, got={self.current_token}. current_token_id={id(self.current_token)}")
            self.error(f"Expected token {token_type}, got {self.current_token.type}")

    def advance(self):
        if self.token_buffer:
            self.current_token = self.token_buffer.pop(0)
        else:
            self.current_token = self.lexer.get_next_token()

    def program(self):
        functions = []
        types = []
        while self.current_token.type != 'EOF':
            if self.current_token.type == 'KEYWORD':
                if self.current_token.value.upper() in ['FUNCTION', 'FUNCTION_BLOCK']:
                    functions.append(self.function())
                elif self.current_token.value.upper() == 'TYPE':
                    types.append(self.type_decl_block())
                else:
                    self.error(f"Expected FUNCTION, FUNCTION_BLOCK or TYPE, got {self.current_token.value}")
            else:
                # Skip unknown top level stuff or error
                self.error("Expected FUNCTION, FUNCTION_BLOCK or TYPE")
        return Program(functions, types)

    def type_decl_block(self):
        self.eat('KEYWORD') # TYPE

        name = self.current_token.value
        # Name can be string or identifier
        if self.current_token.type == 'STRING':
            self.eat('STRING')
        else:
            self.eat('IDENTIFIER')

        # Attributes/Version skipping
        version = self.skip_header_attributes()

        type_node = self.type_spec()

        self.eat('SEMI') # SCL syntax: STRUCT ... END_STRUCT;

        self.eat('KEYWORD') # END_TYPE

        return TypeDecl(name, type_node, version)

    def function(self):
        self.eat('KEYWORD') # FUNCTION or FUNCTION_BLOCK
        name = self.current_token.value
        if self.current_token.type == 'STRING':
             self.eat('STRING')
        else:
             self.eat('IDENTIFIER')

        # Function Blocks might not have return type directly, or it is the block name?
        # SCL: FUNCTION_BLOCK "Name"
        #      ...
        # FUNCTION "Name" : Type

        return_type = "Void"
        if self.current_token.type == 'COLON':
            self.eat('COLON')
            return_type = self.current_token.value
            # Return type can be keyword (VOID) or identifier
            if self.current_token.type == 'KEYWORD':
                 self.eat('KEYWORD')
            else:
                 self.eat('IDENTIFIER')

        attributes = None
        if self.current_token.type == 'LBRACE':
            attributes = self.attributes()

        # Skip optional header attributes (TITLE, AUTHOR, FAMILY, VERSION)
        version = self.skip_header_attributes()

        var_decls = []
        while self.current_token.type == 'KEYWORD' and self.current_token.value.upper().startswith('VAR'):
            var_decls.append(self.var_decl())

        self.eat('KEYWORD') # BEGIN
        statements = self.statement_list()

        if self.current_token.type == 'KEYWORD' and self.current_token.value.upper() in ['END_FUNCTION', 'END_FUNCTION_BLOCK']:
            self.eat('KEYWORD') # END_FUNCTION or END_FUNCTION_BLOCK
        else:
            self.error("Expected END_FUNCTION or END_FUNCTION_BLOCK")

        return Function(name, return_type, var_decls, Block(statements), attributes, version)

    def attributes(self):
        self.eat('LBRACE')
        # Skip content for now until RBRACE
        while self.current_token.type != 'RBRACE' and self.current_token.type != 'EOF':
            self.advance()
        self.eat('RBRACE')
        return "Attributes"

    def skip_header_attributes(self):
        version = None
        while True:
            # Check if we reached variable section or BEGIN or TYPE body
            if self.current_token.type == 'KEYWORD':
                 if self.current_token.value.upper().startswith('VAR') or \
                    self.current_token.value.upper() == 'BEGIN' or \
                    self.current_token.value.upper() == 'STRUCT':
                     break

            if self.current_token.type == 'EOF':
                break

            # Handle VERSION specifically
            if self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'VERSION':
                self.eat('KEYWORD')
                self.eat('COLON')
                version = self.current_token.value
                self.eat('FLOAT')
                continue

            # Skip attribute
            # NAME : VAL or NAME = VAL
            self.advance() # Name (ID or Keyword)
            if self.current_token.type in ['COLON', 'ASSIGN', 'EQ']:
                self.advance() # Separator
                # Value can be literal or identifier or string
                self.advance() # Value

        return version

    def var_decl(self):
        section_type = self.current_token.value.upper()
        self.eat('KEYWORD')

        # Check for modifier like CONSTANT
        if self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'CONSTANT':
             section_type += ' CONSTANT'
             self.eat('KEYWORD')
        elif self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'DB_SPECIFIC':
             section_type += ' DB_SPECIFIC'
             self.eat('KEYWORD')

        vars = []
        while self.current_token.type != 'KEYWORD' or not self.current_token.value.upper().startswith('END_VAR'):
             # name [AT other] : type [:= value];
             name = self.current_token.value
             self.eat('IDENTIFIER')

             # Handle AT overlay
             if self.current_token.type == 'IDENTIFIER' and self.current_token.value.upper() == 'AT':
                 self.eat('IDENTIFIER') # Eat AT
                 # Eat the overlaid variable name (might be complex?)
                 # Usually just identifier or %M...
                 # We consume IDENTIFIER.
                 self.eat('IDENTIFIER') # Overlaid var

             # Handle attributes { ... }
             if self.current_token.type == 'LBRACE':
                 self.attributes()

             self.eat('COLON')
             type_node = self.type_spec()

             init_val = None
             if self.current_token.type == 'ASSIGN':
                 self.eat('ASSIGN')
                 init_val = self.expr()

             self.eat('SEMI')
             vars.append((name, type_node, init_val))

        self.eat('KEYWORD') # END_VAR
        return VarDecl(section_type, vars)

    def type_spec(self):
        # simple type or array
        if self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'ARRAY':
            self.eat('KEYWORD')
            self.eat('LBRACKET')

            # Check for variable length array [*]
            if self.current_token.type == 'MUL':
                self.eat('MUL')
                self.eat('RBRACKET')
                self.eat('KEYWORD') # OF
                return f"Array[*] of {self.type_spec()}"

            start = self.current_token.value
            self.eat('INTEGER')
            self.eat('RANGE')
            end = self.current_token.value
            self.eat('INTEGER')
            self.eat('RBRACKET')
            self.eat('KEYWORD') # OF
            return f"Array[{start}..{end}] of {self.type_spec()}"
        elif self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'STRUCT':
            self.eat('KEYWORD') # STRUCT

            members = []
            while self.current_token.type != 'KEYWORD' or self.current_token.value.upper() != 'END_STRUCT':
                if self.current_token.type == 'EOF':
                    break

                # Consume member declaration: name : type [:= init];
                name = self.current_token.value
                self.eat('IDENTIFIER') # name

                # Handle attributes { ... }
                if self.current_token.type == 'LBRACE':
                    self.attributes()

                self.eat('COLON')
                m_type = self.type_spec()

                init_val = None
                if self.current_token.type == 'ASSIGN':
                    self.eat('ASSIGN')
                    init_val = self.expr()

                self.eat('SEMI')
                members.append((name, m_type, init_val))

            self.eat('KEYWORD') # END_STRUCT
            return StructType(members)
        else:
            # Base type, potentially followed by length [len]
            val = self.current_token.value
            if self.current_token.type == 'KEYWORD':
                self.eat('KEYWORD')
            elif self.current_token.type == 'STRING':
                # Type name can be a string "Type.Name"
                self.eat('STRING')
                # Remove quotes for internal representation if needed, but parser usually keeps tokens raw
                # val is already the value without quotes if Lexer handles it, but Lexer keeps quotes for STRING.
                # Let's keep quotes to match usage in VAR decls.
            else:
                self.eat('IDENTIFIER')

            if self.current_token.type == 'LBRACKET':
                self.eat('LBRACKET')
                length = self.current_token.value
                self.eat('INTEGER')
                self.eat('RBRACKET')
                val += f"[{length}]"
            return val

    def statement_list(self):
        statements = []
        while self.current_token.type != 'KEYWORD' or self.current_token.value.upper() not in ['END_FUNCTION', 'END_FUNCTION_BLOCK', 'END_IF', 'END_FOR', 'END_WHILE', 'ELSE', 'ELSIF', 'END_CASE', 'END_REGION']:
            if self.current_token.type == 'SEMI':
                self.eat('SEMI')
                continue
            stmt = self.statement()
            statements.append(stmt)
            if self.current_token.type == 'SEMI':
                self.eat('SEMI')
        return statements

    def statement_list_case(self):
        statements = []
        # Loop until next label, ELSE, or END_CASE
        while True:
            # Check for END_CASE or ELSE
            if self.current_token.type == 'KEYWORD' and self.current_token.value.upper() in ['END_CASE', 'ELSE']:
                break

            # Check for Label start: Literal or ID followed by COLON/COMMA/RANGE
            is_label = False
            if self.current_token.type in ['INTEGER', 'FLOAT', 'STRING', 'CHAR']:
                is_label = True
            elif self.current_token.type == 'IDENTIFIER':
                # Peek
                if self.peek(1).type in ['COLON', 'COMMA', 'RANGE']:
                    is_label = True
            elif self.current_token.type == 'HASH':
                # Peek for #ID: or #ID..
                if self.peek(1).type == 'IDENTIFIER':
                    if self.peek(2).type in ['COLON', 'COMMA', 'RANGE']:
                        is_label = True

            if is_label:
                break

            if self.current_token.type == 'SEMI':
                self.eat('SEMI')
                continue

            stmt = self.statement()
            statements.append(stmt)
            if self.current_token.type == 'SEMI':
                self.eat('SEMI')

        return statements

    def case_statement(self):
        self.eat('KEYWORD') # CASE
        expr = self.expr()
        self.eat('KEYWORD') # OF
        cases = []
        else_block = None

        # Loop until END_CASE or ELSE
        while self.current_token.type != 'KEYWORD' or (self.current_token.value.upper() != 'END_CASE' and self.current_token.value.upper() != 'ELSE'):
             # If we see EOF, break
             if self.current_token.type == 'EOF':
                 break

             labels = self.case_labels()
             self.eat('COLON')

             stmt_list = self.statement_list_case()
             cases.append((labels, Block(stmt_list))) # Wrap in Block

        if self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'ELSE':
             self.eat('KEYWORD')
             else_block = Block(self.statement_list()) # until END_CASE

        self.eat('KEYWORD') # END_CASE
        return CaseStmt(expr, cases, else_block)

    def case_labels(self):
        labels = []
        labels.append(self.case_label_item())
        while self.current_token.type == 'COMMA':
            self.eat('COMMA')
            labels.append(self.case_label_item())
        return labels

    def case_label_item(self):
        # literal or range or constant ID
        start = self.factor() # factor handles literals and variables
        if self.current_token.type == 'RANGE':
            self.eat('RANGE')
            end = self.factor()
            return (start, end)
        return start

    def region_statement(self):
        region_token = self.current_token
        self.eat('KEYWORD') # REGION

        # Consume name: everything until the line changes
        current_line = region_token.line
        while self.current_token.line == current_line and self.current_token.type != 'EOF':
            self.advance()

        # Now parse statements inside
        stmt_list = self.statement_list()

        if self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'END_REGION':
            self.eat('KEYWORD') # END_REGION
        else:
            self.error("Expected END_REGION")

        return Region(stmt_list)

    def statement(self):
        if self.current_token.type == 'KEYWORD':
            if self.current_token.value.upper() == 'IF':
                return self.if_statement()
            elif self.current_token.value.upper() == 'FOR':
                return self.for_statement()
            elif self.current_token.value.upper() == 'EXIT':
                self.eat('KEYWORD')
                return ExitStmt()
            elif self.current_token.value.upper() == 'RETURN':
                self.eat('KEYWORD')
                return ReturnStmt()
            elif self.current_token.value.upper() == 'CASE':
                return self.case_statement()
            elif self.current_token.value.upper() == 'WHILE':
                return self.while_statement()
            elif self.current_token.value.upper() == 'GOTO':
                self.eat('KEYWORD')
                target = self.current_token.value
                self.eat('IDENTIFIER')
                return GotoStmt(target)
            elif self.current_token.value.upper() == 'REGION':
                return self.region_statement()
            # Add other statements as needed

        # Assignment or Function Call or Label
        left = self.expr()
        if self.current_token.type == 'ASSIGN':
            self.eat('ASSIGN')
            right = self.expr()
            return Assignment(left, right)
        elif self.current_token.type == 'PLUS_ASSIGN':
            self.eat('PLUS_ASSIGN')
            right = self.expr()
            # Synthesize BinOp: left + right
            # We need a Token for PLUS.
            op_token = Token('PLUS', '+', self.current_token.line, self.current_token.column)
            return Assignment(left, BinOp(left, op_token, right))
        elif self.current_token.type == 'MINUS_ASSIGN':
            self.eat('MINUS_ASSIGN')
            right = self.expr()
            op_token = Token('MINUS', '-', self.current_token.line, self.current_token.column)
            return Assignment(left, BinOp(left, op_token, right))
        elif self.current_token.type == 'MUL_ASSIGN':
            self.eat('MUL_ASSIGN')
            right = self.expr()
            op_token = Token('MUL', '*', self.current_token.line, self.current_token.column)
            return Assignment(left, BinOp(left, op_token, right))
        elif self.current_token.type == 'DIV_ASSIGN':
            self.eat('DIV_ASSIGN')
            right = self.expr()
            op_token = Token('DIV', '/', self.current_token.line, self.current_token.column)
            return Assignment(left, BinOp(left, op_token, right))
        elif self.current_token.type == 'COLON':
            if isinstance(left, Variable):
                self.eat('COLON')
                return LabelStmt(left.name)
            else:
                self.error("Invalid label syntax")
        else:
            # Maybe a standalone expression (like function call)?
            return left

    def if_statement(self):
        self.eat('KEYWORD') # IF
        return self.parse_if_body()

    def parse_if_body(self):
        condition = self.expr()
        self.eat('KEYWORD') # THEN
        then_block = Block(self.statement_list())
        else_block = None

        if self.current_token.type == 'KEYWORD':
            if self.current_token.value.upper() == 'ELSIF':
                self.eat('KEYWORD') # ELSIF
                # Treat ELSIF as a nested IF in the ELSE branch
                # We wrap the nested IfStmt in a Block because else_block expects a Block or None (usually)
                # But IfStmt AST expects else_block to be a Block or None.
                # My AST definition: else_block=None.
                # Actually, else_block is usually a Block. But if it's a single IfStmt, we can wrap it in a Block.
                nested_if = self.parse_if_body()
                else_block = Block([nested_if])
            elif self.current_token.value.upper() == 'ELSE':
                self.eat('KEYWORD')
                else_block = Block(self.statement_list())
                self.eat('KEYWORD') # END_IF
            elif self.current_token.value.upper() == 'END_IF':
                self.eat('KEYWORD') # END_IF
            else:
                 self.error(f"Expected ELSE, ELSIF or END_IF, got {self.current_token.value}")

        return IfStmt(condition, then_block, else_block)

    def for_statement(self):
        self.eat('KEYWORD') # FOR
        is_local = False
        if self.current_token.type == 'HASH':
            self.eat('HASH')
            is_local = True
        variable = self.variable(is_local)
        self.eat('ASSIGN')
        start = self.expr()
        self.eat('KEYWORD') # TO
        end = self.expr()

        step = None
        if self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'BY':
            self.eat('KEYWORD') # BY
            step = self.expr()

        self.eat('KEYWORD') # DO
        block = Block(self.statement_list())
        self.eat('KEYWORD') # END_FOR
        return ForStmt(variable, start, end, step, block)

    def while_statement(self):
        self.eat('KEYWORD') # WHILE
        condition = self.expr()
        self.eat('KEYWORD') # DO
        block = Block(self.statement_list())
        self.eat('KEYWORD') # END_WHILE
        return WhileStmt(condition, block)

    def expr(self):
        # Lowest precedence: OR, XOR
        node = self.conjunction()
        while self.current_token.type == 'KEYWORD' and self.current_token.value.upper() in ['OR', 'XOR']:
            token = self.current_token
            self.eat('KEYWORD')
            node = BinOp(left=node, op=token, right=self.conjunction())
        return node

    def conjunction(self):
        # AND
        node = self.comparison()
        while self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'AND':
            token = self.current_token
            self.eat('KEYWORD')
            node = BinOp(left=node, op=token, right=self.comparison())
        return node

    def comparison(self):
        # =, <>, <, >, <=, >=
        node = self.simple_expression()
        while self.current_token.type in ('EQ', 'NE', 'LT', 'LE', 'GT', 'GE'):
            token = self.current_token
            self.eat(token.type)
            node = BinOp(left=node, op=token, right=self.simple_expression())
        return node

    def simple_expression(self):
        # +, -
        node = self.term()
        while self.current_token.type in ('PLUS', 'MINUS'):
            token = self.current_token
            self.eat(token.type)
            node = BinOp(left=node, op=token, right=self.term())
        return node

    def term(self):
        # *, /, MOD
        node = self.factor()

        while self.current_token.type in ('MUL', 'DIV') or (self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'MOD'):
            token = self.current_token
            self.eat(token.type)
            node = BinOp(left=node, op=token, right=self.factor())

        return node

    def factor(self):
        token = self.current_token
        # print(f"DEBUG: factor start. token={token}, current={self.current_token}")
        if token.type == 'PLUS':
            self.eat('PLUS')
            return UnaryOp(token, self.factor())
        elif token.type == 'MINUS':
            self.eat('MINUS')
            return UnaryOp(token, self.factor())
        elif token.type == 'KEYWORD' and token.value.upper() == 'NOT':
            self.eat('KEYWORD')
            return UnaryOp(token, self.factor())
        elif (token.type == 'IDENTIFIER' or token.type == 'KEYWORD') and self.peek().type == 'HASH':
            # Typed literal: TYPE#VALUE
            type_name = token.value
            if token.type == 'KEYWORD':
                self.eat('KEYWORD')
            else:
                self.eat('IDENTIFIER')
            self.eat('HASH')

            # Value can be string, number, time literal, date literal
            val = self.factor()
            if isinstance(val, Literal):
                val.type_name = type_name # Override type
                return val
            if isinstance(val, UnaryOp) and isinstance(val.expr, Literal):
                 return val
            return val
        elif token.type == 'INTEGER':
            # Check for base literal: BASE#VALUE
            if self.peek().type == 'HASH':
                base = token.value
                self.eat('INTEGER')
                self.eat('HASH')
                val_token = self.current_token
                # Value can be INTEGER or IDENTIFIER (for hex)
                val_str = str(val_token.value)
                if val_token.type == 'INTEGER':
                    self.eat('INTEGER')
                elif val_token.type == 'IDENTIFIER':
                    self.eat('IDENTIFIER')
                else:
                    self.error(f"Expected integer or identifier after base#, got {val_token}")

                # Calculate value
                try:
                    int_val = int(val_str, base)
                    return Literal(int_val, 'INTEGER')
                except ValueError:
                    self.error(f"Invalid number {val_str} for base {base}")

            self.eat('INTEGER')
            return Literal(token.value, 'INTEGER')
        elif token.type == 'FLOAT':
            self.eat('FLOAT')
            return Literal(token.value, 'FLOAT')
        elif token.type == 'STRING':
            self.eat('STRING')
            return Literal(token.value, 'STRING')
        elif token.type == 'KEYWORD' and token.value.upper() in ['TRUE', 'FALSE']:
            self.eat('KEYWORD')
            return Literal(token.value.upper() == 'TRUE', 'BOOL')
        elif token.type == 'LPAREN':
            self.eat('LPAREN')
            node = self.expr()
            self.eat('RPAREN')
            return node
        elif token.type == 'HASH':
            # Local variable access #var
            self.eat('HASH')
            return self.variable(is_local=True)
        elif token.type == 'IDENTIFIER' or token.type == 'STRING' or (token.type == 'KEYWORD' and token.value.upper() not in ['IF', 'THEN', 'ELSE', 'END_IF', 'FOR', 'TO', 'DO', 'END_FOR', 'EXIT', 'WHILE', 'END_WHILE', 'CASE', 'END_CASE', 'RETURN']):
            # Variable or Global access
            # Note: STRING token here handles quoted identifiers from lexer which outputs STRING or IDENTIFIER
            return self.variable()
        else:
            # Debugging
            print(f"DEBUG: Unexpected token in factor: {token}. Current: {self.current_token}. Buffer: {self.token_buffer}")
            self.error(f"Unexpected token in factor: {token}")

    def variable(self, is_local=False):
        node = Variable(self.current_token.value, is_local)
        self.eat(self.current_token.type) # Eat identifier or string (if quoted identifier)

        # Handle array access, member access, and function calls
        while self.current_token.type in ('LBRACKET', 'DOT', 'LPAREN'):
            if self.current_token.type == 'LBRACKET':
                self.eat('LBRACKET')
                index = self.expr()
                self.eat('RBRACKET')
                node = ArrayAccess(node, index)
            elif self.current_token.type == 'DOT':
                self.eat('DOT')
                prefix = ""
                if self.current_token.type == 'PERCENT':
                    self.eat('PERCENT')
                    prefix = "%"

                member_name = self.current_token.value
                if self.current_token.type == 'KEYWORD':
                     self.eat('KEYWORD')
                else:
                     self.eat('IDENTIFIER')
                node = MemberAccess(node, prefix + member_name)
            elif self.current_token.type == 'LPAREN':
                self.eat('LPAREN')
                args = []
                if self.current_token.type != 'RPAREN':
                    # Parse first arg
                    arg = self.expr()
                    if self.current_token.type in ['ASSIGN', 'ARROW']:
                        # Named argument
                        if isinstance(arg, Variable):
                             self.eat(self.current_token.type)
                             val = self.expr()
                             args.append(NamedArg(arg.name, val))
                        else:
                             self.error("Invalid named argument syntax")
                    else:
                        args.append(arg)

                    while self.current_token.type == 'COMMA':
                        self.eat('COMMA')
                        arg = self.expr()
                        if self.current_token.type in ['ASSIGN', 'ARROW']:
                            # Named argument
                            if isinstance(arg, Variable):
                                 self.eat(self.current_token.type)
                                 val = self.expr()
                                 args.append(NamedArg(arg.name, val))
                            else:
                                 self.error("Invalid named argument syntax")
                        else:
                            args.append(arg)
                self.eat('RPAREN')
                node = Call(node, args)
        return node
