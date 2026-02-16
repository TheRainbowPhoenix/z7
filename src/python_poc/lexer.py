import re

class Token:
    def __init__(self, type, value, line=0, column=0):
        self.type = type
        self.value = value
        self.line = line
        self.column = column

    def __repr__(self):
        return f"Token({self.type}, {repr(self.value)}, line={self.line}, col={self.column})"

class Lexer:
    def __init__(self, text):
        self.text = text
        self.pos = 0
        self.line = 1
        self.column = 1
        self.current_char = self.text[self.pos] if self.pos < len(self.text) else None

    def error(self, msg):
        raise Exception(f"Lexer error at line {self.line}, column {self.column}: {msg}")

    def advance(self):
        if self.current_char == '\n':
            self.line += 1
            self.column = 0

        self.pos += 1
        self.column += 1
        if self.pos < len(self.text):
            self.current_char = self.text[self.pos]
        else:
            self.current_char = None

    def peek(self):
        peek_pos = self.pos + 1
        if peek_pos < len(self.text):
            return self.text[peek_pos]
        else:
            return None

    def skip_whitespace(self):
        while self.current_char is not None and self.current_char.isspace():
            self.advance()

    def skip_comment(self):
        # Handle // comments
        while self.current_char is not None and self.current_char != '\n':
            self.advance()
        self.advance() # Skip the newline

    def number(self):
        result = ''
        while self.current_char is not None and self.current_char.isdigit():
            result += self.current_char
            self.advance()

        # Check if it's a float (contains dot, but NOT double dot)
        if self.current_char == '.' and self.peek() != '.':
            result += '.'
            self.advance()
            while self.current_char is not None and self.current_char.isdigit():
                result += self.current_char
                self.advance()
            return Token('FLOAT', float(result), self.line, self.column)
        else:
            return Token('INTEGER', int(result), self.line, self.column)

    def identifier(self):
        result = ''
        # Handle standard identifiers (starting with letter or _)
        if self.current_char.isalnum() or self.current_char == '_':
            while self.current_char is not None and (self.current_char.isalnum() or self.current_char == '_'):
                result += self.current_char
                self.advance()

        # Check for keywords
        keywords = {
            'FUNCTION', 'END_FUNCTION', 'VAR_INPUT', 'END_VAR', 'VAR_OUTPUT',
            'VAR_IN_OUT', 'VAR_TEMP', 'VAR', 'BEGIN', 'IF', 'THEN', 'END_IF',
            'ELSE', 'ELSIF', 'FOR', 'TO', 'DO', 'END_FOR', 'WHILE', 'END_WHILE',
            'EXIT', 'RETURN', 'TRUE', 'FALSE', 'NOT', 'AND', 'OR', 'XOR', 'MOD',
            'VERSION', 'VOID', 'INT', 'DINT', 'REAL', 'BOOL', 'TIME', 'STRING', 'ARRAY', 'OF'
        }

        token_type = 'KEYWORD' if result.upper() in keywords else 'IDENTIFIER'
        return Token(token_type, result, self.line, self.column)

    def quoted_identifier(self):
        # Handle identifiers enclosed in double quotes
        result = ''
        self.advance() # Skip opening quote
        while self.current_char is not None and self.current_char != '"':
            result += self.current_char
            self.advance()

        if self.current_char == '"':
            self.advance() # Skip closing quote
            return Token('IDENTIFIER', result, self.line, self.column)
        else:
            self.error("Unterminated quoted identifier")

    def string_literal(self):
        # Handle single quoted strings
        result = ''
        self.advance() # Skip opening quote
        while self.current_char is not None and self.current_char != "'":
            result += self.current_char
            self.advance()

        if self.current_char == "'":
            self.advance() # Skip closing quote
            return Token('STRING', result, self.line, self.column)
        else:
            self.error("Unterminated string literal")

    def get_next_token(self):
        while self.current_char is not None:
            if self.current_char.isspace():
                self.skip_whitespace()
                continue

            if self.current_char == '/' and self.peek() == '/':
                self.skip_comment()
                continue

            if self.current_char.isalpha() or self.current_char == '_':
                return self.identifier()

            if self.current_char.isdigit():
                return self.number()

            if self.current_char == '"':
                return self.quoted_identifier()

            if self.current_char == "'":
                return self.string_literal()

            if self.current_char == ':' and self.peek() == '=':
                self.advance()
                self.advance()
                return Token('ASSIGN', ':=', self.line, self.column)

            if self.current_char == '.' and self.peek() == '.':
                self.advance()
                self.advance()
                return Token('RANGE', '..', self.line, self.column)

            # Single char tokens
            single_char_tokens = {
                '+': 'PLUS', '-': 'MINUS', '*': 'MUL', '/': 'DIV',
                '(': 'LPAREN', ')': 'RPAREN', '[': 'LBRACKET', ']': 'RBRACKET',
                ';': 'SEMI', ':': 'COLON', ',': 'COMMA', '.': 'DOT',
                '=': 'EQ', '<': 'LT', '>': 'GT', '#': 'HASH', '{': 'LBRACE', '}': 'RBRACE'
            }

            if self.current_char in single_char_tokens:
                token = Token(single_char_tokens[self.current_char], self.current_char, self.line, self.column)
                self.advance()
                return token

            self.error(f"Unexpected character: {self.current_char}")

        return Token('EOF', None, self.line, self.column)
