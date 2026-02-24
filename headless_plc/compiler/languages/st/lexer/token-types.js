export var TokenType;
(function (TokenType) {
    // Literals
    TokenType["NUMBER"] = "NUMBER";
    TokenType["STRING"] = "STRING";
    TokenType["TRUE"] = "TRUE";
    TokenType["FALSE"] = "FALSE";
    // Identifiers and Keywords
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    // Keywords (Rockwell standard)
    TokenType["IF"] = "IF";
    TokenType["THEN"] = "THEN";
    TokenType["ELSE"] = "ELSE";
    TokenType["ELSIF"] = "ELSIF";
    TokenType["END_IF"] = "END_IF";
    TokenType["FOR"] = "FOR";
    TokenType["TO"] = "TO";
    TokenType["BY"] = "BY";
    TokenType["DO"] = "DO";
    TokenType["END_FOR"] = "END_FOR";
    TokenType["WHILE"] = "WHILE";
    TokenType["END_WHILE"] = "END_WHILE";
    TokenType["REPEAT"] = "REPEAT";
    TokenType["UNTIL"] = "UNTIL";
    TokenType["END_REPEAT"] = "END_REPEAT";
    TokenType["CASE"] = "CASE";
    TokenType["OF"] = "OF";
    TokenType["END_CASE"] = "END_CASE";
    TokenType["EXIT"] = "EXIT";
    // Operators
    TokenType["ASSIGN"] = "ASSIGN";
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["MULTIPLY"] = "MULTIPLY";
    TokenType["DIVIDE"] = "DIVIDE";
    TokenType["MOD"] = "MOD";
    // Comparison
    TokenType["EQUAL"] = "EQUAL";
    TokenType["NOT_EQUAL"] = "NOT_EQUAL";
    TokenType["LESS_THAN"] = "LESS_THAN";
    TokenType["GREATER_THAN"] = "GREATER_THAN";
    TokenType["LESS_EQUAL"] = "LESS_EQUAL";
    TokenType["GREATER_EQUAL"] = "GREATER_EQUAL";
    // Logical
    TokenType["AND"] = "AND";
    TokenType["OR"] = "OR";
    TokenType["XOR"] = "XOR";
    TokenType["NOT"] = "NOT";
    // Delimiters
    TokenType["SEMICOLON"] = "SEMICOLON";
    TokenType["COLON"] = "COLON";
    TokenType["COMMA"] = "COMMA";
    TokenType["DOT"] = "DOT";
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["LBRACKET"] = "LBRACKET";
    TokenType["RBRACKET"] = "RBRACKET";
    // Special
    TokenType["EOF"] = "EOF";
    // Comments (for preservation)
    TokenType["COMMENT"] = "COMMENT";
})(TokenType || (TokenType = {}));
export class ParseError extends Error {
    diagnostic;
    constructor(diagnostic) {
        super(diagnostic.message);
        this.diagnostic = diagnostic;
        this.name = 'ParseError';
    }
}
