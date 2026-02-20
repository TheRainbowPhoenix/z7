import { TokenType } from './token-types.js';
const ST_LEX_ERRORS = {
    INVALID_CHARACTER: 'ST-LEX-001',
    INVALID_NUMBER_FORMAT: 'ST-LEX-002',
    STRING_NOT_TERMINATED: 'ST-LEX-003',
    COMMENT_NOT_TERMINATED: 'ST-LEX-004',
    UNKNOWN_TOKEN: 'ST-LEX-005',
};
export class Tokenizer {
    source;
    tokens = [];
    current = 0;
    line = 1;
    column = 1;
    start = 0;
    startLine = 1;
    startColumn = 1;
    diagnostics = [];
    constructor(source) {
        this.source = source;
    }
    tokenize() {
        this.diagnostics = [];
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.startLine = this.line;
            this.startColumn = this.column;
            this.scanToken();
        }
        this.start = this.current;
        this.startLine = this.line;
        this.startColumn = this.column;
        this.addToken(TokenType.EOF);
        return this.tokens;
    }
    getDiagnostics() {
        return this.diagnostics;
    }
    scanToken() {
        const c = this.advance();
        switch (c) {
            case ' ':
            case '\r':
            case '\t':
                // Ignore whitespace
                break;
            case '\n':
                // Track line numbers but don't create tokens
                break;
            case ';':
                this.addToken(TokenType.SEMICOLON);
                break;
            case ',':
                this.addToken(TokenType.COMMA);
                break;
            case '.':
                this.addToken(TokenType.DOT);
                break;
            case '(':
                this.handleLeftParen();
                break;
            case ')':
                this.addToken(TokenType.RPAREN);
                break;
            case '[':
                this.addToken(TokenType.LBRACKET);
                break;
            case ']':
                this.addToken(TokenType.RBRACKET);
                break;
            case '+':
                this.addToken(TokenType.PLUS);
                break;
            case '-':
                this.addToken(TokenType.MINUS);
                break;
            case '&':
                this.addToken(TokenType.AND);
                break;
            case '*':
                this.addToken(TokenType.MULTIPLY);
                break;
            case '/':
                this.handleSlash();
                break;
            case ':':
                if (this.match('=')) {
                    this.addToken(TokenType.ASSIGN);
                }
                else {
                    this.addToken(TokenType.COLON);
                }
                break;
            case '<':
                if (this.match('=')) {
                    this.addToken(TokenType.LESS_EQUAL);
                }
                else if (this.match('>')) {
                    this.addToken(TokenType.NOT_EQUAL);
                }
                else {
                    this.addToken(TokenType.LESS_THAN);
                }
                break;
            case '>':
                this.addToken(this.match('=') ? TokenType.GREATER_EQUAL : TokenType.GREATER_THAN);
                break;
            case '=':
                this.addToken(TokenType.EQUAL);
                break;
            case '"':
            case "'":
                this.string(c);
                break;
            default:
                if (this.isDigit(c)) {
                    this.number();
                }
                else if (this.isAlpha(c)) {
                    this.identifier();
                }
                else {
                    // Unknown character - create error token for parser to handle
                    this.addToken(TokenType.IDENTIFIER, c);
                }
                break;
        }
    }
    identifier() {
        while (this.isAlphaNumeric(this.peek())) {
            this.advance();
        }
        const text = this.source.substring(this.start, this.current);
        const upperText = text.toUpperCase();
        // Check for keywords (case-insensitive per Rockwell standard)
        const type = this.getKeywordType(upperText) || TokenType.IDENTIFIER;
        this.addToken(type, text);
    }
    getKeywordType(text) {
        const keywords = {
            IF: TokenType.IF,
            THEN: TokenType.THEN,
            ELSE: TokenType.ELSE,
            ELSIF: TokenType.ELSIF,
            END_IF: TokenType.END_IF,
            FOR: TokenType.FOR,
            TO: TokenType.TO,
            BY: TokenType.BY,
            DO: TokenType.DO,
            END_FOR: TokenType.END_FOR,
            WHILE: TokenType.WHILE,
            END_WHILE: TokenType.END_WHILE,
            REPEAT: TokenType.REPEAT,
            UNTIL: TokenType.UNTIL,
            END_REPEAT: TokenType.END_REPEAT,
            CASE: TokenType.CASE,
            OF: TokenType.OF,
            END_CASE: TokenType.END_CASE,
            EXIT: TokenType.EXIT,
            TRUE: TokenType.TRUE,
            FALSE: TokenType.FALSE,
            AND: TokenType.AND,
            OR: TokenType.OR,
            XOR: TokenType.XOR,
            NOT: TokenType.NOT,
            MOD: TokenType.MOD,
        };
        return keywords[text] || null;
    }
    number() {
        while (this.isDigit(this.peek())) {
            this.advance();
        }
        // Look for a fractional part
        if (this.peek() === '.' && this.isDigit(this.peekNext())) {
            // Consume the "."
            this.advance();
            while (this.isDigit(this.peek())) {
                this.advance();
            }
        }
        // Check for scientific notation
        if (this.peek().toLowerCase() === 'e') {
            this.advance();
            if (this.peek() === '+' || this.peek() === '-') {
                this.advance();
            }
            while (this.isDigit(this.peek())) {
                this.advance();
            }
        }
        this.addToken(TokenType.NUMBER);
    }
    string(quote) {
        const startLine = this.startLine;
        const startColumn = this.startColumn;
        while (this.peek() !== quote && !this.isAtEnd()) {
            if (this.peek() === '\n') {
                this.reportLexerError('Unterminated string literal', startLine, startColumn, this.line, this.column);
                return;
            }
            this.advance();
        }
        if (this.isAtEnd()) {
            this.reportLexerError('Unterminated string literal', startLine, startColumn, this.line, this.column);
            return;
        }
        this.advance(); // closing quote
        const value = this.source.substring(this.start + 1, this.current - 1);
        this.addToken(TokenType.STRING, value);
    }
    singleLineComment() {
        // A comment goes until the end of the line
        while (this.peek() !== '\n' && !this.isAtEnd()) {
            this.advance();
        }
        const commentText = this.source.substring(this.start, this.current);
        this.addToken(TokenType.COMMENT, commentText);
    }
    cStyleBlockComment() {
        const startLine = this.line;
        const startColumn = this.column;
        while (!this.isAtEnd()) {
            if (this.peek() === '*' && this.peekNext() === '/') {
                this.advance();
                this.advance();
                return;
            }
            this.advance();
        }
        this.reportLexerError('Expected closing */', startLine, startColumn, this.line, this.column);
    }
    pascalBlockComment() {
        const startLine = this.line;
        const startColumn = this.column;
        while (!this.isAtEnd()) {
            if (this.peek() === '*' && this.peekNext() === ')') {
                this.advance();
                this.advance();
                return;
            }
            this.advance();
        }
        this.reportLexerError('Expected closing *)', startLine, startColumn, this.line, this.column);
    }
    match(expected) {
        if (this.isAtEnd())
            return false;
        if (this.source[this.current] !== expected)
            return false;
        this.current++;
        this.column++;
        return true;
    }
    peek() {
        if (this.isAtEnd())
            return '\0';
        return this.source[this.current];
    }
    peekNext() {
        if (this.current + 1 >= this.source.length)
            return '\0';
        return this.source[this.current + 1];
    }
    isAlpha(c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
    }
    isDigit(c) {
        return c >= '0' && c <= '9';
    }
    isAlphaNumeric(c) {
        return this.isAlpha(c) || this.isDigit(c);
    }
    isAtEnd() {
        return this.current >= this.source.length;
    }
    advance() {
        const char = this.source[this.current++];
        if (char === '\n') {
            this.line++;
            this.column = 1;
        }
        else {
            this.column++;
        }
        return char;
    }
    addToken(type, value) {
        const text = value ?? this.source.substring(this.start, this.current);
        this.tokens.push({
            type,
            value: text,
            line: this.startLine,
            column: this.startColumn,
            endLine: this.line,
            endColumn: this.column,
        });
    }
    reportLexerError(message, line, column, endLine, endColumn) {
        const code = message.includes('string')
            ? ST_LEX_ERRORS.STRING_NOT_TERMINATED
            : message.includes('closing')
                ? ST_LEX_ERRORS.COMMENT_NOT_TERMINATED
                : ST_LEX_ERRORS.INVALID_CHARACTER;
        this.diagnostics.push({
            severity: 'error',
            message,
            line,
            column,
            endLine,
            endColumn,
            code,
            source: 'lexer',
        });
    }
    handleLeftParen() {
        if (this.peek() === '*') {
            this.pascalBlockComment();
        }
        else {
            this.addToken(TokenType.LPAREN);
        }
    }
    handleSlash() {
        if (this.peek() === '/') {
            this.singleLineComment();
            return;
        }
        if (this.peek() === '*') {
            this.cStyleBlockComment();
            return;
        }
        this.addToken(TokenType.DIVIDE);
    }
}
