import { OUTPUT_INSTRUCTIONS } from '../ast/types.js';
import { getInstruction, getMembersForDataType } from '../../../core/index.js';
const LDCompilationDiagnosticCode = {
    TagUndefined: 'LD-SEM-001',
    ParamCountMismatch: 'LD-SEM-002',
    TypeMismatch: 'LD-SEM-003',
    InputTagWrite: 'LD-SEM-004',
    EmptyParameter: 'LD-SEM-005',
    ArrayIndexRequired: 'LD-SEM-006',
    NumericLiteralNotAllowed: 'LD-SEM-007',
    TypeCompatibilityMismatch: 'LD-SEM-008',
    DivisionByZero: 'LD-SEM-009',
    MissingOutput: 'LD-SEM-010',
    RepeatedTimerInvocation: 'LD-SEM-011',
};
function getTypeCategory(dataType) {
    switch (dataType.toUpperCase()) {
        case 'BOOL':
            return 'boolean';
        case 'DINT':
        case 'REAL':
            return 'numeric';
        case 'TIMER':
        case 'FBD_TIMER':
            return 'timer';
        case 'COUNTER':
        case 'FBD_COUNTER':
            return 'counter';
        default:
            return 'unknown';
    }
}
class TagResolver {
    tagMap = new Map();
    hasContext;
    constructor(compilationContext = {}) {
        this.hasContext = compilationContext.tags !== undefined;
        if (compilationContext.tags) {
            compilationContext.tags.forEach((tag) => {
                const upper = tag.name.toUpperCase();
                this.tagMap.set(upper, {
                    context: tag,
                    dataType: tag.dataType?.toUpperCase() ?? 'UNKNOWN',
                    isArray: tag.dimension !== undefined,
                    dimension: tag.dimension,
                    usage: tag.usage,
                });
            });
        }
    }
    resolve(name) {
        return this.tagMap.get(name.toUpperCase()) ?? null;
    }
    shouldValidateTags() {
        return this.hasContext;
    }
}
function extractBaseName(param) {
    switch (param.type) {
        case 'LDTagReference':
            return param.name;
        case 'LDMemberAccess':
            return extractBaseName(param.object);
        case 'LDIndexedAccess':
            return extractBaseName(param.target);
        case 'LDNumericLiteral':
            return null;
    }
}
function parseBitIndex(member) {
    if (!/^\d+$/.test(member))
        return null;
    const index = Number(member);
    return Number.isInteger(index) ? index : null;
}
function formatTimerParameterKey(param) {
    switch (param.type) {
        case 'LDTagReference':
            return param.name.toUpperCase();
        case 'LDNumericLiteral':
            return String(param.value);
        case 'LDMemberAccess': {
            const objectKey = formatTimerParameterKey(param.object);
            if (!objectKey)
                return null;
            return `${objectKey}.${param.member.toUpperCase()}`;
        }
        case 'LDIndexedAccess': {
            const targetKey = formatTimerParameterKey(param.target);
            const indexKey = formatTimerParameterKey(param.index);
            if (!targetKey || !indexKey)
                return null;
            return `${targetKey}[${indexKey}]`;
        }
    }
}
export class LDSemanticAnalyzer {
    resolver;
    diagnostics = [];
    currentRung = 0;
    currentElement = 0;
    seenTimerInvocations = new Set();
    constructor(context = {}) {
        this.resolver = new TagResolver(context);
    }
    analyze(program) {
        if (!program)
            return this.diagnostics;
        this.seenTimerInvocations.clear();
        for (const rung of program.rungs) {
            this.currentRung = rung.index;
            this.currentElement = 0;
            this.analyzeRung(rung);
        }
        return this.diagnostics;
    }
    analyzeRung(rung) {
        if (rung.circuit.elements.length > 0 && !this.circuitHasOutput(rung.circuit)) {
            this.addDiagnostic('Missing output instruction', LDCompilationDiagnosticCode.MissingOutput);
        }
        this.analyzeCircuit(rung.circuit);
    }
    circuitHasOutput(circuit) {
        for (const element of circuit.elements) {
            if (element.type === 'LDBranch') {
                for (const branchCircuit of element.circuits) {
                    if (this.circuitHasOutput(branchCircuit))
                        return true;
                }
            }
            else if (OUTPUT_INSTRUCTIONS.includes(element.instructionType)) {
                return true;
            }
        }
        return false;
    }
    analyzeCircuit(circuit) {
        for (const element of circuit.elements) {
            this.analyzeElement(element);
        }
    }
    analyzeElement(element) {
        if (element.type === 'LDBranch') {
            for (const circuit of element.circuits) {
                this.analyzeCircuit(circuit);
            }
        }
        else {
            const elementIndex = this.currentElement++;
            this.analyzeInstruction(element, elementIndex);
        }
    }
    analyzeInstruction(instruction, elementIndex) {
        const instructionDef = getInstruction(instruction.instructionType);
        if (!instructionDef)
            return;
        const expectedParams = instructionDef.params.length;
        const actualParams = instruction.parameters.length;
        if (actualParams !== expectedParams) {
            this.addDiagnostic(`${instruction.instructionType} expects ${expectedParams} parameter(s), got ${actualParams}`, LDCompilationDiagnosticCode.ParamCountMismatch, elementIndex);
        }
        for (let i = 0; i < instruction.parameters.length; i++) {
            const param = instruction.parameters[i];
            const paramDef = instructionDef?.params[i];
            this.validateParameter(param, instruction.instructionType, paramDef, elementIndex);
        }
        if (instruction.instructionType === 'MOVE') {
            this.validateMoveTypeCompatibility(instruction, elementIndex);
        }
        if (['ADD', 'SUB', 'MUL', 'DIV'].includes(instruction.instructionType)) {
            this.validateMathTypeCompatibility(instruction, elementIndex);
        }
        if (['EQ', 'NE', 'GT', 'GE', 'LT', 'LE'].includes(instruction.instructionType)) {
            this.validateCompareTypeCompatibility(instruction, elementIndex);
        }
        if (instruction.instructionType === 'LIMIT') {
            this.validateLimitTypeCompatibility(instruction, elementIndex);
        }
        if (instruction.instructionType === 'DIV') {
            this.validateDivisionByZero(instruction, elementIndex);
        }
        if (instruction.instructionType === 'TON' ||
            instruction.instructionType === 'TOF' ||
            instruction.instructionType === 'RTO') {
            this.validateRepeatedTimerInvocation(instruction, elementIndex);
        }
    }
    validateParameter(param, instructionType, paramDef, elementIndex) {
        const baseName = extractBaseName(param);
        if (baseName === '?') {
            if (paramDef?.defaultValue === undefined) {
                const paramLabel = paramDef?.name ?? 'parameter';
                this.addDiagnostic(`${instructionType}: '${paramLabel}' has no argument specified.`, LDCompilationDiagnosticCode.EmptyParameter, elementIndex);
            }
            return;
        }
        if (param.type === 'LDNumericLiteral') {
            const isOutputParam = paramDef?.usage === 'out' || paramDef?.usage === 'inout';
            if (isOutputParam) {
                this.addDiagnostic(`Cannot assign to numeric literal`, LDCompilationDiagnosticCode.NumericLiteralNotAllowed, elementIndex);
                return;
            }
            const allowsNumericLiteral = paramDef?.dataTypes?.some((dt) => dt === 'DINT' || dt === 'REAL');
            if (!allowsNumericLiteral && paramDef?.usage === 'in') {
                this.addDiagnostic(`${instructionType} requires a tag reference, not a numeric literal`, LDCompilationDiagnosticCode.NumericLiteralNotAllowed, elementIndex);
            }
            return;
        }
        if (!baseName)
            return;
        if (!this.resolver.shouldValidateTags())
            return;
        const tagInfo = this.resolver.resolve(baseName);
        if (!tagInfo) {
            this.addDiagnostic(`Tag '${baseName}' is not defined`, LDCompilationDiagnosticCode.TagUndefined, elementIndex);
            return;
        }
        if (param.type === 'LDTagReference' && tagInfo.isArray) {
            this.addDiagnostic(`Tag '${baseName}' is an array and requires an index`, LDCompilationDiagnosticCode.ArrayIndexRequired, elementIndex);
            return;
        }
        if (param.type === 'LDMemberAccess') {
            const bitIndex = parseBitIndex(param.member);
            if (bitIndex !== null) {
                const intermediateType = this.resolveIntermediateType(param.object, tagInfo);
                if (intermediateType === 'DINT' && (bitIndex < 0 || bitIndex > 31)) {
                    this.addDiagnostic(`DINT bit index must be between 0 and 31, got ${bitIndex}`, LDCompilationDiagnosticCode.TypeMismatch, elementIndex);
                    return;
                }
            }
        }
        const resolvedType = this.resolveParameterType(param, tagInfo);
        const expectedDataTypes = paramDef?.dataTypes;
        if (expectedDataTypes && !expectedDataTypes.some((dt) => dt === resolvedType)) {
            const expectedStr = expectedDataTypes.join(' or ');
            this.addDiagnostic(`Invalid data type. Argument must match parameter data type. ${instructionType} requires ${expectedStr}, got ${resolvedType}`, LDCompilationDiagnosticCode.TypeMismatch, elementIndex);
        }
        const isWriteParam = paramDef?.usage === 'out' || paramDef?.usage === 'inout';
        if (isWriteParam && tagInfo.usage === 'input') {
            this.addDiagnostic(`Operand '${baseName}' is an input parameter and should not be modified`, LDCompilationDiagnosticCode.InputTagWrite, elementIndex, 'warning');
        }
    }
    resolveParameterType(param, baseTagInfo) {
        if (param.type === 'LDTagReference') {
            return baseTagInfo.dataType;
        }
        if (param.type === 'LDIndexedAccess') {
            return baseTagInfo.dataType;
        }
        if (param.type === 'LDMemberAccess') {
            const intermediateType = this.resolveIntermediateType(param.object, baseTagInfo);
            return this.resolveMemberOnType(intermediateType, param.member);
        }
        return 'UNKNOWN';
    }
    resolveIntermediateType(param, baseTagInfo) {
        if (param.type === 'LDTagReference') {
            return baseTagInfo.dataType;
        }
        if (param.type === 'LDIndexedAccess') {
            return baseTagInfo.dataType;
        }
        if (param.type === 'LDMemberAccess') {
            const parentType = this.resolveIntermediateType(param.object, baseTagInfo);
            return this.resolveMemberOnType(parentType, param.member, parentType === baseTagInfo.dataType ? baseTagInfo : undefined);
        }
        return 'UNKNOWN';
    }
    resolveMemberOnType(parentType, member, baseTagInfo) {
        const bitIndex = parseBitIndex(member);
        if (parentType === 'DINT' && bitIndex !== null && bitIndex >= 0 && bitIndex <= 31) {
            return 'BOOL';
        }
        const memberName = member.toUpperCase();
        if (baseTagInfo?.context.members) {
            const memberKey = Object.keys(baseTagInfo.context.members).find((k) => k.toUpperCase() === memberName);
            if (memberKey) {
                return baseTagInfo.context.members[memberKey].dataType.toUpperCase();
            }
        }
        const defaultMembers = getMembersForDataType(parentType);
        const defaultMember = defaultMembers.find((m) => m.key.toUpperCase() === memberName);
        if (defaultMember) {
            return defaultMember.type.toUpperCase();
        }
        return 'UNKNOWN';
    }
    resolveInstructionParameterType(param) {
        if (param.type === 'LDNumericLiteral') {
            return 'NUMERIC';
        }
        const baseName = extractBaseName(param);
        if (!baseName || baseName === '?')
            return null;
        if (!this.resolver.shouldValidateTags())
            return null;
        const tagInfo = this.resolver.resolve(baseName);
        if (!tagInfo)
            return null;
        return this.resolveParameterType(param, tagInfo);
    }
    validateMoveTypeCompatibility(instruction, elementIndex) {
        if (instruction.parameters.length < 2)
            return;
        const sourceParam = instruction.parameters[0];
        const destParam = instruction.parameters[1];
        const sourceType = this.resolveInstructionParameterType(sourceParam);
        const destType = this.resolveInstructionParameterType(destParam);
        if (!sourceType || !destType)
            return;
        const sourceCategory = sourceType === 'NUMERIC' ? 'numeric' : getTypeCategory(sourceType);
        const destCategory = getTypeCategory(destType);
        if (sourceCategory === 'unknown' || destCategory === 'unknown')
            return;
        if (sourceCategory !== destCategory) {
            this.addDiagnostic(`MOVE cannot convert ${sourceType === 'NUMERIC' ? 'numeric literal' : sourceType} to ${destType}. BOOL and numeric types are not compatible.`, LDCompilationDiagnosticCode.TypeCompatibilityMismatch, elementIndex);
        }
    }
    validateMathTypeCompatibility(instruction, elementIndex) {
        if (instruction.parameters.length < 3)
            return;
        const sourceAParam = instruction.parameters[0];
        const sourceBParam = instruction.parameters[1];
        const destParam = instruction.parameters[2];
        const sourceAType = this.resolveInstructionParameterType(sourceAParam);
        const sourceBType = this.resolveInstructionParameterType(sourceBParam);
        const destType = this.resolveInstructionParameterType(destParam);
        const instructionName = instruction.instructionType;
        for (const [paramName, paramType] of [
            ['Source A', sourceAType],
            ['Source B', sourceBType],
            ['Dest', destType],
        ]) {
            if (!paramType)
                continue;
            const category = paramType === 'NUMERIC' ? 'numeric' : getTypeCategory(paramType);
            if (category !== 'numeric' && category !== 'unknown') {
                this.addDiagnostic(`${instructionName} ${paramName} requires numeric type (DINT or REAL), got ${paramType === 'NUMERIC' ? 'numeric literal' : paramType}`, LDCompilationDiagnosticCode.TypeCompatibilityMismatch, elementIndex);
            }
        }
    }
    validateCompareTypeCompatibility(instruction, elementIndex) {
        if (instruction.parameters.length < 2)
            return;
        const sourceAType = this.resolveInstructionParameterType(instruction.parameters[0]);
        const sourceBType = this.resolveInstructionParameterType(instruction.parameters[1]);
        const instructionName = instruction.instructionType;
        for (const [paramName, paramType] of [
            ['Source A', sourceAType],
            ['Source B', sourceBType],
        ]) {
            if (!paramType)
                continue;
            const category = paramType === 'NUMERIC' ? 'numeric' : getTypeCategory(paramType);
            if (category !== 'numeric' && category !== 'unknown') {
                this.addDiagnostic(`${instructionName} ${paramName} requires numeric type (DINT or REAL), got ${paramType === 'NUMERIC' ? 'numeric literal' : paramType}`, LDCompilationDiagnosticCode.TypeCompatibilityMismatch, elementIndex);
            }
        }
    }
    validateLimitTypeCompatibility(instruction, elementIndex) {
        if (instruction.parameters.length < 3)
            return;
        const lowType = this.resolveInstructionParameterType(instruction.parameters[0]);
        const testType = this.resolveInstructionParameterType(instruction.parameters[1]);
        const highType = this.resolveInstructionParameterType(instruction.parameters[2]);
        for (const [paramName, paramType] of [
            ['Low Limit', lowType],
            ['Test', testType],
            ['High Limit', highType],
        ]) {
            if (!paramType)
                continue;
            const category = paramType === 'NUMERIC' ? 'numeric' : getTypeCategory(paramType);
            if (category !== 'numeric' && category !== 'unknown') {
                this.addDiagnostic(`LIMIT ${paramName} requires numeric type (DINT or REAL), got ${paramType === 'NUMERIC' ? 'numeric literal' : paramType}`, LDCompilationDiagnosticCode.TypeCompatibilityMismatch, elementIndex);
            }
        }
    }
    validateDivisionByZero(instruction, elementIndex) {
        if (instruction.parameters.length < 2)
            return;
        const sourceBParam = instruction.parameters[1];
        if (sourceBParam.type === 'LDNumericLiteral' && sourceBParam.value === 0) {
            this.addDiagnostic(`DIV: division by zero`, LDCompilationDiagnosticCode.DivisionByZero, elementIndex);
        }
    }
    validateRepeatedTimerInvocation(instruction, elementIndex) {
        const timerParameter = instruction.parameters[0];
        if (!timerParameter)
            return;
        const timerType = this.resolveInstructionParameterType(timerParameter);
        if (timerType !== 'TIMER' && timerType !== 'FBD_TIMER')
            return;
        const timerKey = formatTimerParameterKey(timerParameter);
        if (!timerKey || timerKey.includes('.'))
            return;
        const invocationKey = `${instruction.instructionType}:${timerKey}`;
        if (!this.seenTimerInvocations.has(invocationKey)) {
            this.seenTimerInvocations.add(invocationKey);
            return;
        }
        this.addDiagnostic(`${instruction.instructionType} called multiple times for timer '${timerKey}'`, LDCompilationDiagnosticCode.RepeatedTimerInvocation, elementIndex, 'warning');
    }
    addDiagnostic(message, code, element, severity = 'error') {
        this.diagnostics.push({
            type: 'ld',
            severity,
            message,
            code,
            source: 'semantic',
            rung: this.currentRung,
            element,
        });
    }
}
