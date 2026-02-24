import { LDTokenType } from './token-types.js';
const LD_LEX_ERRORS = {
    INVALID_CHARACTER: 'LD-LEX-001',
    INVALID_NUMBER_FORMAT: 'LD-LEX-002',
    UNKNOWN_TOKEN: 'LD-LEX-003',
};
export class LDTokenizer {
    source;
    tokens = [];
    current = 0;
    line = 1;
    column = 1;
    start = 0;
    startLine = 1;
    startColumn = 1;
    rungIndex = 0;
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
        this.addToken(LDTokenType.EOF);
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
                break;
            case '\n':
                break;
            case ';':
                this.addToken(LDTokenType.SEMICOLON);
                this.rungIndex++;
                break;
            case ',':
                this.addToken(LDTokenType.COMMA);
                break;
            case '.':
                this.addToken(LDTokenType.DOT);
                break;
            case ':':
                this.addToken(LDTokenType.COLON);
                break;
            case '(':
                this.addToken(LDTokenType.LPAREN);
                break;
            case ')':
                this.addToken(LDTokenType.RPAREN);
                break;
            case '[':
                this.addToken(LDTokenType.LBRACKET);
                break;
            case ']':
                this.addToken(LDTokenType.RBRACKET);
                break;
            case '?':
                this.addToken(LDTokenType.IDENTIFIER, '?');
                break;
            default:
                if (this.isDigit(c)) {
                    this.number();
                }
                else if (this.isAlpha(c)) {
                    this.identifier();
                }
                else {
                    this.reportLexerError(`Unexpected character '${c}'`);
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
        const type = this.getKeywordType(upperText) || LDTokenType.IDENTIFIER;
        this.addToken(type, text);
    }
    getKeywordType(text) {
        const keywords = {
            XIC: LDTokenType.XIC,
            XIO: LDTokenType.XIO,
            ONS: LDTokenType.ONS,
            OTE: LDTokenType.OTE,
            OTL: LDTokenType.OTL,
            OTU: LDTokenType.OTU,
            TON: LDTokenType.TON,
            TOF: LDTokenType.TOF,
            RTO: LDTokenType.RTO,
            CTU: LDTokenType.CTU,
            CTD: LDTokenType.CTD,
            RES: LDTokenType.RES,
            MOVE: LDTokenType.MOVE,
            ADD: LDTokenType.ADD,
            SUB: LDTokenType.SUB,
            MUL: LDTokenType.MUL,
            DIV: LDTokenType.DIV,
            EQ: LDTokenType.EQ,
            NE: LDTokenType.NE,
            GT: LDTokenType.GT,
            GE: LDTokenType.GE,
            LT: LDTokenType.LT,
            LE: LDTokenType.LE,
            LIMIT: LDTokenType.LIMIT,
        };
        return keywords[text] || null;
    }
    number() {
        while (this.isDigit(this.peek())) {
            this.advance();
        }
        if (this.peek() === '.' && this.isDigit(this.peekNext())) {
            this.advance();
            while (this.isDigit(this.peek())) {
                this.advance();
            }
        }
        if (this.peek().toLowerCase() === 'e') {
            this.advance();
            if (this.peek() === '+' || this.peek() === '-') {
                this.advance();
            }
            while (this.isDigit(this.peek())) {
                this.advance();
            }
        }
        this.addToken(LDTokenType.NUMBER);
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
    reportLexerError(message) {
        this.diagnostics.push({
            severity: 'error',
            message,
            code: LD_LEX_ERRORS.INVALID_CHARACTER,
            source: 'lexer',
            rung: this.rungIndex,
        });
    }
}
