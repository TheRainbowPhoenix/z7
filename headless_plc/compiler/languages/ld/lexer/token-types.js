export var LDTokenType;
(function (LDTokenType) {
    LDTokenType["IDENTIFIER"] = "IDENTIFIER";
    LDTokenType["NUMBER"] = "NUMBER";
    LDTokenType["XIC"] = "XIC";
    LDTokenType["XIO"] = "XIO";
    LDTokenType["ONS"] = "ONS";
    LDTokenType["OTE"] = "OTE";
    LDTokenType["OTL"] = "OTL";
    LDTokenType["OTU"] = "OTU";
    LDTokenType["TON"] = "TON";
    LDTokenType["TOF"] = "TOF";
    LDTokenType["RTO"] = "RTO";
    LDTokenType["CTU"] = "CTU";
    LDTokenType["CTD"] = "CTD";
    LDTokenType["RES"] = "RES";
    LDTokenType["MOVE"] = "MOVE";
    LDTokenType["ADD"] = "ADD";
    LDTokenType["SUB"] = "SUB";
    LDTokenType["MUL"] = "MUL";
    LDTokenType["DIV"] = "DIV";
    LDTokenType["EQ"] = "EQ";
    LDTokenType["NE"] = "NE";
    LDTokenType["GT"] = "GT";
    LDTokenType["GE"] = "GE";
    LDTokenType["LT"] = "LT";
    LDTokenType["LE"] = "LE";
    LDTokenType["LIMIT"] = "LIMIT";
    LDTokenType["SEMICOLON"] = "SEMICOLON";
    LDTokenType["COMMA"] = "COMMA";
    LDTokenType["DOT"] = "DOT";
    LDTokenType["COLON"] = "COLON";
    LDTokenType["LPAREN"] = "LPAREN";
    LDTokenType["RPAREN"] = "RPAREN";
    LDTokenType["LBRACKET"] = "LBRACKET";
    LDTokenType["RBRACKET"] = "RBRACKET";
    LDTokenType["EOF"] = "EOF";
})(LDTokenType || (LDTokenType = {}));
export class LDParseError extends Error {
    diagnostic;
    constructor(diagnostic) {
        super(diagnostic.message);
        this.diagnostic = diagnostic;
        this.name = 'LDParseError';
    }
}
