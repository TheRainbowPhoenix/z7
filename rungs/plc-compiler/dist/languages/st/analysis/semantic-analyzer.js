import { getInstruction, getMembersForDataType } from '../../../core/index.js';
const RESERVED_KEYWORDS = new Set([
    'IF',
    'THEN',
    'ELSE',
    'ELSIF',
    'END_IF',
    'FOR',
    'TO',
    'BY',
    'DO',
    'END_FOR',
    'WHILE',
    'END_WHILE',
    'REPEAT',
    'UNTIL',
    'END_REPEAT',
    'CASE',
    'OF',
    'END_CASE',
    'TRUE',
    'FALSE',
    'AND',
    'OR',
    'NOT',
    'XOR',
    'MOD',
    'ABS',
    'SQRT',
    'SIN',
    'COS',
    'TAN',
    'MIN',
    'MAX',
    'BOOL',
    'DINT',
    'REAL',
    'STRING',
    'FBD_TIMER',
    'FBD_COUNTER',
]);
const BUILTIN_FUNCTIONS = new Set([
    'GETCURRENTTIME',
    'ABS',
    'MIN',
    'MAX',
    'SQRT',
    'SIN',
    'COS',
    'TAN',
    'TONR',
    'TOFR',
    'RTOR',
    'CTUD',
    'SIZE',
]);
const STATEMENT_ONLY_FUNCTIONS = new Set(['TONR', 'TOFR', 'RTOR', 'CTUD']);
const RETURNING_MATH_FUNCTIONS = new Set(['ABS', 'MIN', 'MAX', 'SQRT', 'SIN', 'COS', 'TAN']);
const NUMERIC_FUNCTIONS = new Set(['ABS', 'MIN', 'MAX', 'SQRT', 'SIN', 'COS', 'TAN']);
const knownFunctionsCache = new WeakMap();
const isIdentifierNode = (expression) => expression.type === 'Identifier';
const isMemberExpressionNode = (expression) => expression.type === 'MemberExpression';
const isIndexedExpressionNode = (expression) => expression.type === 'IndexedAccessExpression';
var ValueKind;
(function (ValueKind) {
    ValueKind["Unknown"] = "unknown";
    ValueKind["Bool"] = "bool";
    ValueKind["Integer"] = "integer";
    ValueKind["Numeric"] = "numeric";
    ValueKind["Timer"] = "timer";
    ValueKind["Counter"] = "counter";
})(ValueKind || (ValueKind = {}));
var StructuredKind;
(function (StructuredKind) {
    StructuredKind["Timer"] = "FBD_TIMER";
    StructuredKind["Counter"] = "FBD_COUNTER";
})(StructuredKind || (StructuredKind = {}));
const TAG_TYPE_TO_KIND = {
    BOOL: ValueKind.Bool,
    DINT: ValueKind.Integer,
    INT: ValueKind.Integer,
    SINT: ValueKind.Integer,
    REAL: ValueKind.Numeric,
    [StructuredKind.Timer]: ValueKind.Timer,
    [StructuredKind.Counter]: ValueKind.Counter,
    TIMER: ValueKind.Timer,
    COUNTER: ValueKind.Counter,
};
const NUMERIC_KINDS = new Set([ValueKind.Integer, ValueKind.Numeric]);
const describeValueKind = (kind) => {
    switch (kind) {
        case ValueKind.Bool:
            return 'a BOOL value';
        case ValueKind.Integer:
            return 'an integer value';
        case ValueKind.Numeric:
            return 'a numeric value';
        case ValueKind.Timer:
            return 'an FBD_TIMER tag';
        case ValueKind.Counter:
            return 'an FBD_COUNTER tag';
        default:
            return 'an unknown value';
    }
};
const kindFromTagType = (tagType) => {
    if (!tagType) {
        return ValueKind.Unknown;
    }
    return TAG_TYPE_TO_KIND[tagType.toUpperCase()] ?? ValueKind.Unknown;
};
const kindFromDataType = (dataType) => {
    if (!dataType) {
        return ValueKind.Unknown;
    }
    return kindFromTagType(dataType);
};
const matchValueKind = (actual, expected) => {
    if (expected === ValueKind.Numeric) {
        return NUMERIC_KINDS.has(actual);
    }
    if (expected === ValueKind.Integer) {
        return actual === ValueKind.Integer;
    }
    return actual === expected;
};
const isBooleanCoercibleNumericLiteral = (expression) => {
    if (expression.type === 'Literal') {
        const literal = expression;
        if (literal.dataType &&
            !['DINT', 'INT', 'SINT', 'UDINT', 'UINT', 'USINT'].includes(literal.dataType.toUpperCase())) {
            return false;
        }
    }
    const resolved = resolveStaticIndexValue(expression);
    if (resolved === null) {
        return false;
    }
    if (!Number.isInteger(resolved)) {
        return false;
    }
    return resolved === 0 || resolved === 1;
};
const DINT_BIT_SCHEMA = Object.fromEntries(Array.from({ length: 32 }, (_, i) => [String(i), { dataType: 'BOOL', kind: ValueKind.Bool }]));
const resolveStructuredSchema = (tag) => {
    if (!tag?.dataType) {
        return null;
    }
    const upper = tag.dataType.toUpperCase();
    if (tag.members && Object.keys(tag.members).length > 0) {
        return Object.entries(tag.members).reduce((acc, [name, member]) => {
            acc[name.toUpperCase()] = {
                dataType: member.dataType,
                kind: kindFromDataType(member.dataType),
            };
            return acc;
        }, {});
    }
    if (upper === 'DINT') {
        return DINT_BIT_SCHEMA;
    }
    const members = getMembersForDataType(upper);
    if (members.length === 0) {
        return null;
    }
    return members.reduce((acc, member) => {
        acc[member.key.toUpperCase()] = {
            dataType: member.type,
            kind: kindFromDataType(member.type),
        };
        return acc;
    }, {});
};
const resolveSchemaForDataType = (dataType) => {
    if (dataType === 'DINT') {
        return DINT_BIT_SCHEMA;
    }
    const members = getMembersForDataType(dataType);
    if (members.length === 0) {
        return null;
    }
    return members.reduce((acc, member) => {
        acc[member.key.toUpperCase()] = {
            dataType: member.type,
            kind: kindFromDataType(member.type),
        };
        return acc;
    }, {});
};
export const DiagnosticCode = {
    UnknownError: 'ST-SEM-000',
    TagUndefined: 'ST-SEM-001',
    ReservedKeyword: 'ST-SEM-003',
    InvalidTagName: 'ST-SEM-004',
    TypeMismatch: 'ST-SEM-010',
    BoolNumericMismatch: 'ST-SEM-014',
    BoolAssignmentMismatch: 'ST-SEM-015',
    ArityMismatch: 'ST-SEM-021',
    StructuredArgument: 'ST-SEM-022',
    StructuredMemberInvalid: 'ST-SEM-040',
    ScalarReferenceRequired: 'ST-SEM-041',
    AssignmentReadOnly: 'ST-SEM-042',
    StatementOnlyFunction: 'ST-SEM-043',
    UnknownInstruction: 'ST-SEM-044',
    RepeatedTimerInvocation: 'ST-SEM-045',
    ReturnValueMisuse: 'ST-SEM-020',
};
const fallbackLocation = {
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
};
const nodeLocation = (node) => {
    if (!node?.location) {
        return { ...fallbackLocation };
    }
    const { line, column, endLine, endColumn } = node.location;
    return {
        line,
        column,
        endLine,
        endColumn,
    };
};
class DiagnosticsBuilder {
    diagnostics;
    constructor(diagnostics) {
        this.diagnostics = diagnostics;
    }
    error(details) {
        this.pushDiagnostic('error', details);
    }
    warning(details) {
        this.pushDiagnostic('warning', details);
    }
    pushDiagnostic(severity, details) {
        const location = details.location ?? nodeLocation(details.node);
        const duplicate = this.diagnostics.some((diagnostic) => diagnostic.severity === severity &&
            diagnostic.message === details.message &&
            diagnostic.code === details.code &&
            diagnostic.line === location.line &&
            diagnostic.column === location.column &&
            diagnostic.endLine === location.endLine &&
            diagnostic.endColumn === location.endColumn);
        if (duplicate) {
            return;
        }
        this.diagnostics.push({
            type: 'st',
            severity,
            message: details.message,
            line: location.line,
            column: location.column,
            endLine: location.endLine,
            endColumn: location.endColumn,
            code: details.code,
            source: 'semantic',
            ...(details.expectedDataType && { expectedDataType: details.expectedDataType }),
        });
    }
}
const resolveStaticIndexValue = (expression) => {
    if (expression.type === 'Literal') {
        const literal = expression;
        if (typeof literal.value === 'number') {
            return literal.value;
        }
        if (typeof literal.value === 'string') {
            const parsed = Number(literal.value);
            return Number.isNaN(parsed) ? null : parsed;
        }
    }
    if (expression.type === 'UnaryExpression') {
        const unary = expression;
        if (unary.operator === '-' || unary.operator === '+') {
            const resolved = resolveStaticIndexValue(unary.operand);
            if (resolved === null) {
                return null;
            }
            return unary.operator === '-' ? -resolved : resolved;
        }
    }
    return null;
};
class TagResolver {
    tagMap = new Map();
    sourceLines;
    constructor(context = {}, sourceCode) {
        this.sourceLines = sourceCode ? sourceCode.split('\n') : [];
        if (context.tags) {
            context.tags.forEach((tag) => {
                const upper = tag.name.toUpperCase();
                this.tagMap.set(upper, {
                    context: tag,
                    kind: kindFromTagType(tag.dataType),
                    schema: resolveStructuredSchema(tag),
                });
            });
        }
    }
    resolveExpression(expression) {
        if (expression.type === 'Identifier') {
            return this.resolveIdentifier(expression);
        }
        if (expression.type === 'IndexedAccessExpression') {
            return this.resolveIndexedAccess(expression);
        }
        if (expression.type === 'MemberExpression') {
            return this.resolveMemberExpression(expression);
        }
        return null;
    }
    resolveAssignmentTarget(target, statementLocation) {
        if (target.type === 'Identifier') {
            const identifier = target;
            const resolved = this.resolveIdentifier(identifier);
            if (!resolved) {
                return null;
            }
            return {
                ...resolved,
                baseIdentifier: {
                    ...identifier,
                    location: identifier.location ??
                        this.calculateIdentifierLocation(identifier.name, statementLocation),
                },
            };
        }
        if (target.type === 'MemberExpression') {
            return this.resolveAssignmentTarget(target.object, statementLocation);
        }
        if (target.type === 'IndexedAccessExpression') {
            const resolved = this.resolveIndexedAccess(target);
            if (!resolved) {
                return null;
            }
            return resolved;
        }
        return null;
    }
    resolveIdentifier(identifier) {
        const upper = identifier.name.toUpperCase();
        const tag = this.tagMap.get(upper);
        if (!tag) {
            return null;
        }
        return {
            expression: identifier,
            baseIdentifier: identifier,
            baseName: identifier.name,
            tag,
            indices: [],
            indexCount: 0,
            dimension: tag.context.dimension,
            isIndexed: false,
        };
    }
    resolveIndexedAccess(indexed) {
        const baseInfo = this.collectIndexedBase(indexed);
        if (!baseInfo) {
            return null;
        }
        const base = this.resolveIdentifier(baseInfo.baseIdentifier);
        if (!base) {
            return null;
        }
        return {
            ...base,
            expression: indexed,
            indices: baseInfo.indices,
            indexCount: baseInfo.indices.length,
            isIndexed: true,
        };
    }
    resolveMemberExpression(member) {
        const parent = this.resolveExpression(member.object);
        if (!parent) {
            return null;
        }
        const name = member.property.name;
        let schema = parent.tag.schema;
        if (parent.member?.info) {
            const parentDataType = parent.member.info.dataType.toUpperCase();
            schema = resolveSchemaForDataType(parentDataType);
        }
        const definition = schema?.[name.toUpperCase()];
        return {
            ...parent,
            expression: member,
            member: {
                name,
                info: definition,
            },
        };
    }
    collectIndexedBase(indexed) {
        const indices = [indexed.index];
        let target = indexed.target;
        while (target.type === 'IndexedAccessExpression') {
            const inner = target;
            indices.unshift(inner.index);
            target = inner.target;
        }
        if (target.type !== 'Identifier') {
            return null;
        }
        return {
            baseIdentifier: target,
            indices,
        };
    }
    calculateIdentifierLocation(identifierName, statementLocation) {
        if (!statementLocation || this.sourceLines.length === 0) {
            return { ...fallbackLocation };
        }
        const lineIndex = statementLocation.line - 1;
        if (lineIndex >= 0 && lineIndex < this.sourceLines.length) {
            const line = this.sourceLines[lineIndex];
            const index = line.indexOf(identifierName);
            if (index !== -1) {
                return {
                    line: statementLocation.line,
                    column: index + 1,
                    endLine: statementLocation.line,
                    endColumn: index + identifierName.length + 1,
                };
            }
        }
        return {
            line: statementLocation.line,
            column: statementLocation.column,
            endLine: statementLocation.endLine,
            endColumn: statementLocation.endColumn,
        };
    }
}
class ExpressionTypeInferer {
    resolver;
    cache = new WeakMap();
    constructor(resolver) {
        this.resolver = resolver;
    }
    infer(expression) {
        if (!expression) {
            return { kind: ValueKind.Unknown, isScalar: true, reference: null };
        }
        const cached = this.cache.get(expression);
        if (cached) {
            return cached;
        }
        const inferred = this.compute(expression);
        this.cache.set(expression, inferred);
        return inferred;
    }
    compute(expression) {
        switch (expression.type) {
            case 'Literal': {
                const literal = expression;
                return {
                    kind: kindFromDataType(literal.dataType),
                    isScalar: true,
                    reference: null,
                };
            }
            case 'Identifier': {
                const resolved = this.resolver.resolveExpression(expression);
                if (!resolved) {
                    return { kind: ValueKind.Unknown, isScalar: true, reference: null };
                }
                return {
                    kind: resolved.tag.kind,
                    isScalar: resolved.tag.context.dimension === undefined,
                    reference: resolved,
                };
            }
            case 'IndexedAccessExpression': {
                const resolved = this.resolver.resolveExpression(expression);
                if (!resolved) {
                    return { kind: ValueKind.Unknown, isScalar: true, reference: null };
                }
                return {
                    kind: resolved.tag.kind,
                    isScalar: true,
                    reference: resolved,
                };
            }
            case 'MemberExpression': {
                const resolved = this.resolver.resolveExpression(expression);
                if (!resolved) {
                    return { kind: ValueKind.Unknown, isScalar: true, reference: null };
                }
                const member = resolved.member?.info;
                if (member) {
                    return {
                        kind: member.kind,
                        isScalar: true,
                        reference: resolved,
                    };
                }
                return {
                    kind: resolved.tag.kind,
                    isScalar: true,
                    reference: resolved,
                };
            }
            case 'UnaryExpression': {
                const unary = expression;
                const operand = this.infer(unary.operand);
                if (unary.operator === 'NOT') {
                    const operandIsBool = operand.kind === ValueKind.Bool || isBooleanCoercibleNumericLiteral(unary.operand);
                    return {
                        kind: operandIsBool ? ValueKind.Bool : ValueKind.Unknown,
                        isScalar: operand.isScalar,
                        reference: null,
                    };
                }
                if (unary.operator === '+' || unary.operator === '-') {
                    return {
                        kind: operand.kind,
                        isScalar: operand.isScalar,
                        reference: null,
                    };
                }
                return { kind: ValueKind.Unknown, isScalar: operand.isScalar, reference: null };
            }
            case 'BinaryExpression': {
                const binary = expression;
                const left = this.infer(binary.left);
                const right = this.infer(binary.right);
                const operator = binary.operator.toUpperCase();
                if (['+', '-', '*', '/', 'MOD'].includes(operator)) {
                    if (left.kind !== ValueKind.Unknown &&
                        right.kind !== ValueKind.Unknown &&
                        matchValueKind(left.kind, ValueKind.Numeric) &&
                        matchValueKind(right.kind, ValueKind.Numeric)) {
                        const isInteger = left.kind === ValueKind.Integer &&
                            right.kind === ValueKind.Integer &&
                            operator !== '/';
                        return {
                            kind: isInteger ? ValueKind.Integer : ValueKind.Numeric,
                            isScalar: left.isScalar && right.isScalar,
                            reference: null,
                        };
                    }
                    return {
                        kind: ValueKind.Unknown,
                        isScalar: left.isScalar && right.isScalar,
                        reference: null,
                    };
                }
                if (['AND', 'OR', 'XOR'].includes(operator)) {
                    const leftIsBoolLike = left.kind === ValueKind.Bool || isBooleanCoercibleNumericLiteral(binary.left);
                    const rightIsBoolLike = right.kind === ValueKind.Bool || isBooleanCoercibleNumericLiteral(binary.right);
                    if (leftIsBoolLike && rightIsBoolLike) {
                        return {
                            kind: ValueKind.Bool,
                            isScalar: left.isScalar && right.isScalar,
                            reference: null,
                        };
                    }
                    return {
                        kind: ValueKind.Unknown,
                        isScalar: left.isScalar && right.isScalar,
                        reference: null,
                    };
                }
                if (['=', '<>', '<', '<=', '>', '>='].includes(operator)) {
                    if (left.kind !== ValueKind.Unknown &&
                        right.kind !== ValueKind.Unknown &&
                        ((matchValueKind(left.kind, ValueKind.Numeric) &&
                            matchValueKind(right.kind, ValueKind.Numeric)) ||
                            (left.kind === ValueKind.Bool && right.kind === ValueKind.Bool))) {
                        return {
                            kind: ValueKind.Bool,
                            isScalar: left.isScalar && right.isScalar,
                            reference: null,
                        };
                    }
                    return {
                        kind: ValueKind.Unknown,
                        isScalar: left.isScalar && right.isScalar,
                        reference: null,
                    };
                }
                return {
                    kind: ValueKind.Unknown,
                    isScalar: left.isScalar && right.isScalar,
                    reference: null,
                };
            }
            case 'FunctionCall': {
                const call = expression;
                const name = call.name?.name?.toUpperCase();
                if (name && NUMERIC_FUNCTIONS.has(name)) {
                    const args = call.arguments ?? [];
                    const allScalar = args.every((arg) => this.infer(arg).isScalar);
                    return {
                        kind: ValueKind.Numeric,
                        isScalar: allScalar,
                        reference: null,
                    };
                }
                return { kind: ValueKind.Unknown, isScalar: true, reference: null };
            }
            default:
                return { kind: ValueKind.Unknown, isScalar: true, reference: null };
        }
    }
}
class SemanticVisitor {
    rules;
    services;
    constructor(rules, services) {
        this.rules = rules;
        this.services = services;
    }
    visit(program) {
        if (!program) {
            return;
        }
        const state = {
            statementStack: [],
            expressionStack: [],
            assignmentTargets: new Set(),
            mutatingIdentifiers: new Set(),
            currentStatement: null,
        };
        const context = {
            services: this.services,
            state,
            infer: (expression) => this.services.inferer.infer(expression),
        };
        this.rules.forEach((rule) => rule.enterProgram?.(program, context));
        program.body.forEach((statement) => this.visitStatement(statement, context));
        this.rules.forEach((rule) => rule.exitProgram?.(program, context));
    }
    visitStatement(statement, context) {
        if (!statement) {
            return;
        }
        const { state } = context;
        state.statementStack.push(statement);
        state.currentStatement = statement;
        this.rules.forEach((rule) => rule.enterStatement?.(statement, context));
        switch (statement.type) {
            case 'AssignmentStatement':
                this.visitAssignment(statement, context);
                break;
            case 'IfStatement':
                this.visitIfStatement(statement, context);
                break;
            case 'ForStatement':
                this.visitForStatement(statement, context);
                break;
            case 'WhileStatement':
                this.visitWhileStatement(statement, context);
                break;
            case 'RepeatStatement':
                this.visitRepeatStatement(statement, context);
                break;
            case 'ExpressionStatement':
                this.visitExpression(statement.expression, context);
                break;
            case 'CaseStatement':
                this.visitCaseStatement(statement, context);
                break;
            default:
                break;
        }
        this.rules.forEach((rule) => rule.exitStatement?.(statement, context));
        state.statementStack.pop();
        state.currentStatement = state.statementStack[state.statementStack.length - 1] ?? null;
    }
    visitAssignment(assignment, context) {
        const { state } = context;
        state.assignmentTargets.add(assignment.target);
        const resolver = context.services.resolver;
        const resolved = resolver.resolveAssignmentTarget(assignment.target, assignment.location);
        const mutatingName = resolved?.baseIdentifier.name.toUpperCase() ?? null;
        if (mutatingName) {
            state.mutatingIdentifiers.add(mutatingName);
        }
        this.visitExpression(assignment.target, context);
        this.visitExpression(assignment.value, context);
        state.assignmentTargets.delete(assignment.target);
        if (mutatingName) {
            state.mutatingIdentifiers.delete(mutatingName);
        }
    }
    visitIfStatement(ifStatement, context) {
        this.visitExpression(ifStatement.condition, context);
        ifStatement.thenStatements.forEach((stmt) => this.visitStatement(stmt, context));
        ifStatement.elsifBranches.forEach((branch) => {
            this.visitExpression(branch.condition, context);
            branch.statements.forEach((stmt) => this.visitStatement(stmt, context));
        });
        ifStatement.elseStatements?.forEach((stmt) => this.visitStatement(stmt, context));
    }
    visitForStatement(forStatement, context) {
        const { state } = context;
        state.assignmentTargets.add(forStatement.counter);
        const resolver = context.services.resolver;
        const resolved = resolver.resolveAssignmentTarget(forStatement.counter, forStatement.location);
        const mutatingName = resolved?.baseIdentifier.name.toUpperCase() ?? null;
        if (mutatingName) {
            state.mutatingIdentifiers.add(mutatingName);
        }
        this.visitExpression(forStatement.counter, context);
        this.visitExpression(forStatement.start, context);
        this.visitExpression(forStatement.end, context);
        if (forStatement.step) {
            this.visitExpression(forStatement.step, context);
        }
        forStatement.body.forEach((stmt) => this.visitStatement(stmt, context));
        state.assignmentTargets.delete(forStatement.counter);
        if (mutatingName) {
            state.mutatingIdentifiers.delete(mutatingName);
        }
    }
    visitWhileStatement(whileStatement, context) {
        this.visitExpression(whileStatement.test, context);
        whileStatement.body.forEach((stmt) => this.visitStatement(stmt, context));
    }
    visitRepeatStatement(repeatStatement, context) {
        repeatStatement.body.forEach((stmt) => this.visitStatement(stmt, context));
        this.visitExpression(repeatStatement.test, context);
    }
    visitCaseStatement(caseStatement, context) {
        this.visitExpression(caseStatement.discriminant, context);
        caseStatement.cases.forEach((clause) => {
            clause.values.forEach((value) => {
                if (value.type === 'Literal') {
                    this.visitExpression(value, context);
                }
                else if (value.type === 'CaseRange') {
                    this.visitExpression(value.start, context);
                    this.visitExpression(value.end, context);
                }
            });
            clause.consequent.forEach((stmt) => this.visitStatement(stmt, context));
        });
        caseStatement.defaultCase?.forEach((stmt) => this.visitStatement(stmt, context));
    }
    visitExpression(expression, context) {
        if (!expression) {
            return;
        }
        const { state } = context;
        state.expressionStack.push(expression);
        this.rules.forEach((rule) => rule.enterExpression?.(expression, context));
        switch (expression.type) {
            case 'BinaryExpression': {
                const binary = expression;
                this.visitExpression(binary.left, context);
                this.visitExpression(binary.right, context);
                break;
            }
            case 'UnaryExpression': {
                this.visitExpression(expression.operand, context);
                break;
            }
            case 'IndexedAccessExpression': {
                const indexed = expression;
                this.visitExpression(indexed.target, context);
                this.visitExpression(indexed.index, context);
                break;
            }
            case 'MemberExpression': {
                this.visitExpression(expression.object, context);
                break;
            }
            case 'FunctionCall': {
                const call = expression;
                call.arguments?.forEach((arg) => this.visitExpression(arg, context));
                break;
            }
            default:
                break;
        }
        this.rules.forEach((rule) => rule.exitExpression?.(expression, context));
        state.expressionStack.pop();
    }
}
const mismatchCodeFromMessage = (message) => {
    if (message.includes('TRUE') || message.includes('FALSE')) {
        return DiagnosticCode.BoolNumericMismatch;
    }
    if (message.toLowerCase().includes('boolean')) {
        return DiagnosticCode.BoolAssignmentMismatch;
    }
    return DiagnosticCode.TypeMismatch;
};
function validateIndexBounds(indexExpression, dimension, baseName, diagnostics) {
    if (dimension === undefined || dimension <= 0) {
        return;
    }
    const staticValue = resolveStaticIndexValue(indexExpression);
    if (staticValue === null) {
        return;
    }
    const location = nodeLocation(indexExpression);
    if (!Number.isInteger(staticValue)) {
        diagnostics.error({
            message: `'${baseName}' index must be an integer literal`,
            code: DiagnosticCode.ScalarReferenceRequired,
            location,
        });
        return;
    }
    if (staticValue < 0 || staticValue >= dimension) {
        diagnostics.error({
            message: `'${baseName}' index ${staticValue} is outside declared bounds 0..${dimension - 1}`,
            code: DiagnosticCode.ScalarReferenceRequired,
            location,
        });
    }
}
function enforceStructuredRule(expression, rule, context, resolved) {
    const diagnostics = context.services.diagnostics;
    const location = nodeLocation(expression);
    const allowScalarTag = rule.allowScalarTag ?? true;
    const allowArrayElement = rule.allowArrayElement ?? true;
    const allowArrayReference = rule.allowArrayReference ?? false;
    if (!resolved) {
        diagnostics.error({
            message: rule.message ?? `${rule.label} must reference a ${rule.structuredKind}`,
            code: rule.code ?? DiagnosticCode.StructuredArgument,
            location,
        });
        return;
    }
    const { tag, member, indexCount, dimension, baseIdentifier } = resolved;
    if (!tag.context.dataType || tag.context.dataType.toUpperCase() !== rule.structuredKind) {
        diagnostics.error({
            message: rule.message ?? `${rule.label} must reference a ${rule.structuredKind}`,
            code: rule.code ?? DiagnosticCode.StructuredArgument,
            location,
        });
        return;
    }
    if (member) {
        diagnostics.error({
            message: rule.message ?? `${rule.label} must reference a ${rule.structuredKind} tag, not a member`,
            code: rule.code ?? DiagnosticCode.StructuredArgument,
            location,
        });
        return;
    }
    const isArray = dimension !== undefined;
    if (!isArray) {
        if (!allowScalarTag) {
            diagnostics.error({
                message: rule.message ??
                    `${rule.label} must reference a ${rule.structuredKind} array element, not a scalar tag`,
                code: rule.code ?? DiagnosticCode.StructuredArgument,
                location,
            });
        }
        return;
    }
    if (indexCount === 0) {
        if (!allowArrayReference) {
            diagnostics.error({
                message: rule.scalarMessage ??
                    `${rule.label} cannot reference the entire array. Provide an indexed element.`,
                code: rule.scalarCode ?? DiagnosticCode.ScalarReferenceRequired,
                location,
            });
        }
        return;
    }
    if (!allowArrayElement) {
        diagnostics.error({
            message: rule.scalarMessage ?? `${rule.label} must reference the array tag, not an element access`,
            code: rule.scalarCode ?? DiagnosticCode.ScalarReferenceRequired,
            location,
        });
        return;
    }
    if (indexCount !== 1) {
        diagnostics.error({
            message: `${rule.label} provides ${indexCount} indices but 1 dimension is declared`,
            code: rule.scalarCode ?? DiagnosticCode.ScalarReferenceRequired,
            location,
        });
        return;
    }
    if (resolved.indices[0]) {
        validateIndexBounds(resolved.indices[0], dimension, baseIdentifier.name, diagnostics);
    }
}
const tagDimensionsMismatch = (resolved, diagnostics) => {
    const { indices, dimension, baseIdentifier } = resolved;
    const declaredDimensions = dimension !== undefined ? 1 : 0;
    if (indices.length > declaredDimensions) {
        diagnostics.error({
            message: `Tag '${baseIdentifier.name}' is accessed with ${indices.length} indices but only ${declaredDimensions} dimension(s) are declared`,
            code: DiagnosticCode.ScalarReferenceRequired,
            location: nodeLocation(baseIdentifier),
        });
    }
};
const ensureArrayAccessIsValid = (resolved, diagnostics) => {
    if (!resolved) {
        return;
    }
    const metadata = resolved.tag.context;
    if (metadata.dimension === undefined) {
        diagnostics.error({
            message: `Tag '${resolved.baseIdentifier.name}' is not declared as an array`,
            code: DiagnosticCode.ScalarReferenceRequired,
            location: nodeLocation(resolved.baseIdentifier),
        });
        return;
    }
    tagDimensionsMismatch(resolved, diagnostics);
};
const ensureIndexExpressionIsNumericScalar = (indexExpression, arrayName, context) => {
    const inferred = context.infer(indexExpression);
    if (inferred.kind !== ValueKind.Unknown && !matchValueKind(inferred.kind, ValueKind.Numeric)) {
        context.services.diagnostics.error({
            message: `'${arrayName}' index must evaluate to a numeric value`,
            code: DiagnosticCode.TypeMismatch,
            location: nodeLocation(indexExpression),
        });
    }
    if (!inferred.isScalar) {
        context.services.diagnostics.error({
            message: `'${arrayName}' index must reference a scalar value, not an array`,
            code: DiagnosticCode.ScalarReferenceRequired,
            location: nodeLocation(indexExpression),
        });
    }
};
const isAssignmentStatement = (statement) => Boolean(statement) && statement.type === 'AssignmentStatement';
const formatTargetName = (target) => {
    if (target.type === 'Identifier') {
        return target.name;
    }
    if (target.type === 'MemberExpression') {
        const base = formatTargetName(target.object);
        const property = target.property.name;
        return base ? `${base}.${property}` : property;
    }
    if (target.type === 'IndexedAccessExpression') {
        return formatTargetName(target.target);
    }
    return null;
};
const describeExpressionName = (expression) => {
    if (isIdentifierNode(expression)) {
        return expression.name;
    }
    if (isMemberExpressionNode(expression) || isIndexedExpressionNode(expression)) {
        return formatTargetName(expression);
    }
    return null;
};
const buildTimerInvocationKey = (resolved) => {
    const baseName = resolved.baseIdentifier.name.toUpperCase();
    if (resolved.indexCount === 0) {
        return baseName;
    }
    const indices = resolved.indices
        .map((index) => {
        const staticValue = resolveStaticIndexValue(index);
        if (staticValue !== null) {
            return String(staticValue);
        }
        return describeExpressionName(index) ?? index.type;
    })
        .join(',');
    return `${baseName}[${indices}]`;
};
const isTimerInstructionName = (name) => name === 'TONR' || name === 'TOFR' || name === 'RTOR';
const warnOnRepeatedTimerInvocation = (call, name, context, firstTimerInvocationLocations) => {
    if (!isTimerInstructionName(name)) {
        return;
    }
    const argument = call.arguments?.[0];
    if (!argument) {
        return;
    }
    const resolved = context.services.resolver.resolveExpression(argument);
    if (!resolved || resolved.tag.kind !== ValueKind.Timer) {
        return;
    }
    const isScalarTimer = resolved.dimension === undefined;
    const isIndexedTimerElement = resolved.dimension !== undefined && resolved.indexCount > 0;
    if (!isScalarTimer && !isIndexedTimerElement) {
        return;
    }
    const invocationKey = `${name}:${buildTimerInvocationKey(resolved)}`;
    const firstLocation = firstTimerInvocationLocations.get(invocationKey);
    if (!firstLocation) {
        firstTimerInvocationLocations.set(invocationKey, nodeLocation(call));
        return;
    }
    context.services.diagnostics.warning({
        message: `${name} called multiple times for timer '${buildTimerInvocationKey(resolved)}'`,
        code: DiagnosticCode.RepeatedTimerInvocation,
        location: nodeLocation(call),
    });
};
const extractNumericLiteralValue = (expression) => {
    if (expression.type !== 'Literal') {
        return null;
    }
    const literal = expression;
    if ((literal.dataType === 'DINT' ||
        literal.dataType === 'REAL' ||
        typeof literal.value === 'number') &&
        typeof literal.value === 'number') {
        return literal.value;
    }
    return null;
};
const isBooleanLiteral = (expression) => expression.type === 'Literal' && expression.dataType === 'BOOL';
const kindToDataType = (kind) => {
    switch (kind) {
        case ValueKind.Bool:
            return 'BOOL';
        case ValueKind.Integer:
        case ValueKind.Numeric:
            return 'DINT';
        case ValueKind.Timer:
            return 'FBD_TIMER';
        case ValueKind.Counter:
            return 'FBD_COUNTER';
        default:
            return undefined;
    }
};
const inferExpectedDataType = (expression, context) => {
    const { expressionStack, currentStatement } = context.state;
    for (let i = expressionStack.length - 1; i >= 0; i--) {
        const ancestor = expressionStack[i];
        if (ancestor.type === 'FunctionCall') {
            const call = ancestor;
            const argIndex = call.arguments?.indexOf(expression) ?? -1;
            if (argIndex >= 0) {
                const name = call.name?.name?.toUpperCase();
                if (name) {
                    const instruction = getInstruction(name);
                    if (instruction) {
                        return instruction.params[argIndex]?.dataTypes[0];
                    }
                }
            }
            break;
        }
    }
    if (currentStatement?.type === 'AssignmentStatement') {
        const assignment = currentStatement;
        const resolved = context.services.resolver.resolveAssignmentTarget(assignment.target, assignment.location);
        if (resolved) {
            return resolved.tag.context.dataType;
        }
    }
    const parentExpression = expressionStack.length >= 2
        ? expressionStack[expressionStack.length - 2]
        : undefined;
    if (parentExpression?.type === 'BinaryExpression') {
        const binary = parentExpression;
        const op = binary.operator.toUpperCase();
        if (['AND', 'OR', 'XOR'].includes(op))
            return 'BOOL';
        if (['+', '-', '*', '/', 'MOD'].includes(op))
            return 'DINT';
        if (['=', '<>', '<', '<=', '>', '>='].includes(op)) {
            const otherSide = binary.left === expression ? binary.right : binary.left;
            const otherKind = context.infer(otherSide).kind;
            return kindToDataType(otherKind) ?? 'DINT';
        }
    }
    if (parentExpression?.type === 'UnaryExpression') {
        if (parentExpression.operator === 'NOT')
            return 'BOOL';
    }
    const isConditionStatement = currentStatement?.type === 'IfStatement' ||
        currentStatement?.type === 'WhileStatement' ||
        currentStatement?.type === 'RepeatStatement';
    if (isConditionStatement && !parentExpression) {
        return 'BOOL';
    }
    if (currentStatement?.type === 'ForStatement') {
        return 'DINT';
    }
    return undefined;
};
const createAssignmentRule = () => ({
    name: 'assignment-validation',
    enterStatement(statement, context) {
        if (!isAssignmentStatement(statement)) {
            return;
        }
        const diagnostics = context.services.diagnostics;
        const resolver = context.services.resolver;
        const targetExpression = statement.target;
        const expressionResolved = resolver.resolveExpression(targetExpression);
        const assignmentTarget = resolver.resolveAssignmentTarget(statement.target, statement.location);
        const valueType = context.infer(statement.value);
        if (targetExpression.type === 'IndexedAccessExpression') {
            ensureArrayAccessIsValid(resolver.resolveExpression(targetExpression), diagnostics);
        }
        if (!assignmentTarget) {
            if (context.services.compilation.tags && context.services.compilation.tags.length > 0) {
                diagnostics.error({
                    message: `Tag '${formatTargetName(statement.target) ?? 'unknown'}' is not defined`,
                    code: DiagnosticCode.TagUndefined,
                    location: nodeLocation(targetExpression),
                    expectedDataType: kindToDataType(valueType.kind),
                });
            }
            return;
        }
        const targetDimension = assignmentTarget.tag.context.dimension;
        if (targetDimension !== undefined && assignmentTarget.indexCount === 0) {
            const baseName = assignmentTarget.baseIdentifier.name;
            diagnostics.error({
                message: `Cannot assign to array tag '${baseName}' without an index. Arrays require indexed assignments (e.g., ${baseName}[0] := value)`,
                code: DiagnosticCode.ScalarReferenceRequired,
                location: nodeLocation(assignmentTarget.baseIdentifier),
            });
            return;
        }
        const memberInfo = expressionResolved?.member?.info ?? null;
        const memberName = expressionResolved?.member?.name ?? null;
        const baseName = assignmentTarget.baseIdentifier.name;
        const displayName = memberName ? `${baseName}.${memberName}` : baseName;
        const targetDataType = (memberInfo?.dataType ?? assignmentTarget.tag.context.dataType)?.toUpperCase();
        const expectedKind = memberInfo?.kind ?? (targetDataType ? kindFromTagType(targetDataType) : ValueKind.Unknown);
        const targetLocation = nodeLocation(statement.value);
        if (targetDataType === 'BOOL') {
            const numericLiteral = extractNumericLiteralValue(statement.value);
            if (numericLiteral !== null) {
                if (!Number.isInteger(numericLiteral)) {
                    diagnostics.error({
                        message: `Cannot assign non-integer numeric value '${numericLiteral}' to BOOL tag '${displayName}'. BOOL tags accept only TRUE, FALSE, 0, or 1`,
                        code: DiagnosticCode.BoolNumericMismatch,
                        location: targetLocation,
                    });
                    return;
                }
                if (numericLiteral > 1) {
                    diagnostics.error({
                        message: `Cannot assign numeric value '${numericLiteral}' to BOOL tag '${displayName}'. BOOL tags accept only TRUE, FALSE, 0, or 1`,
                        code: DiagnosticCode.BoolNumericMismatch,
                        location: targetLocation,
                    });
                    return;
                }
            }
            return;
        }
        if (isBooleanLiteral(statement.value)) {
            const literal = statement.value;
            const assignedValue = literal.value ? 'TRUE' : 'FALSE';
            diagnostics.error({
                message: `Cannot assign boolean value '${assignedValue}' to ${targetDataType ?? 'unknown'} tag '${displayName}'. Use 1 or 0 instead`,
                code: DiagnosticCode.BoolAssignmentMismatch,
                location: targetLocation,
            });
            return;
        }
        if (expectedKind !== ValueKind.Unknown && valueType.kind !== ValueKind.Unknown) {
            if (!matchValueKind(valueType.kind, expectedKind)) {
                const expectedDescription = describeValueKind(expectedKind);
                const actualDescription = describeValueKind(valueType.kind);
                const message = `Cannot assign value of kind ${actualDescription} to ${expectedDescription}`;
                diagnostics.error({
                    message,
                    code: mismatchCodeFromMessage(message),
                    location: targetLocation,
                });
            }
        }
    },
});
const isIdentifierExpression = (expression) => expression.type === 'Identifier';
const isValidTagName = (name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !name.includes(' ');
const createIdentifierRule = () => ({
    name: 'identifier-validation',
    enterExpression(expression, context) {
        if (!isIdentifierExpression(expression)) {
            return;
        }
        const name = expression.name;
        const upperName = name.toUpperCase();
        if (BUILTIN_FUNCTIONS.has(upperName)) {
            return;
        }
        if (RESERVED_KEYWORDS.has(upperName)) {
            context.services.diagnostics.error({
                message: `Reserved keyword '${name}' cannot be used as tag name`,
                code: DiagnosticCode.ReservedKeyword,
                node: expression,
            });
            return;
        }
        if (!isValidTagName(name)) {
            context.services.diagnostics.error({
                message: `Invalid tag name '${name}' - contains invalid characters`,
                code: DiagnosticCode.InvalidTagName,
                node: expression,
            });
            return;
        }
        if (context.services.compilation.tags) {
            const resolved = context.services.resolver.resolveExpression(expression);
            if (!resolved) {
                context.services.diagnostics.error({
                    message: `Tag '${name}' is not defined`,
                    code: DiagnosticCode.TagUndefined,
                    node: expression,
                    expectedDataType: inferExpectedDataType(expression, context),
                });
            }
        }
    },
});
const CASE_NUMERIC_TYPES = new Set(['DINT', 'REAL', 'INT', 'SINT']);
const validateCaseLiteral = (literal, context) => {
    if (literal.dataType && CASE_NUMERIC_TYPES.has(literal.dataType)) {
        return;
    }
    context.services.diagnostics.error({
        message: 'CASE selector values must be numerical',
        code: DiagnosticCode.TypeMismatch,
        location: nodeLocation(literal),
    });
};
const validateCaseDiscriminant = (caseStatement, context) => {
    const discriminant = caseStatement.discriminant;
    if (discriminant.type === 'Identifier') {
        const identifier = discriminant;
        const resolved = context.services.resolver.resolveExpression(identifier);
        const tagType = resolved?.tag.context.dataType;
        if (!tagType) {
            return;
        }
        const normalizedType = tagType.toUpperCase();
        if (!CASE_NUMERIC_TYPES.has(normalizedType)) {
            context.services.diagnostics.error({
                message: `CASE numeric_expression '${identifier.name}' cannot be of type ${tagType}.`,
                code: DiagnosticCode.TypeMismatch,
                location: nodeLocation(identifier),
            });
        }
        return;
    }
    const inferred = context.infer(discriminant);
    if (inferred.kind !== ValueKind.Unknown && !matchValueKind(inferred.kind, ValueKind.Numeric)) {
        context.services.diagnostics.error({
            message: `CASE numeric_expression must evaluate to a numeric value. Found ${describeValueKind(inferred.kind)}.`,
            code: DiagnosticCode.TypeMismatch,
            location: nodeLocation(discriminant),
        });
    }
};
const requireBooleanScalar = (label, expression, context) => {
    const inferred = context.infer(expression);
    const allowsNumericLiteralBool = (inferred.kind === ValueKind.Integer || inferred.kind === ValueKind.Numeric) &&
        isBooleanCoercibleNumericLiteral(expression);
    if (inferred.kind !== ValueKind.Bool &&
        inferred.kind !== ValueKind.Unknown &&
        !allowsNumericLiteralBool) {
        context.services.diagnostics.error({
            message: `${label} must evaluate to a BOOL value. Found ${describeValueKind(inferred.kind)}.`,
            code: DiagnosticCode.TypeMismatch,
            location: nodeLocation(expression),
        });
    }
    if (!inferred.isScalar) {
        context.services.diagnostics.error({
            message: `${label} must reference a scalar value, not an entire array`,
            code: DiagnosticCode.ScalarReferenceRequired,
            location: nodeLocation(expression),
        });
    }
};
const requireNumericScalar = (label, expression, context) => {
    const inferred = context.infer(expression);
    if (inferred.kind !== ValueKind.Unknown && !matchValueKind(inferred.kind, ValueKind.Numeric)) {
        context.services.diagnostics.error({
            message: `${label} must evaluate to a numeric value. Found ${describeValueKind(inferred.kind)}.`,
            code: DiagnosticCode.TypeMismatch,
            location: nodeLocation(expression),
        });
    }
    if (!inferred.isScalar) {
        context.services.diagnostics.error({
            message: `${label} must reference a scalar value, not an entire array`,
            code: DiagnosticCode.ScalarReferenceRequired,
            location: nodeLocation(expression),
        });
    }
};
const validateForCounter = (forStatement, context) => {
    const resolved = context.services.resolver.resolveAssignmentTarget(forStatement.counter, forStatement.location);
    if (!resolved) {
        return;
    }
    const tagType = resolved.tag.context.dataType;
    if (tagType && !['DINT', 'INT', 'SINT'].includes(tagType.toUpperCase())) {
        context.services.diagnostics.error({
            message: `FOR loop counter must be a DINT, INT, or SINT tag. Found ${tagType}.`,
            code: DiagnosticCode.TypeMismatch,
            location: nodeLocation(forStatement.counter),
        });
    }
    const dimension = resolved.tag.context.dimension;
    if (dimension !== undefined && resolved.indexCount === 0) {
        context.services.diagnostics.error({
            message: `FOR loop counter cannot reference array tag '${resolved.baseIdentifier.name}' without an index.`,
            code: DiagnosticCode.ScalarReferenceRequired,
            location: nodeLocation(resolved.baseIdentifier),
        });
    }
};
const validateCaseClauseLiterals = (clause, context) => {
    clause.values.forEach((value) => {
        if (value.type === 'Literal') {
            validateCaseLiteral(value, context);
        }
        else if (value.type === 'CaseRange') {
            validateCaseLiteral(value.start, context);
            validateCaseLiteral(value.end, context);
        }
    });
};
const createControlFlowRule = () => ({
    name: 'control-flow-validation',
    enterStatement(statement, context) {
        if (statement.type === 'IfStatement') {
            requireBooleanScalar('IF condition', statement.condition, context);
            statement.elsifBranches.forEach((branch) => {
                requireBooleanScalar('ELSIF condition', branch.condition, context);
            });
            return;
        }
        if (statement.type === 'WhileStatement') {
            requireBooleanScalar('WHILE loop condition', statement.test, context);
            return;
        }
        if (statement.type === 'RepeatStatement') {
            requireBooleanScalar('REPEAT loop condition', statement.test, context);
            return;
        }
        if (statement.type === 'ForStatement') {
            const forStmt = statement;
            validateForCounter(forStmt, context);
            requireNumericScalar('FOR loop start expression', forStmt.start, context);
            requireNumericScalar('FOR loop end expression', forStmt.end, context);
            if (forStmt.step) {
                requireNumericScalar('FOR loop step expression', forStmt.step, context);
            }
            return;
        }
        if (statement.type === 'CaseStatement') {
            const caseStmt = statement;
            validateCaseDiscriminant(caseStmt, context);
            caseStmt.cases.forEach((clause) => validateCaseClauseLiterals(clause, context));
        }
    },
});
const isExpressionStatementNode = (statement) => Boolean(statement && statement.type === 'ExpressionStatement');
const createFunctionRule = () => {
    const firstTimerInvocationLocations = new Map();
    return {
        name: 'function-validation',
        enterProgram() {
            firstTimerInvocationLocations.clear();
        },
        enterExpression(expression, context) {
            if (expression.type !== 'FunctionCall') {
                return;
            }
            const call = expression;
            const name = call.name?.name?.toUpperCase();
            if (!name) {
                return;
            }
            let knownFunctions = knownFunctionsCache.get(context.services.compilation);
            if (!knownFunctions) {
                knownFunctions = new Set(BUILTIN_FUNCTIONS);
                context.services.compilation.functions?.forEach((fn) => {
                    if (fn.name) {
                        knownFunctions.add(fn.name.toUpperCase());
                    }
                });
                knownFunctionsCache.set(context.services.compilation, knownFunctions);
            }
            if (!knownFunctions.has(name)) {
                context.services.diagnostics.error({
                    message: `'${call.name?.name ?? name}' instruction is not defined`,
                    code: DiagnosticCode.UnknownInstruction,
                    location: nodeLocation(call.name),
                });
            }
            const instructionDef = getInstruction(name);
            const firstParamType = instructionDef?.params[0]?.dataTypes[0];
            const structuredKind = firstParamType === 'FBD_TIMER' || firstParamType === 'FBD_COUNTER' ? firstParamType : null;
            if (name === 'SIZE') {
                if (!isExpressionStatementNode(context.state.currentStatement)) {
                    context.services.diagnostics.error({
                        message: `'${name}' instruction does not return a value and cannot be used in expressions`,
                        code: DiagnosticCode.StatementOnlyFunction,
                        location: nodeLocation(call),
                    });
                }
                validateSizeInvocation(call, context);
                return;
            }
            if (STATEMENT_ONLY_FUNCTIONS.has(name)) {
                if (!isExpressionStatementNode(context.state.currentStatement)) {
                    context.services.diagnostics.error({
                        message: `'${name}' instruction does not return a value and cannot be used in expressions`,
                        code: DiagnosticCode.StatementOnlyFunction,
                        location: nodeLocation(call),
                    });
                }
                if (structuredKind) {
                    validateStructuredInstructionCall(call, name, structuredKind, context);
                    warnOnRepeatedTimerInvocation(call, name, context, firstTimerInvocationLocations);
                }
                return;
            }
            if (RETURNING_MATH_FUNCTIONS.has(name) &&
                isExpressionStatementNode(context.state.currentStatement)) {
                context.services.diagnostics.error({
                    message: `Function '${name}' returns a value and cannot be used as a standalone statement. Use assignment: result := ${name}(...)`,
                    code: DiagnosticCode.ReturnValueMisuse,
                    location: nodeLocation(call),
                });
            }
            if (structuredKind) {
                validateStructuredInstructionCall(call, name, structuredKind, context);
            }
        },
    };
};
const isBinaryExpression = (expression) => expression.type === 'BinaryExpression';
const createBinaryOperatorRule = () => ({
    name: 'binary-operator-validation',
    enterExpression(expression, context) {
        if (!isBinaryExpression(expression)) {
            return;
        }
        const operator = expression.operator.toUpperCase();
        if (operator === 'MOD') {
            const left = context.infer(expression.left);
            const right = context.infer(expression.right);
            if (left.kind !== ValueKind.Unknown && left.kind !== ValueKind.Integer) {
                context.services.diagnostics.error({
                    message: 'MOD operator requires integer operands',
                    code: DiagnosticCode.TypeMismatch,
                    location: nodeLocation(expression.left),
                });
            }
            if (right.kind !== ValueKind.Unknown && right.kind !== ValueKind.Integer) {
                context.services.diagnostics.error({
                    message: 'MOD operator requires integer operands',
                    code: DiagnosticCode.TypeMismatch,
                    location: nodeLocation(expression.right),
                });
            }
        }
        if (operator === 'AND' || operator === 'OR' || operator === 'XOR') {
            const left = context.infer(expression.left);
            const right = context.infer(expression.right);
            const leftIsBoolLike = left.kind === ValueKind.Bool ||
                (left.kind !== ValueKind.Unknown && isBooleanCoercibleNumericLiteral(expression.left));
            const rightIsBoolLike = right.kind === ValueKind.Bool ||
                (right.kind !== ValueKind.Unknown && isBooleanCoercibleNumericLiteral(expression.right));
            if (left.kind !== ValueKind.Unknown && !leftIsBoolLike) {
                context.services.diagnostics.error({
                    message: `${operator} operator requires BOOL operands`,
                    code: DiagnosticCode.TypeMismatch,
                    location: nodeLocation(expression.left),
                });
            }
            if (right.kind !== ValueKind.Unknown && !rightIsBoolLike) {
                context.services.diagnostics.error({
                    message: `${operator} operator requires BOOL operands`,
                    code: DiagnosticCode.TypeMismatch,
                    location: nodeLocation(expression.right),
                });
            }
        }
        if (operator === '/') {
            if (expression.right.type === 'Literal') {
                const literal = expression.right;
                if (literal.value === 0) {
                    context.services.diagnostics.warning({
                        message: 'Division by zero detected',
                        code: DiagnosticCode.UnknownError,
                        location: nodeLocation(expression),
                    });
                }
            }
        }
        if (['=', '<>', '<', '<=', '>', '>='].includes(operator)) {
            const left = context.infer(expression.left);
            const right = context.infer(expression.right);
            if (left.kind !== ValueKind.Unknown && !matchValueKind(left.kind, ValueKind.Numeric)) {
                context.services.diagnostics.error({
                    message: `Relational operator '${expression.operator}' requires numeric operands. Found ${describeValueKind(left.kind)}`,
                    code: DiagnosticCode.TypeMismatch,
                    location: nodeLocation(expression.left),
                });
            }
            if (right.kind !== ValueKind.Unknown && !matchValueKind(right.kind, ValueKind.Numeric)) {
                context.services.diagnostics.error({
                    message: `Relational operator '${expression.operator}' requires numeric operands. Found ${describeValueKind(right.kind)}`,
                    code: DiagnosticCode.TypeMismatch,
                    location: nodeLocation(expression.right),
                });
            }
        }
    },
});
const isExpressionStatement = (statement) => Boolean(statement) && statement.type === 'ExpressionStatement';
const isMemberExpression = (expression) => expression.type === 'MemberExpression';
const createExpressionStatementRule = () => ({
    name: 'expression-statement-validation',
    exitExpression(expression, context) {
        const currentStatement = context.state.currentStatement;
        if (!isExpressionStatement(currentStatement)) {
            return;
        }
        if (currentStatement.expression !== expression) {
            return;
        }
        if (isIdentifierExpression(expression)) {
            const upper = expression.name.toUpperCase();
            if (context.state.mutatingIdentifiers.has(upper)) {
                return;
            }
            const resolved = context.services.resolver.resolveExpression(expression);
            if (!resolved) {
                return;
            }
            context.services.diagnostics.error({
                message: `${expression.name} is read-only in expressions. Use an assignment to write values.`,
                code: DiagnosticCode.AssignmentReadOnly,
                node: expression,
            });
            return;
        }
        if (isMemberExpression(expression)) {
            const resolved = context.services.resolver.resolveExpression(expression);
            if (!resolved) {
                return;
            }
            const baseUpper = resolved.baseIdentifier.name.toUpperCase();
            if (context.state.mutatingIdentifiers.has(baseUpper)) {
                return;
            }
            if (!resolved.member?.info) {
                return;
            }
            context.services.diagnostics.error({
                message: `${resolved.baseIdentifier.name}.${expression.property.name} is read-only in expressions. Use an assignment to write values.`,
                code: DiagnosticCode.AssignmentReadOnly,
                node: expression.property,
            });
        }
    },
});
const createStructuredMemberRule = () => ({
    name: 'structured-member-validation',
    enterExpression(expression, context) {
        if (!isMemberExpression(expression)) {
            return;
        }
        const resolved = context.services.resolver.resolveExpression(expression);
        if (!resolved) {
            return;
        }
        const schemaType = resolved.tag.context.dataType;
        if (resolved.tag.schema === null) {
            context.services.diagnostics.error({
                message: `Member access requires structured data. '${resolved.baseIdentifier.name}' is declared as ${schemaType || 'scalar'}, not a structured type`,
                code: DiagnosticCode.StructuredMemberInvalid,
                location: nodeLocation(expression.property),
            });
            return;
        }
        const memberInfo = resolved.member?.info;
        if (!memberInfo) {
            context.services.diagnostics.error({
                message: `${resolved.baseIdentifier.name}.${expression.property.name} is not a valid member of ${schemaType}`,
                code: DiagnosticCode.StructuredMemberInvalid,
                location: nodeLocation(expression.property),
            });
        }
    },
});
const isIndexedAccessExpression = (expression) => expression.type === 'IndexedAccessExpression';
const createIndexedAccessRule = () => ({
    name: 'indexed-access-validation',
    enterExpression(expression, context) {
        if (!isIndexedAccessExpression(expression)) {
            return;
        }
        const resolved = context.services.resolver.resolveExpression(expression);
        if (!resolved) {
            if (context.services.compilation.tags && context.services.compilation.tags.length > 0) {
                context.services.diagnostics.error({
                    message: `Tag '${describeExpressionName(expression.target) ?? 'unknown'}' is not defined`,
                    code: DiagnosticCode.TagUndefined,
                    location: nodeLocation(expression),
                });
            }
            return;
        }
        ensureArrayAccessIsValid(resolved, context.services.diagnostics);
        resolved.indices.forEach((indexExpr) => ensureIndexExpressionIsNumericScalar(indexExpr, resolved.baseIdentifier.name, context));
        if (resolved.indices[0]) {
            validateIndexBounds(resolved.indices[0], resolved.dimension, resolved.baseIdentifier.name, context.services.diagnostics);
        }
    },
});
const validateStructuredInstructionCall = (call, instruction, structuredKind, context) => {
    const args = call.arguments ?? [];
    const diagnostics = context.services.diagnostics;
    if (args.length !== 1) {
        diagnostics.error({
            message: `${instruction} expects a single ${structuredKind} argument`,
            code: DiagnosticCode.ArityMismatch,
            location: nodeLocation(call),
        });
        return;
    }
    const argument = args[0];
    const resolved = context.services.resolver.resolveExpression(argument);
    enforceStructuredRule(argument, {
        label: `${instruction} argument`,
        structuredKind,
        allowScalarTag: true,
        allowArrayElement: true,
        allowArrayReference: false,
        code: DiagnosticCode.StructuredArgument,
        scalarCode: DiagnosticCode.ScalarReferenceRequired,
    }, context, resolved);
};
const literalEquals = (expression, value) => {
    if (expression.type !== 'Literal') {
        return false;
    }
    const literal = expression;
    if (typeof literal.value === 'number') {
        return literal.value === value;
    }
    if (typeof literal.value === 'string') {
        return Number(literal.value) === value;
    }
    return false;
};
const validateSizeArrayArgument = (expression, context) => {
    const diagnostics = context.services.diagnostics;
    const resolved = context.services.resolver.resolveExpression(expression);
    if (!resolved) {
        diagnostics.error({
            message: 'SIZE array argument must reference an array tag',
            code: DiagnosticCode.ScalarReferenceRequired,
            location: nodeLocation(expression),
        });
        return;
    }
    if (resolved.isIndexed) {
        diagnostics.error({
            message: 'SIZE array argument must reference an array tag, not an element access',
            code: DiagnosticCode.ScalarReferenceRequired,
            location: nodeLocation(expression),
        });
        return;
    }
    const metadata = resolved.tag.context;
    if (metadata.dimension === undefined) {
        diagnostics.error({
            message: `SIZE expects an array tag, but '${resolved.baseIdentifier.name}' is declared as scalar`,
            code: DiagnosticCode.ScalarReferenceRequired,
            location: nodeLocation(resolved.baseIdentifier),
        });
    }
};
const validateSizeDestinationArgument = (expression, context) => {
    const diagnostics = context.services.diagnostics;
    const resolved = context.services.resolver.resolveExpression(expression);
    if (!resolved) {
        diagnostics.error({
            message: 'SIZE destination argument must reference a DINT tag or array element',
            code: DiagnosticCode.StructuredArgument,
            location: nodeLocation(expression),
        });
        return;
    }
    const tagType = resolved.tag.context.dataType?.toUpperCase();
    if (tagType && tagType !== 'DINT') {
        diagnostics.error({
            message: `SIZE destination must be a DINT tag, but '${resolved.baseIdentifier.name}' is ${tagType}`,
            code: DiagnosticCode.StructuredArgument,
            location: nodeLocation(resolved.baseIdentifier),
        });
        return;
    }
    const metadata = resolved.tag.context;
    const dimension = metadata.dimension;
    if (resolved.indexCount === 0) {
        if (dimension !== undefined) {
            diagnostics.error({
                message: `SIZE destination tag '${resolved.baseIdentifier.name}' cannot reference the entire array. Provide a DINT scalar or array element`,
                code: DiagnosticCode.StructuredArgument,
                location: nodeLocation(resolved.baseIdentifier),
            });
        }
        return;
    }
    if (dimension === undefined) {
        diagnostics.error({
            message: `SIZE destination indexes '${resolved.baseIdentifier.name}', but it is not declared as an array`,
            code: DiagnosticCode.ScalarReferenceRequired,
            location: nodeLocation(expression),
        });
        return;
    }
    if (resolved.indexCount !== 1) {
        diagnostics.error({
            message: `SIZE destination provides ${resolved.indexCount} indices for '${resolved.baseIdentifier.name}', but 1 dimension is declared`,
            code: DiagnosticCode.ScalarReferenceRequired,
            location: nodeLocation(expression),
        });
        return;
    }
    if (expression.type === 'IndexedAccessExpression' && resolved.indices[0]) {
        validateIndexBounds(resolved.indices[0], dimension, resolved.baseIdentifier.name, diagnostics);
    }
};
const validateSizeInvocation = (call, context) => {
    const args = call.arguments ?? [];
    const diagnostics = context.services.diagnostics;
    if (args.length !== 3) {
        diagnostics.error({
            message: 'SIZE expects three arguments: array tag, dimension, and destination tag',
            code: DiagnosticCode.ArityMismatch,
            location: nodeLocation(call),
        });
        return;
    }
    const [arrayArg, dimensionArg, destinationArg] = args;
    validateSizeArrayArgument(arrayArg, context);
    if (!literalEquals(dimensionArg, 0)) {
        diagnostics.error({
            message: 'SIZE dimension argument must be the literal 0',
            code: DiagnosticCode.StructuredArgument,
            location: nodeLocation(dimensionArg),
        });
    }
    validateSizeDestinationArgument(destinationArg, context);
};
const createDefaultRules = () => [
    createIdentifierRule(),
    createStructuredMemberRule(),
    createIndexedAccessRule(),
    createAssignmentRule(),
    createControlFlowRule(),
    createFunctionRule(),
    createBinaryOperatorRule(),
    createExpressionStatementRule(),
];
export class SemanticAnalyzer {
    context;
    sourceCode;
    constructor(context = {}, sourceCode) {
        this.context = context;
        this.sourceCode = sourceCode;
    }
    analyze(program) {
        const diagnostics = [];
        const resolver = new TagResolver(this.context, this.sourceCode);
        const inferer = new ExpressionTypeInferer(resolver);
        const services = {
            diagnostics: new DiagnosticsBuilder(diagnostics),
            resolver,
            inferer,
            compilation: this.context,
        };
        const visitor = new SemanticVisitor(createDefaultRules(), services);
        visitor.visit(program);
        return diagnostics;
    }
}
