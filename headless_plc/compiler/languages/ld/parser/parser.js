import { LDTokenType, LDParseError, } from '../lexer/token-types.js';
const INSTRUCTION_TOKENS = new Set([
    LDTokenType.XIC,
    LDTokenType.XIO,
    LDTokenType.ONS,
    LDTokenType.OTE,
    LDTokenType.OTL,
    LDTokenType.OTU,
    LDTokenType.TON,
    LDTokenType.TOF,
    LDTokenType.RTO,
    LDTokenType.CTU,
    LDTokenType.CTD,
    LDTokenType.RES,
    LDTokenType.MOVE,
    LDTokenType.ADD,
    LDTokenType.SUB,
    LDTokenType.MUL,
    LDTokenType.DIV,
    LDTokenType.EQ,
    LDTokenType.NE,
    LDTokenType.GT,
    LDTokenType.GE,
    LDTokenType.LT,
    LDTokenType.LE,
    LDTokenType.LIMIT,
]);
const TOKEN_TO_INSTRUCTION = {
    [LDTokenType.XIC]: 'XIC',
    [LDTokenType.XIO]: 'XIO',
    [LDTokenType.ONS]: 'ONS',
    [LDTokenType.OTE]: 'OTE',
    [LDTokenType.OTL]: 'OTL',
    [LDTokenType.OTU]: 'OTU',
    [LDTokenType.TON]: 'TON',
    [LDTokenType.TOF]: 'TOF',
    [LDTokenType.RTO]: 'RTO',
    [LDTokenType.CTU]: 'CTU',
    [LDTokenType.CTD]: 'CTD',
    [LDTokenType.RES]: 'RES',
    [LDTokenType.MOVE]: 'MOVE',
    [LDTokenType.ADD]: 'ADD',
    [LDTokenType.SUB]: 'SUB',
    [LDTokenType.MUL]: 'MUL',
    [LDTokenType.DIV]: 'DIV',
    [LDTokenType.EQ]: 'EQ',
    [LDTokenType.NE]: 'NE',
    [LDTokenType.GT]: 'GT',
    [LDTokenType.GE]: 'GE',
    [LDTokenType.LT]: 'LT',
    [LDTokenType.LE]: 'LE',
    [LDTokenType.LIMIT]: 'LIMIT',
};
export class LDParser {
    tokens;
    current = 0;
    errors = [];
    warnings = [];
    rungIndex = 0;
    elementIndex = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    parse() {
        const rungs = [];
        while (!this.isAtEnd()) {
            try {
                const rung = this.parseRung();
                if (rung) {
                    rungs.push(rung);
                }
            }
            catch (error) {
                if (error instanceof LDParseError) {
                    this.errors.push(error.diagnostic);
                    const passedSemicolon = this.synchronize();
                    if (passedSemicolon)
                        this.rungIndex++;
                }
                else {
                    break;
                }
            }
        }
        return {
            ast: {
                type: 'LDProgram',
                rungs,
            },
            errors: this.errors,
            warnings: this.warnings,
        };
    }
    parseRung() {
        if (this.isAtEnd())
            return null;
        this.elementIndex = 0;
        const startToken = this.peek();
        const circuit = this.parseCircuit();
        if (circuit.elements.length === 0) {
            const rung = {
                type: 'LDRung',
                index: this.rungIndex++,
                circuit,
            };
            this.errors.push({
                severity: 'error',
                message: 'Rung is empty',
                code: 'LD-PAR-004',
                source: 'parser',
                rung: rung.index,
            });
            if (!this.match(LDTokenType.SEMICOLON) && !this.isAtEnd()) {
                this.synchronize();
            }
            return rung;
        }
        const rung = {
            type: 'LDRung',
            index: this.rungIndex++,
            circuit,
            location: this.makeLocation(startToken, this.previous()),
        };
        if (!this.isAtEnd() && !this.match(LDTokenType.SEMICOLON)) {
            this.error('Expected semicolon after rung');
        }
        return rung;
    }
    parseCircuit() {
        const elements = [];
        const startToken = this.peek();
        while (!this.isAtEnd() && !this.check(LDTokenType.SEMICOLON) && !this.check(LDTokenType.COMMA) && !this.check(LDTokenType.RBRACKET)) {
            const element = this.parseCircuitElement();
            if (element) {
                elements.push(element);
            }
            else {
                break;
            }
        }
        return {
            type: 'LDCircuit',
            elements,
            location: elements.length > 0 ? this.makeLocation(startToken, this.previous()) : undefined,
        };
    }
    parseCircuitElement() {
        if (this.check(LDTokenType.LBRACKET)) {
            return this.parseBranch();
        }
        if (this.isInstructionToken(this.peek().type)) {
            return this.parseInstruction();
        }
        if (this.check(LDTokenType.IDENTIFIER) && this.checkNext(LDTokenType.LPAREN)) {
            return this.parseUnknownInstruction();
        }
        return null;
    }
    parseUnknownInstruction() {
        const instructionToken = this.advance();
        const elementIndex = this.elementIndex++;
        this.errors.push({
            severity: 'error',
            message: `Unknown instruction '${instructionToken.value}'`,
            code: 'LD-PAR-003',
            source: 'parser',
            rung: this.rungIndex,
            element: elementIndex,
        });
        this.consume(LDTokenType.LPAREN, `Expected '(' after ${instructionToken.value}`);
        const parameters = this.parseParameters();
        const endToken = this.consume(LDTokenType.RPAREN, `Expected ')' after ${instructionToken.value} parameters`);
        return {
            type: 'LDInstruction',
            instructionType: instructionToken.value.toUpperCase(),
            parameters,
            location: this.makeLocation(instructionToken, endToken),
        };
    }
    parseBranch() {
        const startToken = this.consume(LDTokenType.LBRACKET, "Expected '[' to start branch");
        const circuits = [];
        circuits.push(this.parseCircuit());
        while (this.match(LDTokenType.COMMA)) {
            circuits.push(this.parseCircuit());
        }
        const endToken = this.consume(LDTokenType.RBRACKET, "Expected ']' to close branch");
        return {
            type: 'LDBranch',
            circuits,
            location: this.makeLocation(startToken, endToken),
        };
    }
    parseInstruction() {
        const instructionToken = this.advance();
        const instructionType = TOKEN_TO_INSTRUCTION[instructionToken.type];
        this.elementIndex++;
        if (!instructionType) {
            throw new LDParseError({
                severity: 'error',
                message: `Unknown instruction: ${instructionToken.value}`,
                code: 'LD-PAR-001',
                source: 'parser',
                rung: this.rungIndex,
            });
        }
        this.consume(LDTokenType.LPAREN, `Expected '(' after ${instructionType}`);
        const parameters = this.parseParameters();
        const endToken = this.consume(LDTokenType.RPAREN, `Expected ')' after ${instructionType} parameters`);
        return {
            type: 'LDInstruction',
            instructionType,
            parameters,
            location: this.makeLocation(instructionToken, endToken),
        };
    }
    parseParameters() {
        const parameters = [];
        if (this.check(LDTokenType.RPAREN)) {
            return parameters;
        }
        parameters.push(this.parseParameter());
        while (this.match(LDTokenType.COMMA)) {
            parameters.push(this.parseParameter());
        }
        return parameters;
    }
    parseParameter() {
        if (this.check(LDTokenType.NUMBER)) {
            return this.parseNumericLiteral();
        }
        if (this.check(LDTokenType.IDENTIFIER) || this.isInstructionToken(this.peek().type)) {
            return this.parseTagAccess();
        }
        throw new LDParseError({
            severity: 'error',
            message: 'Expected parameter (tag name or number)',
            code: 'LD-PAR-002',
            source: 'parser',
            rung: this.rungIndex,
        });
    }
    parseNumericLiteral() {
        const token = this.consume(LDTokenType.NUMBER, 'Expected number');
        const value = Number(token.value);
        return {
            type: 'LDNumericLiteral',
            value,
            location: this.makeLocation(token, token),
        };
    }
    consumeIdentifierOrKeyword() {
        if (this.check(LDTokenType.IDENTIFIER) || this.isInstructionToken(this.peek().type)) {
            return this.advance();
        }
        throw new LDParseError({
            severity: 'error',
            message: 'Expected tag name',
            code: 'LD-PAR-001',
            source: 'parser',
            rung: this.rungIndex,
        });
    }
    parseTagAccess() {
        const identifierToken = this.consumeIdentifierOrKeyword();
        let result = {
            type: 'LDTagReference',
            name: identifierToken.value,
            location: this.makeLocation(identifierToken, identifierToken),
        };
        while (true) {
            if (this.match(LDTokenType.DOT) || this.match(LDTokenType.COLON)) {
                if (!this.check(LDTokenType.IDENTIFIER) && !this.check(LDTokenType.NUMBER) && !this.isInstructionToken(this.peek().type)) {
                    throw new LDParseError({
                        severity: 'error',
                        message: 'Expected member name after "."',
                        code: 'LD-PAR-001',
                        source: 'parser',
                        rung: this.rungIndex,
                    });
                }
                const memberToken = this.advance();
                result = {
                    type: 'LDMemberAccess',
                    object: result,
                    member: memberToken.value,
                    location: this.makeLocation(identifierToken, memberToken),
                };
            }
            else if (this.match(LDTokenType.LBRACKET)) {
                const index = this.parseParameter();
                const closeBracket = this.consume(LDTokenType.RBRACKET, "Expected ']' after array index");
                result = {
                    type: 'LDIndexedAccess',
                    target: result,
                    index,
                    location: this.makeLocation(identifierToken, closeBracket),
                };
            }
            else {
                break;
            }
        }
        return result;
    }
    isInstructionToken(type) {
        return INSTRUCTION_TOKENS.has(type);
    }
    synchronize() {
        this.advance();
        while (!this.isAtEnd()) {
            if (this.previous().type === LDTokenType.SEMICOLON)
                return true;
            if (this.isInstructionToken(this.peek().type))
                return false;
            if (this.check(LDTokenType.IDENTIFIER) && this.checkNext(LDTokenType.LPAREN))
                return false;
            this.advance();
        }
        return false;
    }
    error(message) {
        const isDuplicate = this.errors.some((existing) => existing.rung === this.rungIndex && existing.message === message);
        if (isDuplicate)
            return;
        this.errors.push({
            severity: 'error',
            message,
            code: 'LD-PAR-001',
            source: 'parser',
            rung: this.rungIndex,
        });
    }
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        return this.peek().type === type;
    }
    checkNext(type) {
        if (this.current + 1 >= this.tokens.length)
            return false;
        return this.tokens[this.current + 1].type === type;
    }
    advance() {
        if (!this.isAtEnd())
            this.current++;
        return this.previous();
    }
    isAtEnd() {
        return this.peek().type === LDTokenType.EOF;
    }
    peek() {
        return this.tokens[this.current];
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        throw new LDParseError({
            severity: 'error',
            message,
            code: 'LD-PAR-001',
            source: 'parser',
            rung: this.rungIndex,
        });
    }
    makeLocation(start, end) {
        return {
            line: start.line,
            column: start.column,
            endLine: end.endLine,
            endColumn: end.endColumn,
        };
    }
}
