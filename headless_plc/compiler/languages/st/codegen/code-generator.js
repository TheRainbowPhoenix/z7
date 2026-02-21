const parseDintBitIndex = (name) => {
    if (!/^\d+$/.test(name))
        return null;
    const n = Number(name);
    return n >= 0 && n <= 31 ? n : null;
};
export class STCodeGenerator {
    generate(ast) {
        const statements = ast.body
            .map((stmt) => this.generateStatement(stmt))
            .filter((code) => code.trim() !== '') // Remove empty lines from comments
            .join('\n');
        return `
// Generated JavaScript from ST code
try {
${statements}
} catch (error) {
  log.push('Runtime error: ' + error.message);
}`;
    }
    generateStatement(stmt) {
        switch (stmt.type) {
            case 'AssignmentStatement':
                return this.generateAssignment(stmt);
            case 'IfStatement':
                return this.generateIfStatement(stmt);
            case 'ForStatement':
                return this.generateForStatement(stmt);
            case 'WhileStatement':
                return this.generateWhileStatement(stmt);
            case 'RepeatStatement':
                return this.generateRepeatStatement(stmt);
            case 'CaseStatement':
                return this.generateCaseStatement(stmt);
            case 'ReturnStatement':
                return 'return;';
            case 'ExpressionStatement': {
                const expression = stmt.expression;
                if (expression?.type === 'FunctionCall') {
                    const functionCall = expression;
                    const functionName = this.generateIdentifier(functionCall.name).toUpperCase();
                    if (functionName === 'SIZE') {
                        return this.generateSizeStatement(functionCall);
                    }
                }
                return this.generateExpression(expression) + ';';
            }
            case 'Comment':
                return '';
            case 'SyntaxError':
                return '// Syntax error: ' + stmt.message;
            default:
                throw new Error(`Unsupported statement type: ${stmt.type}`);
        }
    }
    generateAssignment(stmt) {
        const rightExpr = this.generateExpression(stmt.value);
        const target = stmt.target;
        const { base, segments } = this.decomposeAccess(target);
        if (segments.length === 0) {
            return `vars.set('${base.name}', ${rightExpr});`;
        }
        return this.generateAccessSetter(base, segments, rightExpr);
    }
    generateSizeStatement(funcCall) {
        const args = funcCall.arguments ?? [];
        if (args.length !== 3) {
            const params = args.map((arg) => this.generateExpression(arg)).join(', ');
            return `funcs.get('SIZE')(${params});`;
        }
        const [arrayArg, dimensionArg, destinationArg] = args;
        const arrayExpr = this.generateExpression(arrayArg);
        const dimensionExpr = this.generateExpression(dimensionArg);
        if (destinationArg.type === 'Identifier' ||
            destinationArg.type === 'IndexedAccessExpression' ||
            destinationArg.type === 'MemberExpression') {
            const target = destinationArg;
            const { base, segments } = this.decomposeAccess(target);
            const sizeCall = `funcs.get('SIZE')(${arrayExpr}, ${dimensionExpr})`;
            if (segments.length === 0) {
                const destName = base.name;
                return [
                    '(() => {',
                    `  if (!vars.has('${destName}')) { throw new Error('Tag ${destName} is not defined'); }`,
                    `  const __sizeValue = ${sizeCall};`,
                    `  vars.set('${destName}', __sizeValue);`,
                    '})();',
                ].join('\n');
            }
            return this.generateAccessSetter(base, segments, sizeCall);
        }
        const destExpr = this.generateExpression(destinationArg);
        return `funcs.get('SIZE')(${arrayExpr}, ${dimensionExpr}, ${destExpr});`;
    }
    generateIfStatement(stmt) {
        const condition = this.generateExpression(stmt.condition);
        const consequent = stmt.thenStatements
            .map((child) => this.generateStatement(child))
            .join('\n  ');
        let result = `if (${condition}) {\n  ${consequent}\n}`;
        // Generate ELSIF branches as JavaScript else if statements
        stmt.elsifBranches.forEach((elsifBranch) => {
            const elsifCondition = this.generateExpression(elsifBranch.condition);
            const elsifStatements = elsifBranch.statements
                .map((child) => this.generateStatement(child))
                .join('\n  ');
            result += ` else if (${elsifCondition}) {\n  ${elsifStatements}\n}`;
        });
        // Generate ELSE clause if present
        if (stmt.elseStatements?.length) {
            const alternate = stmt.elseStatements
                .map((child) => this.generateStatement(child))
                .join('\n  ');
            result += ` else {\n  ${alternate}\n}`;
        }
        return result;
    }
    generateForStatement(stmt) {
        const accessHelpers = this.buildAccessHelpers(stmt.counter);
        const start = this.generateExpression(stmt.start);
        const end = this.generateExpression(stmt.end);
        const step = stmt.step ? this.generateExpression(stmt.step) : '1';
        const lines = [];
        lines.push('{');
        lines.push(`  const __forStart = ${start};`);
        lines.push(this.indentLines(accessHelpers.setter('__forStart'), 1));
        lines.push(`  const __forEnd = ${end};`);
        lines.push(`  const __forStep = ${step};`);
        lines.push('  if (__forStep === 0) {');
        lines.push("    throw new Error('FOR loop step cannot be zero');");
        lines.push('  }');
        lines.push('  for (;;) {');
        lines.push(`    const __forCounter = ${accessHelpers.getter()};`);
        lines.push('    if (__forStep > 0 ? __forCounter > __forEnd : __forCounter < __forEnd) { break; }');
        if (stmt.body.length > 0) {
            for (const statement of stmt.body) {
                const generated = this.generateStatement(statement).split('\n');
                for (const line of generated) {
                    if (line.trim() === '') {
                        lines.push('');
                    }
                    else {
                        lines.push(`    ${line}`);
                    }
                }
            }
        }
        lines.push('    const __forNext = __forCounter + __forStep;');
        lines.push(this.indentLines(accessHelpers.setter('__forNext'), 2));
        lines.push('  }');
        lines.push('}');
        return lines.join('\n');
    }
    generateWhileStatement(stmt) {
        const condition = this.generateBooleanCondition(stmt.test);
        const statements = stmt.body
            .map((child) => this.generateStatement(child))
            .filter((code) => code.trim() !== '');
        const body = statements.length > 0 ? `  ${statements.join('\n  ')}\n` : '';
        return `while (${condition}) {\n${body}}`;
    }
    generateRepeatStatement(stmt) {
        const condition = this.generateBooleanCondition(stmt.test);
        const statements = stmt.body
            .map((child) => this.generateStatement(child))
            .filter((code) => code.trim() !== '');
        const body = statements.length > 0 ? `  ${statements.join('\n  ')}\n` : '';
        return `do {\n${body}} while (!(${condition}));`;
    }
    generateCaseStatement(stmt) {
        const discriminant = this.generateExpression(stmt.discriminant);
        const containsRanges = stmt.cases.some((caseClause) => caseClause.values.some((value) => value.type === 'CaseRange'));
        let result = `switch (${containsRanges ? 'true' : discriminant}) {\n`;
        stmt.cases.forEach((caseClause) => {
            caseClause.values.forEach((value) => {
                if (value.type === 'CaseRange') {
                    // For ranges, we'll need to generate multiple case labels
                    if (typeof value.start.value !== 'number' || typeof value.end.value !== 'number') {
                        throw new Error('Case ranges require numeric literal bounds');
                    }
                    const start = this.generateLiteral(value.start);
                    const end = this.generateLiteral(value.end);
                    result += `  case ${discriminant} >= ${start} && ${discriminant} <= ${end}:\n`;
                }
                else {
                    const literal = this.generateLiteral(value);
                    if (containsRanges) {
                        result += `  case ${discriminant} === ${literal}:\n`;
                    }
                    else {
                        result += `  case ${literal}:\n`;
                    }
                }
            });
            const statements = caseClause.consequent
                .map((child) => this.generateStatement(child))
                .join('\n    ');
            result += `    ${statements}\n    break;\n`;
        });
        if (stmt.defaultCase?.length) {
            const defaultStatements = stmt.defaultCase
                .map((child) => this.generateStatement(child))
                .join('\n    ');
            result += `  default:\n    ${defaultStatements}\n    break;\n`;
        }
        result += '}';
        return result;
    }
    generateExpression(expr) {
        switch (expr.type) {
            case 'BinaryExpression':
                return this.generateBinaryExpression(expr);
            case 'UnaryExpression':
                return this.generateUnaryExpression(expr);
            case 'FunctionCall':
                return this.generateFunctionCall(expr);
            case 'Literal':
                return this.generateLiteral(expr);
            case 'Identifier':
                return this.generateVariableAccess(expr);
            case 'MemberExpression': {
                const access = expr;
                const { base, segments } = this.decomposeAccess(access);
                return this.generateAccessGetter(base, segments);
            }
            case 'IndexedAccessExpression': {
                const access = expr;
                const { base, segments } = this.decomposeAccess(access);
                return this.generateAccessGetter(base, segments);
            }
            default:
                throw new Error(`Unsupported expression type: ${expr.type}`);
        }
    }
    generateBinaryExpression(expr) {
        const left = this.generateExpression(expr.left);
        const right = this.generateExpression(expr.right);
        // Map ST operators to JavaScript operators
        const operatorMap = {
            AND: '&&',
            OR: '||',
            XOR: '^',
            '=': '===',
            '<>': '!==',
            '>=': '>=',
            '<=': '<=',
            '>': '>',
            '<': '<',
            '+': '+',
            '-': '-',
            '*': '*',
            '/': '/',
            MOD: '%',
        };
        const jsOperator = operatorMap[expr.operator] || expr.operator;
        // For comparison and logical operators, convert boolean result to numeric (1/0)
        const booleanOperators = ['=', '<>', '>=', '<=', '>', '<', 'AND', 'OR', 'XOR'];
        if (booleanOperators.includes(expr.operator)) {
            return `((${left} ${jsOperator} ${right}) ? 1 : 0)`;
        }
        return `(${left} ${jsOperator} ${right})`;
    }
    generateUnaryExpression(expr) {
        const operand = this.generateExpression(expr.operand);
        const operatorMap = {
            NOT: '!',
            '-': '-',
        };
        const jsOperator = operatorMap[expr.operator] || expr.operator;
        // Convert boolean results to PLC integers for consistency
        if (expr.operator === 'NOT') {
            return `(${operand} ? 0 : 1)`;
        }
        return `(${jsOperator}${operand})`;
    }
    generateFunctionCall(expr) {
        const functionName = this.generateIdentifier(expr.name);
        const args = expr.arguments.map((arg) => this.generateExpression(arg)).join(', ');
        return `funcs.get('${functionName}')(${args})`;
    }
    generateBooleanCondition(expr) {
        const expression = this.generateExpression(expr);
        return [
            '(() => {',
            `  const __conditionValue = ${expression};`,
            "  if (typeof __conditionValue === 'boolean') {",
            '    return __conditionValue;',
            '  }',
            "  if (typeof __conditionValue === 'number') {",
            '    return __conditionValue !== 0;',
            '  }',
            '  if (__conditionValue == null) {',
            '    return false;',
            '  }',
            '  return Boolean(__conditionValue);',
            '})()',
        ].join('\n');
    }
    generateLiteral(expr) {
        if (expr.dataType === 'STRING') {
            return `"${expr.value}"`;
        }
        if (expr.dataType === 'BOOL') {
            // Convert boolean to integer for PLC compatibility
            return expr.value ? '1' : '0';
        }
        return String(expr.value);
    }
    generateIdentifier(expr) {
        return expr.name;
    }
    generateVariableAccess(expr) {
        return `(vars.has('${expr.name}') ? vars.get('${expr.name}') : 0)`;
    }
    decomposeAccess(target) {
        if (target.type === 'Identifier') {
            return { base: target, segments: [] };
        }
        if (target.type === 'IndexedAccessExpression') {
            const { base, segments } = this.decomposeAccess(target.target);
            return {
                base,
                segments: [...segments, { kind: 'index', expression: target.index }],
            };
        }
        const { base, segments } = this.decomposeAccess(target.object);
        return {
            base,
            segments: [...segments, { kind: 'property', name: target.property.name }],
        };
    }
    generateAccessSetter(base, segments, rightExpr) {
        const lines = [];
        lines.push('(() => {');
        lines.push(`  if (!vars.has('${base.name}')) { throw new Error('Tag ${base.name} is not defined'); }`);
        lines.push(`  const base = vars.get('${base.name}');`);
        lines.push(`  if (base === undefined) { throw new Error('Tag ${base.name} is not defined'); }`);
        lines.push(`  const value = ${rightExpr};`);
        lines.push('  let __current = base;');
        lines.push('  let __parent = undefined;');
        lines.push('  let __parentKey = undefined;');
        segments.forEach((segment, idx) => {
            const isLast = idx === segments.length - 1;
            const nextSegment = segments[idx + 1];
            if (segment.kind === 'property') {
                const propName = segment.name;
                const bitIdx = parseDintBitIndex(propName);
                if (bitIdx !== null && isLast) {
                    lines.push(`  if (typeof __current === 'number') {`);
                    lines.push(`    const __dint = Math.trunc(__current);`);
                    lines.push(`    const __newVal = (value ? 1 : 0) ? (__dint | (1 << ${bitIdx})) : (__dint & ~(1 << ${bitIdx}));`);
                    lines.push(`    if (__parent !== undefined && __parentKey !== undefined) {`);
                    lines.push(`      __parent[__parentKey] = __newVal | 0;`);
                    lines.push(`    } else {`);
                    lines.push(`      vars.set('${base.name}', __newVal | 0);`);
                    lines.push(`      return;`);
                    lines.push(`    }`);
                    lines.push(`  } else if (typeof __current === 'object' && __current !== null) {`);
                    lines.push(`    __current['${propName}'] = value;`);
                    lines.push(`  }`);
                }
                else {
                    lines.push("  if (typeof __current !== 'object' || __current === null) { throw new Error('Member access requires structured data'); }");
                    if (isLast) {
                        lines.push(`  __current['${propName}'] = value;`);
                    }
                    else {
                        const nextRef = `__next${idx}`;
                        const nextIsBitAccess = nextSegment?.kind === 'property' && parseDintBitIndex(nextSegment.name) !== null;
                        const defaultInit = nextSegment?.kind === 'index' ? '[]' : nextIsBitAccess ? '0' : '{}';
                        lines.push(`  if (!Object.prototype.hasOwnProperty.call(__current, '${propName}')) { __current['${propName}'] = ${defaultInit}; }`);
                        lines.push(`  __parent = __current;`);
                        lines.push(`  __parentKey = '${propName}';`);
                        lines.push(`  const ${nextRef} = __current['${propName}'];`);
                        if (nextSegment?.kind === 'index') {
                            lines.push(`  if (!Array.isArray(${nextRef})) { throw new Error('Member ${propName} is not an array'); }`);
                        }
                        else if (nextSegment?.kind === 'property' && parseDintBitIndex(nextSegment.name) !== null) {
                            // Next segment is a DINT bit access — __current may be a number, don't check for object
                        }
                        else {
                            lines.push(`  if (typeof ${nextRef} !== 'object' || ${nextRef} === null) { throw new Error('Member ${propName} is not a structure'); }`);
                        }
                        lines.push(`  __current = ${nextRef};`);
                    }
                }
            }
            else {
                const indexCode = this.generateExpression(segment.expression);
                const indexVar = `_idx${idx}`;
                lines.push("  if (!Array.isArray(__current)) { throw new Error('Array access on non-array value'); }");
                lines.push(`  const ${indexVar} = ${indexCode};`);
                lines.push(`  if (!Number.isInteger(${indexVar})) { throw new Error('Array index must be an integer'); }`);
                lines.push(`  if (${indexVar} < 0 || ${indexVar} >= __current.length) { throw new Error('Array index out of bounds'); }`);
                if (isLast) {
                    lines.push(`  __current[${indexVar}] = value;`);
                }
                else {
                    const nextRef = `__next${idx}`;
                    lines.push(`  __parent = __current;`);
                    lines.push(`  __parentKey = ${indexVar};`);
                    lines.push(`  const ${nextRef} = __current[${indexVar}];`);
                    if (nextSegment?.kind === 'index') {
                        lines.push(`  if (!Array.isArray(${nextRef})) { throw new Error('Array element is not an array'); }`);
                    }
                    else if (nextSegment?.kind === 'property' && parseDintBitIndex(nextSegment.name) !== null) {
                        // Next segment is a DINT bit access — __current may be a number, don't check for object
                    }
                    else {
                        lines.push(`  if (typeof ${nextRef} !== 'object' || ${nextRef} === null) { throw new Error('Array element is not a structure'); }`);
                    }
                    lines.push(`  __current = ${nextRef};`);
                }
            }
        });
        lines.push(`  vars.set('${base.name}', base);`);
        lines.push('})();');
        return lines.join('\n');
    }
    generateAccessGetter(base, segments) {
        if (segments.length === 0) {
            return this.generateVariableAccess(base);
        }
        const lines = [];
        lines.push('(() => {');
        lines.push(`  if (!vars.has('${base.name}')) { return 0; }`);
        lines.push(`  const base = vars.get('${base.name}');`);
        lines.push('  let __current = base;');
        segments.forEach((segment, idx) => {
            const isLast = idx === segments.length - 1;
            const nextSegment = segments[idx + 1];
            if (segment.kind === 'property') {
                const propName = segment.name;
                const bitIdx = parseDintBitIndex(propName);
                if (bitIdx !== null && isLast) {
                    lines.push(`  if (typeof __current === 'number') { return ((__current >>> ${bitIdx}) & 1) ? 1 : 0; }`);
                    lines.push("  if (typeof __current !== 'object' || __current === null) { return 0; }");
                    lines.push(`  const __value = __current['${propName}'];`);
                    lines.push('  return __value ?? 0;');
                }
                else if (bitIdx !== null && !isLast) {
                    lines.push(`  if (typeof __current === 'number') { __current = ((__current >>> ${bitIdx}) & 1) ? 1 : 0; } else {`);
                    lines.push("  if (typeof __current !== 'object' || __current === null) { return 0; }");
                    const nextRef = `__next${idx}`;
                    lines.push(`  const ${nextRef} = __current['${propName}'];`);
                    if (nextSegment?.kind === 'index') {
                        lines.push(`  if (!Array.isArray(${nextRef})) { return 0; }`);
                    }
                    else {
                        lines.push(`  if (typeof ${nextRef} !== 'object' || ${nextRef} === null) { return 0; }`);
                    }
                    lines.push(`  __current = ${nextRef};`);
                    lines.push('  }');
                }
                else {
                    lines.push("  if (typeof __current !== 'object' || __current === null) { return 0; }");
                    lines.push(`  if (!Object.prototype.hasOwnProperty.call(__current, '${propName}')) { return 0; }`);
                    if (isLast) {
                        lines.push(`  const __value = __current['${propName}'];`);
                        lines.push('  return __value ?? 0;');
                    }
                    else {
                        const nextRef = `__next${idx}`;
                        const nextIsBitAccess = nextSegment?.kind === 'property' && parseDintBitIndex(nextSegment.name) !== null;
                        lines.push(`  const ${nextRef} = __current['${propName}'];`);
                        if (nextSegment?.kind === 'index') {
                            lines.push(`  if (!Array.isArray(${nextRef})) { return 0; }`);
                        }
                        else if (!nextIsBitAccess) {
                            lines.push(`  if (typeof ${nextRef} !== 'object' || ${nextRef} === null) { return 0; }`);
                        }
                        lines.push(`  __current = ${nextRef};`);
                    }
                }
            }
            else {
                const indexCode = this.generateExpression(segment.expression);
                const indexVar = `_idx${idx}`;
                lines.push('  if (!Array.isArray(__current)) { return 0; }');
                lines.push(`  const ${indexVar} = ${indexCode};`);
                lines.push(`  if (!Number.isInteger(${indexVar})) { return 0; }`);
                lines.push(`  if (${indexVar} < 0 || ${indexVar} >= __current.length) { return 0; }`);
                if (isLast) {
                    lines.push(`  const __value = __current[${indexVar}];`);
                    lines.push('  return __value ?? 0;');
                }
                else {
                    const nextRef = `__next${idx}`;
                    lines.push(`  const ${nextRef} = __current[${indexVar}];`);
                    if (nextSegment?.kind === 'index') {
                        lines.push(`  if (!Array.isArray(${nextRef})) { return 0; }`);
                    }
                    else {
                        lines.push(`  if (typeof ${nextRef} !== 'object' || ${nextRef} === null) { return 0; }`);
                    }
                    lines.push(`  __current = ${nextRef};`);
                }
            }
        });
        lines.push('  return __current;');
        lines.push('})()');
        return lines.join('\n');
    }
    buildAccessHelpers(target) {
        const { base, segments } = this.decomposeAccess(target);
        if (segments.length === 0) {
            const getterExpr = this.generateVariableAccess(base);
            return {
                getter: () => getterExpr,
                setter: (valueExpr) => `vars.set('${base.name}', ${valueExpr});`,
            };
        }
        return {
            getter: () => this.generateAccessGetter(base, segments),
            setter: (valueExpr) => this.generateAccessSetter(base, segments, valueExpr),
        };
    }
    indentLines(code, level = 1) {
        const indent = '  '.repeat(level);
        return code
            .split('\n')
            .map((line) => (line.length > 0 ? indent + line : line))
            .join('\n');
    }
}
