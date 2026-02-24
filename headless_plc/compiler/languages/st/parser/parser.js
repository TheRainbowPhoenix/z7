import { TokenType, ParseError } from '../lexer/token-types.js';

/**
 * Recursive descent parser for Structured Text (ST).
 * Converts a list of tokens into an Abstract Syntax Tree (AST).
 */
export class STParser {
    tokens;
    current = 0;
    errors = [];
    warnings = [];

    /**
     * @param {import('../lexer/token-types.js').Token[]} tokens - The list of tokens to parse.
     */
    constructor(tokens) {
        this.tokens = tokens;
    }

    /**
     * Parses the tokens and returns the AST and any diagnostics.
     * @returns {{ast: Object, errors: any[], warnings: any[]}} The parsing result containing the AST, errors, and warnings.
     */
    parse() {
        const statements = [];
        while (!this.isAtEnd()) {
            try {
                const stmt = this.parseStatement();
                if (stmt) {
                    statements.push(stmt);
                }
            }
            catch (error) {
                if (error instanceof ParseError) {
                    this.errors.push(error.diagnostic);
                    this.synchronize();
                }
                else {
                    break;
                }
            }
        }
        return {
            ast: {
                type: 'Program',
                body: statements,
            },
            errors: this.errors,
            warnings: this.warnings,
        };
    }
    parseStatement() {
        this.skipComments();
        if (this.isAtEnd())
            return null;
        if (this.check(TokenType.IF))
            return this.parseIfStatement();
        if (this.check(TokenType.FOR))
            return this.parseForStatement();
        if (this.check(TokenType.WHILE))
            return this.parseWhileStatement();
        if (this.check(TokenType.REPEAT))
            return this.parseRepeatStatement();
        if (this.check(TokenType.CASE))
            return this.parseCaseStatement();
        if (this.check(TokenType.EXIT))
            return this.parseExitStatement();
        return this.parseAssignmentOrExpression();
    }
    parseIfStatement() {
        const ifToken = this.consume(TokenType.IF, "Expected 'IF'");
        const condition = this.parseExpression();
        this.recoverAssignInCondition();
        this.consumeWithRecovery(TokenType.THEN, {
            message: "Missing 'THEN' after IF condition",
            reference: this.previous(),
        });
        const thenStatements = this.parseStatementList(TokenType.ELSE, TokenType.ELSIF, TokenType.END_IF);
        const elsifBranches = [];
        while (this.match(TokenType.ELSIF)) {
            const elsifToken = this.previous();
            const elsifCondition = this.parseExpression();
            const elsifThen = this.consumeWithRecovery(TokenType.THEN, {
                message: "Missing 'THEN' after ELSIF condition",
                reference: this.previous(),
            });
            const elsifStatements = this.parseStatementList(TokenType.ELSE, TokenType.ELSIF, TokenType.END_IF);
            elsifBranches.push({
                type: 'ElsifBranch',
                condition: elsifCondition,
                statements: elsifStatements,
                location: this.makeLocation(elsifToken, elsifThen.synthetic ? this.previous() : elsifThen),
            });
        }
        let elseStatements = null;
        if (this.match(TokenType.ELSE)) {
            elseStatements = this.parseStatementList(TokenType.END_IF);
        }
        const endIfToken = this.consumeWithRecovery(TokenType.END_IF, {
            message: "Missing 'END_IF' to close IF statement",
            reference: this.previous(),
        });
        if (!endIfToken.synthetic && !this.match(TokenType.SEMICOLON)) {
            this.error('Missing semicolon after END_IF', endIfToken, {
                quickFix: {
                    message: 'Add semicolon',
                    range: {
                        line: endIfToken.endLine,
                        column: endIfToken.endColumn,
                        endLine: endIfToken.endLine,
                        endColumn: endIfToken.endColumn + 1,
                    },
                    text: ';',
                },
            });
        }
        return {
            type: 'IfStatement',
            condition,
            thenStatements,
            elsifBranches,
            elseStatements,
            location: this.makeLocation(ifToken, endIfToken),
        };
    }
    parseForStatement() {
        const forToken = this.consume(TokenType.FOR, "Expected 'FOR'");
        const counterTarget = this.parseRequiredAssignmentTarget('Expected counter variable name');
        this.consume(TokenType.ASSIGN, "Expected ':=' after counter variable");
        const start = this.parseExpression();
        this.consume(TokenType.TO, "Expected 'TO' after start value");
        const end = this.parseExpression();
        let step = null;
        if (this.match(TokenType.BY)) {
            step = this.parseExpression();
        }
        this.consume(TokenType.DO, "Expected 'DO' after FOR parameters");
        const body = this.parseStatementList(TokenType.END_FOR);
        const endForToken = this.consume(TokenType.END_FOR, "Missing 'END_FOR' to close FOR loop");
        if (!this.match(TokenType.SEMICOLON)) {
            this.error('Missing semicolon after END_FOR', endForToken);
        }
        return {
            type: 'ForStatement',
            counter: counterTarget.expression,
            start,
            end,
            step,
            body,
            location: this.makeLocation(forToken, this.previous()),
        };
    }
    parseWhileStatement() {
        const whileToken = this.consume(TokenType.WHILE, "Expected 'WHILE'");
        const test = this.parseExpression();
        this.recoverAssignInCondition();
        this.consume(TokenType.DO, "Expected 'DO' after WHILE condition");
        const body = this.parseStatementList(TokenType.END_WHILE);
        const endWhileToken = this.consume(TokenType.END_WHILE, "Missing 'END_WHILE' to close WHILE loop");
        if (!this.match(TokenType.SEMICOLON)) {
            this.error('Missing semicolon after END_WHILE', endWhileToken);
        }
        return {
            type: 'WhileStatement',
            test,
            body,
            location: this.makeLocation(whileToken, this.previous()),
        };
    }
    parseRepeatStatement() {
        const repeatToken = this.consume(TokenType.REPEAT, "Expected 'REPEAT'");
        const body = this.parseStatementList(TokenType.UNTIL);
        this.consume(TokenType.UNTIL, "Expected 'UNTIL' after REPEAT body");
        const test = this.parseExpression();
        this.recoverAssignInCondition();
        const endRepeatToken = this.consume(TokenType.END_REPEAT, "Missing 'END_REPEAT' after UNTIL condition");
        if (!this.match(TokenType.SEMICOLON)) {
            this.error('Missing semicolon after END_REPEAT', endRepeatToken);
        }
        return {
            type: 'RepeatStatement',
            body,
            test,
            location: this.makeLocation(repeatToken, this.previous()),
        };
    }
    parseCaseStatement() {
        const caseToken = this.consume(TokenType.CASE, "Expected 'CASE'");
        const discriminant = this.parseExpression();
        this.consumeWithRecovery(TokenType.OF, {
            message: "Missing 'OF' after CASE expression",
            reference: this.previous(),
        });
        const clauses = [];
        let defaultCase = null;
        while (!this.isAtEnd()) {
            this.skipComments();
            if (this.check(TokenType.END_CASE) || this.check(TokenType.ELSE)) {
                break;
            }
            clauses.push(this.parseCaseClause());
        }
        if (this.match(TokenType.ELSE)) {
            defaultCase = this.parseCaseConsequent();
        }
        const endCaseToken = this.consumeWithRecovery(TokenType.END_CASE, {
            message: "Missing 'END_CASE' to close CASE statement",
            reference: this.previous(),
        });
        if (!endCaseToken.synthetic && !this.match(TokenType.SEMICOLON)) {
            this.error('Missing semicolon after END_CASE', endCaseToken, {
                quickFix: {
                    message: 'Add semicolon',
                    range: {
                        line: endCaseToken.endLine,
                        column: endCaseToken.endColumn,
                        endLine: endCaseToken.endLine,
                        endColumn: endCaseToken.endColumn + 1,
                    },
                    text: ';',
                },
            });
        }
        const locationEnd = endCaseToken.synthetic ? this.previous() : endCaseToken;
        return {
            type: 'CaseStatement',
            discriminant,
            cases: clauses,
            defaultCase,
            location: this.makeLocation(caseToken, locationEnd),
        };
    }
    parseCaseClause() {
        this.skipComments();
        const clauseStartToken = this.peek();
        const selectors = [];
        selectors.push(this.parseCaseSelector());
        this.skipComments();
        while (this.match(TokenType.COMMA)) {
            this.skipComments();
            selectors.push(this.parseCaseSelector());
            this.skipComments();
        }
        const colonToken = this.consumeWithRecovery(TokenType.COLON, {
            message: "Missing ':' after CASE selector",
            reference: this.previous(),
        });
        const consequent = this.parseCaseConsequent();
        const clauseEndAnchor = this.getCaseClauseLocation(consequent, this.makeLocation(clauseStartToken, colonToken));
        return {
            type: 'CaseClause',
            values: selectors.length ? selectors : [this.makeDefaultLiteral(clauseStartToken)],
            consequent,
            location: this.makeLocation(clauseStartToken, clauseEndAnchor),
        };
    }
    makeDefaultLiteral(anchor) {
        return {
            type: 'Literal',
            value: 0,
            dataType: 'DINT',
            location: this.makeLocation(anchor, anchor),
        };
    }
    getCaseClauseLocation(consequent, fallback) {
        if (consequent.length === 0) {
            return fallback;
        }
        const lastStatement = consequent[consequent.length - 1];
        return lastStatement.location ?? fallback;
    }
    parseCaseSelector() {
        this.skipComments();
        const selectorStartToken = this.peek();
        const startLiteral = this.parseCaseSelectorValue();
        this.skipComments();
        if (this.check(TokenType.DOT)) {
            const nextToken = this.peekAhead();
            if (nextToken?.type !== TokenType.DOT) {
                return startLiteral;
            }
            this.advance();
            const secondDot = this.advance();
            this.skipComments();
            const endLiteral = this.parseCaseSelectorValue();
            if (typeof startLiteral.value !== 'number' || typeof endLiteral.value !== 'number') {
                this.error('CASE range bounds must be numeric literals', secondDot);
            }
            const startLocation = startLiteral.location ??
                this.makeLocation(selectorStartToken, selectorStartToken);
            const endLocation = endLiteral.location ?? startLocation;
            return {
                type: 'CaseRange',
                start: startLiteral,
                end: endLiteral,
                location: this.makeLocation(startLocation, endLocation),
            };
        }
        return startLiteral;
    }
    parseCaseSelectorValue() {
        this.skipComments();
        if (this.match(TokenType.MINUS)) {
            const minusToken = this.previous();
            const numberToken = this.consume(TokenType.NUMBER, 'Expected number after minus in CASE selector');
            const raw = numberToken.value;
            const isReal = /[.eE]/.test(raw);
            const value = isReal ? -parseFloat(raw) : -parseInt(raw, 10);
            return {
                type: 'Literal',
                value,
                dataType: isReal ? 'REAL' : 'DINT',
                location: this.makeLocation(minusToken, numberToken),
            };
        }
        if (this.match(TokenType.NUMBER)) {
            const token = this.previous();
            const raw = token.value;
            const isReal = /[.eE]/.test(raw);
            const value = isReal ? parseFloat(raw) : parseInt(raw, 10);
            return {
                type: 'Literal',
                value,
                dataType: isReal ? 'REAL' : 'DINT',
                location: this.makeLocation(token, token),
            };
        }
        if (this.match(TokenType.STRING)) {
            const token = this.previous();
            return {
                type: 'Literal',
                value: token.value,
                dataType: 'STRING',
                location: this.makeLocation(token, token),
            };
        }
        if (this.match(TokenType.TRUE)) {
            const token = this.previous();
            return {
                type: 'Literal',
                value: true,
                dataType: 'BOOL',
                location: this.makeLocation(token, token),
            };
        }
        if (this.match(TokenType.FALSE)) {
            const token = this.previous();
            return {
                type: 'Literal',
                value: false,
                dataType: 'BOOL',
                location: this.makeLocation(token, token),
            };
        }
        const token = this.peek();
        throw new ParseError({
            severity: 'error',
            message: 'Expected CASE selector literal',
            line: token.line,
            column: token.column,
            endLine: token.endLine,
            endColumn: token.endColumn,
            code: 'ST-PAR-001',
            source: 'parser',
        });
    }
    isStartOfCaseSelector() {
        let index = this.current;
        let sawValue = false;
        let expectingValue = true;
        while (index < this.tokens.length) {
            const token = this.tokens[index];
            if (token.type === TokenType.COMMENT) {
                index++;
                continue;
            }
            if (token.type === TokenType.COLON) {
                return sawValue && !expectingValue;
            }
            if (token.type === TokenType.COMMA) {
                if (expectingValue)
                    return false;
                expectingValue = true;
                index++;
                continue;
            }
            if (token.type === TokenType.DOT) {
                const next = this.tokens[index + 1];
                if (!next || next.type !== TokenType.DOT)
                    return false;
                if (expectingValue)
                    return false;
                expectingValue = true;
                index += 2;
                continue;
            }
            if (token.type === TokenType.MINUS) {
                const next = this.tokens[index + 1];
                if (!next || next.type !== TokenType.NUMBER)
                    return false;
                sawValue = true;
                expectingValue = false;
                index += 2;
                continue;
            }
            if (this.isCaseLiteralToken(token.type)) {
                sawValue = true;
                expectingValue = false;
                index++;
                continue;
            }
            return false;
        }
        return false;
    }
    isCaseLiteralToken(type) {
        return (type === TokenType.NUMBER ||
            type === TokenType.STRING ||
            type === TokenType.TRUE ||
            type === TokenType.FALSE);
    }
    parseCaseConsequent() {
        const statements = [];
        while (!this.isAtEnd()) {
            this.skipComments();
            if (this.isAtEnd() ||
                this.check(TokenType.END_CASE) ||
                this.check(TokenType.ELSE) ||
                this.isStartOfCaseSelector()) {
                break;
            }
            const stmt = this.parseStatement();
            if (stmt) {
                statements.push(stmt);
            }
        }
        return statements;
    }
    parseExitStatement() {
        const exitToken = this.consume(TokenType.EXIT, "Expected 'EXIT'");
        if (!this.match(TokenType.SEMICOLON)) {
            this.error('Missing semicolon after EXIT', exitToken);
        }
        return {
            type: 'ReturnStatement',
            location: this.makeLocation(exitToken, this.previous()),
        };
    }
    parseAssignmentOrExpression() {
        const startToken = this.peek();
        const startIndex = this.current;
        const targetInfo = this.tryParseAssignmentTarget();
        if (targetInfo) {
            if (this.match(TokenType.ASSIGN)) {
                return this.finishAssignment(targetInfo);
            }
            if (this.check(TokenType.EQUAL)) {
                this.error("Invalid assignment operator '='. Use ':=' for assignments in Structured Text", this.peek(), {
                    quickFix: {
                        message: "Change '=' to ':='",
                        range: {
                            line: this.peek().line,
                            column: this.peek().column,
                            endLine: this.peek().endLine,
                            endColumn: this.peek().endColumn,
                        },
                        text: ':=',
                    },
                });
                this.advance(); // consume the '=' and continue like assignment
                return this.finishAssignment(targetInfo);
            }
            this.current = startIndex;
        }
        try {
            const expr = this.parseExpression();
            if (!this.match(TokenType.SEMICOLON)) {
                this.error('Missing semicolon after expression', this.previous());
            }
            const exprStmt = {
                type: 'ExpressionStatement',
                expression: expr,
                location: this.makeLocation(startToken, this.previous()),
            };
            return exprStmt;
        }
        catch (error) {
            if (error instanceof ParseError) {
                this.errors.push(error.diagnostic);
                this.synchronize();
                const dummyLiteral = { type: 'Literal', value: 0, dataType: 'DINT' };
                const dummyExpr = {
                    type: 'ExpressionStatement',
                    expression: dummyLiteral,
                    location: this.makeLocation(startToken, this.previous()),
                };
                return dummyExpr;
            }
            throw error;
        }
    }
    finishAssignment(targetInfo) {
        let value;
        try {
            value = this.parseExpression();
        }
        catch (error) {
            if (error instanceof ParseError) {
                this.errors.push(error.diagnostic);
                const dummyLiteral = { type: 'Literal', value: 0, dataType: 'DINT' };
                value = dummyLiteral;
            }
            else {
                throw error;
            }
        }
        if (!this.match(TokenType.SEMICOLON)) {
            this.error('Missing semicolon at end of assignment', this.previous(), {
                quickFix: {
                    message: 'Add semicolon',
                    range: {
                        line: this.previous().endLine,
                        column: this.previous().endColumn,
                        endLine: this.previous().endLine,
                        endColumn: this.previous().endColumn + 1,
                    },
                    text: ';',
                },
            });
        }
        return {
            type: 'AssignmentStatement',
            target: targetInfo.expression,
            value,
            location: this.makeLocation(targetInfo.startToken, this.previous()),
        };
    }
    parseRequiredAssignmentTarget(message) {
        const targetInfo = this.tryParseAssignmentTarget();
        if (targetInfo) {
            return targetInfo;
        }
        const identifierToken = this.consume(TokenType.IDENTIFIER, message);
        const identifierExpr = {
            type: 'Identifier',
            name: identifierToken.value,
            location: this.makeLocation(identifierToken, identifierToken),
        };
        return {
            expression: identifierExpr,
            startToken: identifierToken,
            endToken: identifierToken,
        };
    }
    tryParseAssignmentTarget() {
        if (!this.check(TokenType.IDENTIFIER)) {
            return null;
        }
        const identifierToken = this.advance();
        const identifierExpr = {
            type: 'Identifier',
            name: identifierToken.value,
            location: this.makeLocation(identifierToken, identifierToken),
        };
        let expression = identifierExpr;
        let endToken = identifierToken;
        let seenIndex = false;
        while (true) {
            if (this.check(TokenType.DOT)) {
                this.advance();
                const propertyToken = this.consumeMemberName("Expected member name after '.'");
                const propertyIdentifier = {
                    type: 'Identifier',
                    name: propertyToken.value,
                    location: this.makeLocation(propertyToken, propertyToken),
                };
                const memberExpr = {
                    type: 'MemberExpression',
                    object: expression,
                    property: propertyIdentifier,
                    location: this.makeLocation(expression.location ?? this.makeLocation(identifierToken, identifierToken), propertyToken),
                };
                expression = memberExpr;
                endToken = propertyToken;
                seenIndex = false;
                continue;
            }
            if (this.check(TokenType.LBRACKET)) {
                if (seenIndex) {
                    const bracketToken = this.peek();
                    throw new ParseError({
                        severity: 'error',
                        message: 'Multidimensional array access is not supported',
                        line: bracketToken.line,
                        column: bracketToken.column,
                        endLine: bracketToken.endLine,
                        endColumn: bracketToken.endColumn,
                        code: 'ST-PAR-005',
                        source: 'parser',
                    });
                }
                seenIndex = true;
                this.advance();
                const indexExpr = this.parseExpression();
                const closeBracket = this.consume(TokenType.RBRACKET, "Expected ']' after array index");
                const indexedExpr = {
                    type: 'IndexedAccessExpression',
                    target: expression,
                    index: indexExpr,
                    location: this.makeLocation(expression.location ?? this.makeLocation(identifierToken, identifierToken), closeBracket),
                };
                expression = indexedExpr;
                endToken = closeBracket;
                continue;
            }
            break;
        }
        return {
            expression,
            startToken: identifierToken,
            endToken,
        };
    }
    parseExpression() {
        this.skipComments();
        return this.parseOr();
    }
    parseOr() {
        let expr = this.parseXor();
        while (this.match(TokenType.OR)) {
            this.skipComments();
            const right = this.parseXor();
            const binaryExpr = {
                type: 'BinaryExpression',
                operator: 'OR',
                left: expr,
                right,
                location: this.makeLocation(expr.location, right.location),
            };
            expr = binaryExpr;
        }
        return expr;
    }
    parseXor() {
        let expr = this.parseAnd();
        while (this.match(TokenType.XOR)) {
            this.skipComments();
            const right = this.parseAnd();
            const binaryExpr = {
                type: 'BinaryExpression',
                operator: 'XOR',
                left: expr,
                right,
                location: this.makeLocation(expr.location, right.location),
            };
            expr = binaryExpr;
        }
        return expr;
    }
    parseAnd() {
        let expr = this.parseEquality();
        while (this.match(TokenType.AND)) {
            this.skipComments();
            const right = this.parseEquality();
            const binaryExpr = {
                type: 'BinaryExpression',
                operator: 'AND',
                left: expr,
                right,
                location: this.makeLocation(expr.location, right.location),
            };
            expr = binaryExpr;
        }
        return expr;
    }
    parseEquality() {
        let expr = this.parseComparison();
        while (this.match(TokenType.EQUAL, TokenType.NOT_EQUAL)) {
            const op = this.previous();
            const right = this.parseComparison();
            const binaryExpr = {
                type: 'BinaryExpression',
                operator: op.type === TokenType.EQUAL ? '=' : '<>',
                left: expr,
                right,
                location: this.makeLocation(expr.location, right.location),
            };
            expr = binaryExpr;
        }
        return expr;
    }
    parseComparison() {
        let expr = this.parseTerm();
        while (this.match(TokenType.GREATER_THAN, TokenType.GREATER_EQUAL, TokenType.LESS_THAN, TokenType.LESS_EQUAL)) {
            const op = this.previous();
            const right = this.parseTerm();
            const operatorMap = {
                [TokenType.GREATER_THAN]: '>',
                [TokenType.GREATER_EQUAL]: '>=',
                [TokenType.LESS_THAN]: '<',
                [TokenType.LESS_EQUAL]: '<=',
            };
            const binaryExpr = {
                type: 'BinaryExpression',
                operator: operatorMap[op.type],
                left: expr,
                right,
                location: this.makeLocation(expr.location, right.location),
            };
            expr = binaryExpr;
        }
        return expr;
    }
    parseTerm() {
        let expr = this.parseFactor();
        while (this.match(TokenType.MINUS, TokenType.PLUS)) {
            const op = this.previous();
            const right = this.parseFactor();
            const binaryExpr = {
                type: 'BinaryExpression',
                operator: op.type === TokenType.PLUS ? '+' : '-',
                left: expr,
                right,
                location: this.makeLocation(expr.location, right.location),
            };
            expr = binaryExpr;
        }
        return expr;
    }
    parseFactor() {
        let expr = this.parseUnary();
        while (this.match(TokenType.DIVIDE, TokenType.MULTIPLY, TokenType.MOD)) {
            const op = this.previous();
            const right = this.parseUnary();
            let operator;
            switch (op.type) {
                case TokenType.DIVIDE:
                    operator = '/';
                    break;
                case TokenType.MULTIPLY:
                    operator = '*';
                    break;
                case TokenType.MOD:
                    operator = 'MOD';
                    break;
                default:
                    operator = op.value;
            }
            const binaryExpr = {
                type: 'BinaryExpression',
                operator,
                left: expr,
                right,
                location: this.makeLocation(expr.location, right.location),
            };
            expr = binaryExpr;
        }
        return expr;
    }
    parseUnary() {
        if (this.match(TokenType.NOT, TokenType.MINUS)) {
            const op = this.previous();
            const right = this.parseUnary();
            const unaryExpr = {
                type: 'UnaryExpression',
                operator: op.type === TokenType.NOT ? 'NOT' : '-',
                operand: right,
                location: this.makeLocation(op, right.location),
            };
            return unaryExpr;
        }
        return this.parseCall();
    }
    parseCall() {
        let expr = this.parsePrimary();
        let seenIndex = false;
        while (true) {
            if (this.match(TokenType.LPAREN)) {
                expr = this.finishCall(expr);
            }
            else if (this.match(TokenType.LBRACKET)) {
                if (seenIndex) {
                    const bracketToken = this.previous();
                    throw new ParseError({
                        severity: 'error',
                        message: 'Multidimensional array access is not supported',
                        line: bracketToken.line,
                        column: bracketToken.column,
                        endLine: bracketToken.endLine,
                        endColumn: bracketToken.endColumn,
                        code: 'ST-PAR-005',
                        source: 'parser',
                    });
                }
                seenIndex = true;
                const indexExpr = this.parseExpression();
                const closeBracket = this.consume(TokenType.RBRACKET, "Expected ']' after array index");
                if (expr.type !== 'Identifier' && expr.type !== 'IndexedAccessExpression') {
                    throw new ParseError({
                        severity: 'error',
                        message: 'Array access is only supported on identifiers or array variables',
                        line: closeBracket.line,
                        column: closeBracket.column,
                        endLine: closeBracket.endLine,
                        endColumn: closeBracket.endColumn,
                        code: 'ST-PAR-005',
                        source: 'parser',
                    });
                }
                const location = expr.location
                    ? {
                        line: expr.location.line,
                        column: expr.location.column,
                        endLine: closeBracket.endLine,
                        endColumn: closeBracket.endColumn,
                    }
                    : this.makeLocation(closeBracket, closeBracket);
                const indexedExpr = {
                    type: 'IndexedAccessExpression',
                    target: expr,
                    index: indexExpr,
                    location,
                };
                expr = indexedExpr;
            }
            else if (this.match(TokenType.DOT)) {
                const propertyToken = this.consumeMemberName("Expected member name after '.'");
                const propertyIdentifier = {
                    type: 'Identifier',
                    name: propertyToken.value,
                    location: this.makeLocation(propertyToken, propertyToken),
                };
                if (expr.type !== 'Identifier' &&
                    expr.type !== 'IndexedAccessExpression' &&
                    expr.type !== 'MemberExpression') {
                    throw new ParseError({
                        severity: 'error',
                        message: 'Member access is only supported on identifiers or structured values',
                        line: propertyToken.line,
                        column: propertyToken.column,
                        endLine: propertyToken.endLine,
                        endColumn: propertyToken.endColumn,
                        code: 'ST-PAR-006',
                        source: 'parser',
                    });
                }
                const memberExpr = {
                    type: 'MemberExpression',
                    object: expr,
                    property: propertyIdentifier,
                    location: this.makeLocation(expr.location ?? propertyIdentifier.location, propertyToken),
                };
                expr = memberExpr;
                seenIndex = false;
            }
            else {
                break;
            }
        }
        return expr;
    }
    finishCall(callee) {
        const args = [];
        if (!this.check(TokenType.RPAREN)) {
            do {
                args.push(this.parseExpression());
            } while (this.match(TokenType.COMMA));
        }
        const paren = this.consume(TokenType.RPAREN, "Expected ')' after function arguments");
        const funcCall = {
            type: 'FunctionCall',
            name: callee,
            arguments: args,
            location: this.makeLocation(callee.location, paren),
        };
        return funcCall;
    }
    parsePrimary() {
        this.skipComments();
        if (this.match(TokenType.TRUE)) {
            const literal = {
                type: 'Literal',
                value: true,
                dataType: 'BOOL',
                location: this.makeLocation(this.previous(), this.previous()),
            };
            return literal;
        }
        if (this.match(TokenType.FALSE)) {
            const literal = {
                type: 'Literal',
                value: false,
                dataType: 'BOOL',
                location: this.makeLocation(this.previous(), this.previous()),
            };
            return literal;
        }
        if (this.match(TokenType.NUMBER)) {
            const token = this.previous();
            const value = token.value.includes('.') ? parseFloat(token.value) : parseInt(token.value);
            const literal = {
                type: 'Literal',
                value,
                dataType: token.value.includes('.') ? 'REAL' : 'DINT',
                location: this.makeLocation(token, token),
            };
            return literal;
        }
        if (this.match(TokenType.STRING)) {
            const token = this.previous();
            const literal = {
                type: 'Literal',
                value: token.value,
                dataType: 'STRING',
                location: this.makeLocation(token, token),
            };
            return literal;
        }
        if (this.match(TokenType.IDENTIFIER)) {
            const token = this.previous();
            const identifier = {
                type: 'Identifier',
                name: token.value,
                location: this.makeLocation(token, token),
            };
            return identifier;
        }
        if (this.match(TokenType.LPAREN)) {
            const expr = this.parseExpression();
            this.consume(TokenType.RPAREN, "Expected ')' after expression");
            return expr;
        }
        throw new ParseError({
            severity: 'error',
            message: 'Expected expression',
            line: this.peek().line,
            column: this.peek().column,
            endLine: this.peek().endLine,
            endColumn: this.peek().endColumn,
            code: 'ST-PAR-007',
            source: 'parser',
        });
    }
    skipComments() {
        while (this.match(TokenType.COMMENT)) { /* skip */ }
    }
    parseStatementList(...terminators) {
        const statements = [];
        while (!this.isAtEnd()) {
            this.skipComments();
            if (this.isAtEnd() || this.checkAny(...terminators)) {
                break;
            }
            try {
                const stmt = this.parseStatement();
                if (stmt) {
                    statements.push(stmt);
                }
            }
            catch (error) {
                if (error instanceof ParseError) {
                    this.errors.push(error.diagnostic);
                    this.synchronize();
                }
                else {
                    this.synchronize();
                }
            }
        }
        return statements;
    }
    recoverAssignInCondition() {
        if (!this.check(TokenType.ASSIGN))
            return;
        const assignToken = this.peek();
        this.error("Assignment operator ':=' cannot be used in conditions. Did you mean '=' (comparison)?", assignToken, {
            quickFix: {
                message: "Replace ':=' with '='",
                range: {
                    line: assignToken.line,
                    column: assignToken.column,
                    endLine: assignToken.endLine,
                    endColumn: assignToken.endColumn,
                },
                text: '=',
            },
        });
        this.advance();
        try {
            this.parseExpression();
        }
        catch { /* recovery – ignore parse error */ }
    }
    consumeWithRecovery(type, options) {
        if (this.check(type)) {
            return this.advance();
        }
        const anchor = options.reference ?? this.previous() ?? this.peek();
        this.error(options.message, anchor);
        return this.createSyntheticToken(type, anchor);
    }
    createSyntheticToken(type, anchor) {
        const fallback = anchor ??
            this.previous() ??
            this.peek() ?? {
            type,
            value: '',
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 1,
            synthetic: true,
        };
        return {
            type,
            value: '',
            line: fallback.line ?? 1,
            column: fallback.column ?? 1,
            endLine: fallback.endLine ?? fallback.line ?? 1,
            endColumn: fallback.endColumn ?? fallback.column ?? 1,
            synthetic: true,
        };
    }
    synchronize() {
        this.advance(); // Skip the problematic token
        while (!this.isAtEnd()) {
            if (this.previous().type === TokenType.SEMICOLON)
                return;
            switch (this.peek().type) {
                case TokenType.IF:
                case TokenType.FOR:
                case TokenType.WHILE:
                case TokenType.REPEAT:
                case TokenType.CASE:
                case TokenType.END_IF:
                case TokenType.END_FOR:
                case TokenType.END_WHILE:
                case TokenType.END_REPEAT:
                case TokenType.END_CASE:
                    return;
            }
            this.advance();
        }
    }
    error(message, token, extra) {
        const isDuplicate = this.errors.some((existing) => existing.line === token.line &&
            existing.column === token.column &&
            existing.message === message);
        if (isDuplicate) {
            return;
        }
        const diagnostic = {
            severity: 'error',
            message,
            line: token.line,
            column: token.column,
            endLine: token.endLine,
            endColumn: token.endColumn,
            code: 'ST-PAR-001',
            source: 'parser',
            ...extra,
        };
        this.errors.push(diagnostic);
        if (!this.isRecoverable(message)) {
            throw new ParseError(diagnostic);
        }
    }
    isRecoverable(message) {
        const recoverable = [
            'Missing semicolon',
            'Type mismatch',
            'Expected expression',
            'Invalid assignment operator',
            "cannot be used in conditions",
            "Missing 'THEN'",
            "Missing 'END_IF'",
        ];
        return recoverable.some((pattern) => new RegExp(pattern).test(message));
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
    checkAny(...types) {
        return types.some((type) => this.check(type));
    }
    advance() {
        if (!this.isAtEnd())
            this.current++;
        return this.previous();
    }
    isAtEnd() {
        return this.peek().type === TokenType.EOF;
    }
    peek() {
        return this.tokens[this.current];
    }
    peekAhead(offset = 1) {
        return this.tokens[this.current + offset];
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        throw new ParseError({
            severity: 'error',
            message,
            line: this.peek().line,
            column: this.peek().column,
            endLine: this.peek().endLine,
            endColumn: this.peek().endColumn,
            code: 'ST-PAR-001',
            source: 'parser',
        });
    }
    consumeMemberName(message) {
        if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.NUMBER)) {
            return this.advance();
        }
        throw new ParseError({
            severity: 'error',
            message,
            line: this.peek().line,
            column: this.peek().column,
            endLine: this.peek().endLine,
            endColumn: this.peek().endColumn,
            code: 'ST-PAR-001',
            source: 'parser',
        });
    }
    makeLocation(start, end) {
        const startPos = 'line' in start && 'column' in start ? start : start;
        const endPos = 'line' in end && 'column' in end ? end : end;
        return {
            line: startPos.line,
            column: startPos.column,
            endLine: endPos.endLine || endPos.line,
            endColumn: endPos.endColumn || endPos.column,
        };
    }
}
