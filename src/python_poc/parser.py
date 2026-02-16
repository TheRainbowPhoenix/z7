from src.python_poc.lexer import Lexer, Token

class AST:
    pass

class Program(AST):
    def __init__(self, functions):
        self.functions = functions

    def __repr__(self):
        return f"Program({self.functions})"

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
        self.vars = vars # List of (name, type) tuples

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

class ForStmt(AST):
    def __init__(self, variable, start, end, block):
        self.variable = variable
        self.start = start
        self.end = end
        self.block = block

    def __repr__(self):
        return f"ForStmt({self.variable}, {self.start}..{self.end}, {self.block})"

class ExitStmt(AST):
    def __repr__(self):
        return "ExitStmt()"

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

class FunctionCall(AST):
    def __init__(self, name, args):
        self.name = name
        self.args = args

    def __repr__(self):
        return f"FunctionCall({self.name}, {self.args})"

class Parser:
    def __init__(self, lexer):
        self.lexer = lexer
        self.current_token = self.lexer.get_next_token()

    def error(self, msg):
        raise Exception(f"Parser error at line {self.current_token.line}, column {self.current_token.column}: {msg}. Got {self.current_token}")

    def eat(self, token_type):
        if self.current_token.type == token_type:
            self.current_token = self.lexer.get_next_token()
        else:
            self.error(f"Expected token {token_type}, got {self.current_token.type}")

    def program(self):
        functions = []
        while self.current_token.type != 'EOF':
            if self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'FUNCTION':
                functions.append(self.function())
            else:
                # Skip unknown top level stuff or error
                self.error("Expected FUNCTION")
        return Program(functions)

    def function(self):
        self.eat('KEYWORD') # FUNCTION
        name = self.current_token.value
        self.eat('IDENTIFIER')
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

        version = None
        if self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'VERSION':
             version = self.version()

        var_decls = []
        while self.current_token.type == 'KEYWORD' and self.current_token.value.upper().startswith('VAR'):
            var_decls.append(self.var_decl())

        self.eat('KEYWORD') # BEGIN
        statements = self.statement_list()
        self.eat('KEYWORD') # END_FUNCTION

        return Function(name, return_type, var_decls, Block(statements), attributes, version)

    def attributes(self):
        self.eat('LBRACE')
        # Skip content for now until RBRACE
        while self.current_token.type != 'RBRACE' and self.current_token.type != 'EOF':
            self.current_token = self.lexer.get_next_token()
        self.eat('RBRACE')
        return "Attributes"

    def version(self):
        self.eat('KEYWORD') # VERSION
        self.eat('COLON')
        val = self.current_token.value
        self.eat('FLOAT')
        return val

    def var_decl(self):
        section_type = self.current_token.value.upper()
        self.eat('KEYWORD')
        vars = []
        while self.current_token.type != 'KEYWORD' or not self.current_token.value.upper().startswith('END_VAR'):
             # name : type;
             name = self.current_token.value
             self.eat('IDENTIFIER')
             self.eat('COLON')
             type_node = self.type_spec()
             self.eat('SEMI')
             vars.append((name, type_node))

        self.eat('KEYWORD') # END_VAR
        return VarDecl(section_type, vars)

    def type_spec(self):
        # simple type or array
        if self.current_token.type == 'KEYWORD' and self.current_token.value.upper() == 'ARRAY':
            self.eat('KEYWORD')
            self.eat('LBRACKET')
            start = self.current_token.value
            self.eat('INTEGER')
            self.eat('RANGE')
            end = self.current_token.value
            self.eat('INTEGER')
            self.eat('RBRACKET')
            self.eat('KEYWORD') # OF
            elem_type = self.current_token.value
            if self.current_token.type == 'KEYWORD':
                self.eat('KEYWORD')
            else:
                self.eat('IDENTIFIER')
            return f"Array[{start}..{end}] of {elem_type}"
        else:
            val = self.current_token.value
            if self.current_token.type == 'KEYWORD':
                self.eat('KEYWORD')
            else:
                self.eat('IDENTIFIER')
            return val

    def statement_list(self):
        statements = []
        while self.current_token.type != 'KEYWORD' or self.current_token.value.upper() not in ['END_FUNCTION', 'END_IF', 'END_FOR', 'END_WHILE', 'ELSE', 'ELSIF']:
            if self.current_token.type == 'SEMI':
                self.eat('SEMI')
                continue
            stmt = self.statement()
            statements.append(stmt)
            if self.current_token.type == 'SEMI':
                self.eat('SEMI')
        return statements

    def statement(self):
        if self.current_token.type == 'KEYWORD':
            if self.current_token.value.upper() == 'IF':
                return self.if_statement()
            elif self.current_token.value.upper() == 'FOR':
                return self.for_statement()
            elif self.current_token.value.upper() == 'EXIT':
                self.eat('KEYWORD')
                return ExitStmt()
            # Add other statements as needed

        # Assignment or Function Call
        left = self.expr()
        if self.current_token.type == 'ASSIGN':
            self.eat('ASSIGN')
            right = self.expr()
            return Assignment(left, right)
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
        self.eat('KEYWORD') # DO
        block = Block(self.statement_list())
        self.eat('KEYWORD') # END_FOR
        return ForStmt(variable, start, end, block)

    def expr(self):
        node = self.term()

        while self.current_token.type in ('PLUS', 'MINUS', 'EQ', 'LT', 'GT'):
            token = self.current_token
            self.eat(token.type)
            node = BinOp(left=node, op=token, right=self.term())

        return node

    def term(self):
        node = self.factor()

        while self.current_token.type in ('MUL', 'DIV'):
            token = self.current_token
            self.eat(token.type)
            node = BinOp(left=node, op=token, right=self.factor())

        return node

    def factor(self):
        token = self.current_token
        if token.type == 'PLUS':
            self.eat('PLUS')
            return UnaryOp(token, self.factor())
        elif token.type == 'MINUS':
            self.eat('MINUS')
            return UnaryOp(token, self.factor())
        elif token.type == 'INTEGER':
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
        elif token.type == 'IDENTIFIER' or token.type == 'STRING' or (token.type == 'KEYWORD' and token.value.upper() not in ['IF', 'THEN', 'ELSE', 'END_IF', 'FOR', 'TO', 'DO', 'END_FOR', 'EXIT']):
            # Variable or Global access
            # Note: STRING token here handles quoted identifiers from lexer which outputs STRING or IDENTIFIER
            return self.variable()
        else:
            self.error(f"Unexpected token in factor: {token}")

    def variable(self, is_local=False):
        node = Variable(self.current_token.value, is_local)
        self.eat(self.current_token.type) # Eat identifier or string (if quoted identifier)

        # Handle function call
        if self.current_token.type == 'LPAREN':
            self.eat('LPAREN')
            args = []
            if self.current_token.type != 'RPAREN':
                args.append(self.expr())
                while self.current_token.type == 'COMMA':
                    self.eat('COMMA')
                    args.append(self.expr())
            self.eat('RPAREN')
            # Convert Variable node to FunctionCall node
            # We assume the variable name is the function name
            node = FunctionCall(node.name, args)

        # Handle array access [idx] and member access .field
        while self.current_token.type in ('LBRACKET', 'DOT'):
            if self.current_token.type == 'LBRACKET':
                self.eat('LBRACKET')
                index = self.expr()
                self.eat('RBRACKET')
                node = ArrayAccess(node, index)
            elif self.current_token.type == 'DOT':
                self.eat('DOT')
                member_name = self.current_token.value
                self.eat('IDENTIFIER') # or keyword acting as identifier
                node = MemberAccess(node, member_name)
        return node
