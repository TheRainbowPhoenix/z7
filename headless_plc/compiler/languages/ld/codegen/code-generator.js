import { getMembersForDataType } from '../../../core/index.js';
export class LDCodeGenerator {
    currentRung = 0;
    currentElement = 0;
    tags = [];
    generate(ast, context) {
        this.tags = context?.tags ?? [];
        const rungCode = ast.rungs.map((rung) => this.generateRung(rung)).join('\n\n');
        return `
try {
${rungCode}
} catch (error) {
  log.push('Runtime error: ' + error.message);
}`;
    }
    generateRung(rung) {
        this.currentRung = rung.index;
        this.currentElement = 0;
        const circuitCode = this.generateCircuit(rung.circuit);
        return `(() => {
  let __power = 1;
${this.indent(circuitCode, 1)}
})();`;
    }
    generateCircuit(circuit) {
        const lines = [];
        for (const element of circuit.elements) {
            lines.push(this.generateElement(element));
        }
        return lines.join('\n');
    }
    generateElement(element) {
        if (element.type === 'LDBranch') {
            return this.generateBranch(element);
        }
        const code = this.generateInstruction(element);
        this.currentElement++;
        return code;
    }
    generateBranch(branch) {
        if (branch.circuits.length === 0) {
            return '';
        }
        if (branch.circuits.length === 1) {
            return this.generateCircuit(branch.circuits[0]);
        }
        const branchFunctions = branch.circuits.map((circuit, index) => {
            const circuitCode = this.generateCircuit(circuit);
            return `const __branch${index} = (() => {
  let __branchPower = __power;
${this.indent(circuitCode.replace(/__power/g, '__branchPower'), 1)}
  return __branchPower;
})();`;
        });
        const orExpression = branch.circuits.map((_, index) => `__branch${index}`).join(' || ');
        return `${branchFunctions.join('\n')}
__power = (${orExpression}) ? 1 : 0;`;
    }
    generateInstruction(instruction) {
        switch (instruction.instructionType) {
            case 'XIC':
                return this.generateXIC(instruction);
            case 'XIO':
                return this.generateXIO(instruction);
            case 'ONS':
                return this.generateONS(instruction);
            case 'OTE':
                return this.generateOTE(instruction);
            case 'OTL':
                return this.generateOTL(instruction);
            case 'OTU':
                return this.generateOTU(instruction);
            case 'TON':
                return this.generateTON(instruction);
            case 'TOF':
                return this.generateTOF(instruction);
            case 'RTO':
                return this.generateRTO(instruction);
            case 'CTU':
                return this.generateCTU(instruction);
            case 'CTD':
                return this.generateCTD(instruction);
            case 'RES':
                return this.generateRES(instruction);
            case 'MOVE':
                return this.generateMOVE(instruction);
            case 'ADD':
                return this.generateADD(instruction);
            case 'SUB':
                return this.generateSUB(instruction);
            case 'MUL':
                return this.generateMUL(instruction);
            case 'DIV':
                return this.generateDIV(instruction);
            case 'EQ':
                return this.generateCompare(instruction, '===', 'EQ');
            case 'NE':
                return this.generateCompare(instruction, '!==', 'NE');
            case 'GT':
                return this.generateCompare(instruction, '>', 'GT');
            case 'GE':
                return this.generateCompare(instruction, '>=', 'GE');
            case 'LT':
                return this.generateCompare(instruction, '<', 'LT');
            case 'LE':
                return this.generateCompare(instruction, '<=', 'LE');
            case 'LIMIT':
                return this.generateLIMIT(instruction);
            default:
                return `log.push('Unknown instruction: ${instruction.instructionType}');\n__power = 0;`;
        }
    }
    generateXIC(instruction) {
        const param = instruction.parameters[0];
        if (!param)
            return `log.push('XIC missing parameter');\n__power = 0;`;
        const accessor = this.generateParameterGetter(param);
        return `__power = __power && (${accessor} ? 1 : 0);`;
    }
    generateXIO(instruction) {
        const param = instruction.parameters[0];
        if (!param)
            return `log.push('XIO missing parameter');\n__power = 0;`;
        const accessor = this.generateParameterGetter(param);
        return `__power = __power && (${accessor} ? 0 : 1);`;
    }
    generateONS(instruction) {
        const storageBit = instruction.parameters[0];
        if (!storageBit)
            return `log.push('ONS missing storage parameter');\n__power = 0;`;
        const storageAccessor = this.generateParameterGetter(storageBit);
        const storageSetter = this.generateParameterSetter(storageBit, '1');
        const storageResetter = this.generateParameterSetter(storageBit, '0');
        if (storageBit.type === 'LDTagReference') {
            return `if (__power) {
  if (!vars.has('${storageBit.name}')) {
    vars.set('${storageBit.name}', 1);
    __power = 0;
  } else {
    const __storage = (${storageAccessor}) ? 1 : 0;
    __power = __storage ? 0 : 1;
${this.indent(storageSetter, 2)}
  }
} else {
${this.indent(storageResetter, 1)}
  __power = 0;
}`;
        }
        return `if (__power) {
  const __storage = (${storageAccessor}) ? 1 : 0;
  __power = __storage ? 0 : 1;
${this.indent(storageSetter, 1)}
} else {
${this.indent(storageResetter, 1)}
  __power = 0;
}`;
    }
    generateOTE(instruction) {
        const param = instruction.parameters[0];
        if (!param)
            return `log.push('OTE missing parameter');`;
        return this.generateParameterSetter(param, '__power');
    }
    generateOTL(instruction) {
        const param = instruction.parameters[0];
        if (!param)
            return `log.push('OTL missing parameter');`;
        return `if (__power) {
${this.indent(this.generateParameterSetter(param, '1'), 1)}
}`;
    }
    generateOTU(instruction) {
        const param = instruction.parameters[0];
        if (!param)
            return `log.push('OTU missing parameter');`;
        return `if (__power) {
${this.indent(this.generateParameterSetter(param, '0'), 1)}
}`;
    }
    generateTON(instruction) {
        const timerParam = instruction.parameters[0];
        if (!timerParam)
            return `log.push('TON missing timer parameter');`;
        const accessor = this.generateStructAccessor(timerParam, '{ PRE: 0, ACC: 0, EN: 0, TT: 0, DN: 0 }');
        if (!accessor)
            return `log.push('TON: cannot determine timer name');`;
        return `(() => {
  ${accessor.getCode}
  if (__power) {
    __t.EN = 1;
    if (__t.ACC < __t.PRE) {
      __t.ACC = Math.min(__t.ACC + __scanTime, __t.PRE);
    }
    if (__t.ACC >= __t.PRE) {
      __t.TT = 0;
      __t.DN = 1;
    } else {
      __t.TT = 1;
      __t.DN = 0;
    }
  } else {
    __t.EN = 0;
    __t.TT = 0;
    __t.DN = 0;
    __t.ACC = 0;
  }
  ${accessor.setCode}
})();`;
    }
    generateTOF(instruction) {
        const timerParam = instruction.parameters[0];
        if (!timerParam)
            return `log.push('TOF missing timer parameter');`;
        const accessor = this.generateStructAccessor(timerParam, '{ PRE: 0, ACC: 0, EN: 0, TT: 0, DN: 0 }');
        if (!accessor)
            return `log.push('TOF: cannot determine timer name');`;
        return `(() => {
  ${accessor.getCode}
  const __prevEN = __t.EN;
  if (__power) {
    __t.EN = 1;
    __t.DN = 1;
    __t.TT = 0;
    __t.ACC = 0;
  } else {
    __t.EN = 0;
    if (__prevEN || __t.TT) {
      if (__t.ACC < __t.PRE) {
        __t.ACC = Math.min(__t.ACC + __scanTime, __t.PRE);
        __t.TT = 1;
        __t.DN = 1;
      } else {
        __t.TT = 0;
        __t.DN = 0;
      }
    }
  }
  ${accessor.setCode}
})();`;
    }
    generateRTO(instruction) {
        const timerParam = instruction.parameters[0];
        if (!timerParam)
            return `log.push('RTO missing timer parameter');`;
        const accessor = this.generateStructAccessor(timerParam, '{ PRE: 0, ACC: 0, EN: 0, TT: 0, DN: 0 }');
        if (!accessor)
            return `log.push('RTO: cannot determine timer name');`;
        return `(() => {
  ${accessor.getCode}
  if (__power) {
    __t.EN = 1;
    if (__t.ACC < __t.PRE) {
      __t.ACC = Math.min(__t.ACC + __scanTime, __t.PRE);
    }
    if (__t.ACC >= __t.PRE) {
      __t.TT = 0;
      __t.DN = 1;
    } else {
      __t.TT = 1;
      __t.DN = 0;
    }
  } else {
    __t.EN = 0;
    __t.TT = 0;
  }
  ${accessor.setCode}
})();`;
    }
    generateCTU(instruction) {
        const counterParam = instruction.parameters[0];
        if (!counterParam)
            return `log.push('CTU missing counter parameter');`;
        const accessor = this.generateStructAccessor(counterParam, '{ PRE: 0, ACC: 0, CU: 0, CD: 0, DN: 0, OV: 0, UN: 0 }');
        if (!accessor)
            return `log.push('CTU: cannot determine counter name');`;
        return `(() => {
  ${accessor.getCode}
  const __prevCU = __t.CU;
  if (__power && !__prevCU) {
    __t.ACC = __t.ACC + 1;
    if (__t.ACC > 2147483647) {
      __t.ACC = -2147483648;
      __t.OV = 1;
    }
  }
  __t.CU = __power ? 1 : 0;
  __t.DN = __t.ACC >= __t.PRE ? 1 : 0;
  ${accessor.setCode}
})();`;
    }
    generateCTD(instruction) {
        const counterParam = instruction.parameters[0];
        if (!counterParam)
            return `log.push('CTD missing counter parameter');`;
        const accessor = this.generateStructAccessor(counterParam, '{ PRE: 0, ACC: 0, CU: 0, CD: 0, DN: 0, OV: 0, UN: 0 }');
        if (!accessor)
            return `log.push('CTD: cannot determine counter name');`;
        return `(() => {
  ${accessor.getCode}
  const __prevCD = __t.CD;
  if (__power && !__prevCD) {
    __t.ACC = __t.ACC - 1;
    if (__t.ACC < -2147483648) {
      __t.ACC = 2147483647;
      __t.UN = 1;
    }
  }
  __t.CD = __power ? 1 : 0;
  __t.DN = __t.ACC >= __t.PRE ? 1 : 0;
  ${accessor.setCode}
})();`;
    }
    generateRES(instruction) {
        const param = instruction.parameters[0];
        if (!param)
            return `log.push('RES missing parameter');`;
        const baseName = this.extractBaseName(param);
        if (!baseName)
            return `log.push('RES: cannot determine structure name');`;
        if (param.type === 'LDIndexedAccess') {
            const indexAccessor = this.generateParameterGetter(param.index);
            return `if (__power) {
  const __arr = vars.get('${baseName}');
  const __idx = ${indexAccessor};
  if (Array.isArray(__arr) && __idx >= 0 && __idx < __arr.length) {
    const __s = __arr[__idx];
    if (__s && typeof __s === 'object') {
      __s.ACC = 0;
      __s.EN = 0;
      __s.TT = 0;
      __s.DN = 0;
      if ('CU' in __s) __s.CU = 0;
      if ('CD' in __s) __s.CD = 0;
      if ('OV' in __s) __s.OV = 0;
      if ('UN' in __s) __s.UN = 0;
      vars.set('${baseName}', __arr);
    }
  }
}`;
        }
        return `if (__power) {
  const __s = vars.get('${baseName}');
  if (__s && typeof __s === 'object') {
    __s.ACC = 0;
    __s.EN = 0;
    __s.TT = 0;
    __s.DN = 0;
    if ('CU' in __s) __s.CU = 0;
    if ('CD' in __s) __s.CD = 0;
    if ('OV' in __s) __s.OV = 0;
    if ('UN' in __s) __s.UN = 0;
    vars.set('${baseName}', __s);
  }
}`;
    }
    generateMOVE(instruction) {
        const sourceParam = instruction.parameters[0];
        const destParam = instruction.parameters[1];
        if (!sourceParam)
            return `log.push('MOVE missing source parameter');`;
        if (!destParam)
            return `log.push('MOVE missing destination parameter');`;
        const sourceAccessor = this.generateParameterGetter(sourceParam);
        return `if (__power) {
${this.indent(this.generateParameterSetter(destParam, sourceAccessor), 1)}
}`;
    }
    generateADD(instruction) {
        const sourceAParam = instruction.parameters[0];
        const sourceBParam = instruction.parameters[1];
        const destParam = instruction.parameters[2];
        if (!sourceAParam)
            return `log.push('ADD missing Source A parameter');`;
        if (!sourceBParam)
            return `log.push('ADD missing Source B parameter');`;
        if (!destParam)
            return `log.push('ADD missing Dest parameter');`;
        const sourceAAccessor = this.generateParameterGetter(sourceAParam);
        const sourceBAccessor = this.generateParameterGetter(sourceBParam);
        return `if (__power) {
${this.indent(this.generateParameterSetter(destParam, `(${sourceAAccessor}) + (${sourceBAccessor})`), 1)}
}`;
    }
    generateSUB(instruction) {
        const sourceAParam = instruction.parameters[0];
        const sourceBParam = instruction.parameters[1];
        const destParam = instruction.parameters[2];
        if (!sourceAParam)
            return `log.push('SUB missing Source A parameter');`;
        if (!sourceBParam)
            return `log.push('SUB missing Source B parameter');`;
        if (!destParam)
            return `log.push('SUB missing Dest parameter');`;
        const sourceAAccessor = this.generateParameterGetter(sourceAParam);
        const sourceBAccessor = this.generateParameterGetter(sourceBParam);
        return `if (__power) {
${this.indent(this.generateParameterSetter(destParam, `(${sourceAAccessor}) - (${sourceBAccessor})`), 1)}
}`;
    }
    generateMUL(instruction) {
        const sourceAParam = instruction.parameters[0];
        const sourceBParam = instruction.parameters[1];
        const destParam = instruction.parameters[2];
        if (!sourceAParam)
            return `log.push('MUL missing Source A parameter');`;
        if (!sourceBParam)
            return `log.push('MUL missing Source B parameter');`;
        if (!destParam)
            return `log.push('MUL missing Dest parameter');`;
        const sourceAAccessor = this.generateParameterGetter(sourceAParam);
        const sourceBAccessor = this.generateParameterGetter(sourceBParam);
        return `if (__power) {
${this.indent(this.generateParameterSetter(destParam, `(${sourceAAccessor}) * (${sourceBAccessor})`), 1)}
}`;
    }
    generateDIV(instruction) {
        const sourceAParam = instruction.parameters[0];
        const sourceBParam = instruction.parameters[1];
        const destParam = instruction.parameters[2];
        if (!sourceAParam)
            return `log.push('DIV missing Source A parameter');`;
        if (!sourceBParam)
            return `log.push('DIV missing Source B parameter');`;
        if (!destParam)
            return `log.push('DIV missing Dest parameter');`;
        const sourceAAccessor = this.generateParameterGetter(sourceAParam);
        const sourceBAccessor = this.generateParameterGetter(sourceBParam);
        const rung = this.currentRung;
        const element = this.currentElement;
        return `if (__power) {
  const __divisor = (${sourceBAccessor});
  if (__divisor === 0) {
    log.push({ severity: 'error', message: 'DIV: division by zero', code: 'LD-RT-001', rung: ${rung}, element: ${element} });
  } else {
${this.indent(this.generateParameterSetter(destParam, `(${sourceAAccessor}) / __divisor`), 2)}
  }
}`;
    }
    generateCompare(instruction, op, name) {
        const sourceAParam = instruction.parameters[0];
        const sourceBParam = instruction.parameters[1];
        if (!sourceAParam)
            return `log.push('${name} missing Source A parameter');\n__power = 0;`;
        if (!sourceBParam)
            return `log.push('${name} missing Source B parameter');\n__power = 0;`;
        const sourceAAccessor = this.generateParameterGetter(sourceAParam);
        const sourceBAccessor = this.generateParameterGetter(sourceBParam);
        return `__power = __power && ((${sourceAAccessor}) ${op} (${sourceBAccessor}) ? 1 : 0);`;
    }
    generateLIMIT(instruction) {
        const lowParam = instruction.parameters[0];
        const testParam = instruction.parameters[1];
        const highParam = instruction.parameters[2];
        if (!lowParam)
            return `log.push('LIMIT missing Low Limit parameter');\n__power = 0;`;
        if (!testParam)
            return `log.push('LIMIT missing Test parameter');\n__power = 0;`;
        if (!highParam)
            return `log.push('LIMIT missing High Limit parameter');\n__power = 0;`;
        const low = this.generateParameterGetter(lowParam);
        const test = this.generateParameterGetter(testParam);
        const high = this.generateParameterGetter(highParam);
        return `__power = __power && (() => {
  const __low = (${low});
  const __test = (${test});
  const __high = (${high});
  if (__low !== __low || __test !== __test || __high !== __high) return 0;
  if (__low <= __high) return (__test >= __low && __test <= __high) ? 1 : 0;
  return (__test >= __low || __test <= __high) ? 1 : 0;
})();`;
    }
    generateParameterGetter(param) {
        switch (param.type) {
            case 'LDNumericLiteral':
                return String(param.value);
            case 'LDTagReference':
                return `(vars.has('${param.name}') ? vars.get('${param.name}') : 0)`;
            case 'LDMemberAccess': {
                const objectAccessor = this.generateParameterGetter(param.object);
                const bitIndex = this.parseBitIndex(param.member);
                const memberName = param.member.toUpperCase();
                return `(() => {
  const __obj = ${objectAccessor};
  if (typeof __obj === 'number' && ${bitIndex !== null ? bitIndex : -1} >= 0 && ${bitIndex !== null ? bitIndex : -1} <= 31) {
    return ((__obj >>> ${bitIndex !== null ? bitIndex : 0}) & 1) ? 1 : 0;
  }
  if (__obj && typeof __obj === 'object' && '${memberName}' in __obj) {
    return __obj['${memberName}'];
  }
  return 0;
})()`;
            }
            case 'LDIndexedAccess': {
                const targetAccessor = this.generateParameterGetter(param.target);
                const indexAccessor = this.generateParameterGetter(param.index);
                return `(() => {
  const __arr = ${targetAccessor};
  const __idx = ${indexAccessor};
  if (Array.isArray(__arr) && __idx >= 0 && __idx < __arr.length) {
    return __arr[__idx];
  }
  return 0;
})()`;
            }
        }
    }
    resolveDestinationType(param) {
        switch (param.type) {
            case 'LDTagReference': {
                const tag = this.tags.find((t) => t.name === param.name);
                return tag?.dataType ?? null;
            }
            case 'LDMemberAccess': {
                const objectType = this.resolveDestinationType(param.object);
                if (!objectType)
                    return null;
                return this.resolveMemberType(objectType, param.member, param.object);
            }
            case 'LDIndexedAccess': {
                const baseName = this.extractBaseName(param);
                if (!baseName)
                    return null;
                const tag = this.tags.find((t) => t.name === baseName);
                return tag?.dataType ?? null;
            }
            default:
                return null;
        }
    }
    resolveMemberType(parentType, member, parentParam) {
        const bitIndex = this.parseBitIndex(member);
        if (parentType === 'DINT' && bitIndex !== null && bitIndex >= 0 && bitIndex <= 31) {
            return 'BOOL';
        }
        const memberName = member.toUpperCase();
        const tag = this.resolveTagReference(parentParam);
        if (tag?.members) {
            const memberKey = Object.keys(tag.members).find((k) => k.toUpperCase() === memberName);
            if (memberKey) {
                return tag.members[memberKey].dataType;
            }
        }
        const defaultMembers = getMembersForDataType(parentType);
        const defaultMember = defaultMembers.find((m) => m.key.toUpperCase() === memberName);
        if (defaultMember) {
            return defaultMember.type;
        }
        return null;
    }
    resolveTagReference(param) {
        const baseName = this.extractBaseName(param);
        if (!baseName)
            return null;
        return this.tags.find((tag) => tag.name === baseName) ?? null;
    }
    coerceForType(value, dataType) {
        if (dataType === 'DINT')
            return `Math.trunc(${value})`;
        return value;
    }
    generateParameterSetter(param, value) {
        if (param.type === 'LDMemberAccess' && this.isDintBitAccess(param)) {
            return this.generateDintBitSetter(param, value);
        }
        const destType = this.resolveDestinationType(param);
        const coerced = this.coerceForType(value, destType);
        switch (param.type) {
            case 'LDNumericLiteral':
                return `log.push('Cannot assign to numeric literal');`;
            case 'LDTagReference':
                return `vars.set('${param.name}', ${coerced});`;
            case 'LDMemberAccess': {
                const baseName = this.extractBaseName(param);
                if (!baseName)
                    return `log.push('Cannot determine base name for member access');`;
                return `(() => {
  const __base = vars.get('${baseName}');
  if (__base && typeof __base === 'object') {
${this.indent(this.generateMemberSetterPath(param, '__base', coerced), 2)}
    vars.set('${baseName}', __base);
  }
})();`;
            }
            case 'LDIndexedAccess': {
                const baseName = this.extractBaseName(param);
                if (!baseName)
                    return `log.push('Cannot determine base name for indexed access');`;
                return `(() => {
  const __base = vars.get('${baseName}');
${this.indent(this.generateIndexedSetterPath(param, '__base', coerced), 1)}
  vars.set('${baseName}', __base);
})();`;
            }
        }
    }
    parseBitIndex(member) {
        if (!/^\d+$/.test(member))
            return null;
        const index = Number(member);
        if (!Number.isInteger(index))
            return null;
        return index;
    }
    isDintBitAccess(param) {
        const bitIndex = this.parseBitIndex(param.member);
        if (bitIndex === null || bitIndex < 0 || bitIndex > 31)
            return false;
        const objectType = this.resolveDestinationType(param.object);
        return objectType === 'DINT';
    }
    generateDintBitSetter(param, value) {
        const bitIndex = this.parseBitIndex(param.member);
        if (bitIndex === null || bitIndex < 0 || bitIndex > 31) {
            return `log.push('Invalid DINT bit index: ${param.member}');`;
        }
        const bitValueExpression = `((${value}) ? 1 : 0)`;
        const bitMask = `1 << ${bitIndex}`;
        if (param.object.type === 'LDTagReference') {
            return `(() => {
  const __currentRaw = vars.get('${param.object.name}');
  const __current = typeof __currentRaw === 'number' ? Math.trunc(__currentRaw) : 0;
  const __next = ${bitValueExpression} ? (__current | (${bitMask})) : (__current & ~(${bitMask}));
  vars.set('${param.object.name}', __next | 0);
})();`;
        }
        if (param.object.type === 'LDIndexedAccess') {
            const baseName = this.extractBaseName(param.object.target);
            if (!baseName)
                return `log.push('Cannot determine base name for DINT bit indexed access');`;
            const indexAccessor = this.generateParameterGetter(param.object.index);
            return `(() => {
  const __base = vars.get('${baseName}');
  const __idx = ${indexAccessor};
  if (Array.isArray(__base) && __idx >= 0 && __idx < __base.length) {
    const __currentRaw = __base[__idx];
    const __current = typeof __currentRaw === 'number' ? Math.trunc(__currentRaw) : 0;
    const __next = ${bitValueExpression} ? (__current | (${bitMask})) : (__current & ~(${bitMask}));
    __base[__idx] = __next | 0;
    vars.set('${baseName}', __base);
  }
})();`;
        }
        if (param.object.type === 'LDMemberAccess') {
            const objectGetter = this.generateParameterGetter(param.object);
            const objectSetter = (val) => this.generateParameterSetter(param.object, val);
            return `(() => {
  const __currentRaw = ${objectGetter};
  const __current = typeof __currentRaw === 'number' ? Math.trunc(__currentRaw) : 0;
  const __next = ${bitValueExpression} ? (__current | (${bitMask})) : (__current & ~(${bitMask}));
${this.indent(objectSetter('__next | 0'), 1)}
})();`;
        }
        return `log.push('DINT bit setter requires a DINT tag or DINT array element target');`;
    }
    generateStructAccessor(param, defaultValue) {
        const baseName = this.extractBaseName(param);
        if (!baseName)
            return null;
        if (param.type === 'LDIndexedAccess') {
            const indexAccessor = this.generateParameterGetter(param.index);
            return {
                getCode: `const __arr = vars.get('${baseName}');
  const __idx = ${indexAccessor};
  if (!Array.isArray(__arr) || __idx < 0 || __idx >= __arr.length) return;
  const __t = __arr[__idx] || ${defaultValue};`,
                setCode: `__arr[__idx] = __t;
  vars.set('${baseName}', __arr);`,
            };
        }
        return {
            getCode: `const __t = vars.get('${baseName}') || ${defaultValue};`,
            setCode: `vars.set('${baseName}', __t);`,
        };
    }
    extractBaseName(param) {
        switch (param.type) {
            case 'LDTagReference':
                return param.name;
            case 'LDMemberAccess':
                return this.extractBaseName(param.object);
            case 'LDIndexedAccess':
                return this.extractBaseName(param.target);
            case 'LDNumericLiteral':
                return null;
        }
    }
    generateMemberSetterPath(param, currentVar, value) {
        if (param.type === 'LDMemberAccess') {
            const memberName = param.member.toUpperCase();
            if (param.object.type === 'LDTagReference') {
                return `${currentVar}['${memberName}'] = ${value};`;
            }
            if (param.object.type === 'LDIndexedAccess') {
                const indexAccessor = this.generateParameterGetter(param.object.index);
                return `const __idx = ${indexAccessor};
if (Array.isArray(${currentVar}) && __idx >= 0 && __idx < ${currentVar}.length) {
  const __elem = ${currentVar}[__idx];
  if (__elem && typeof __elem === 'object') {
    __elem['${memberName}'] = ${value};
  }
}`;
            }
            const lines = [];
            const nextVar = `${currentVar}_inner`;
            lines.push(`const ${nextVar} = ${currentVar}['${this.getMemberOrIndexKey(param.object)}'];`);
            lines.push(`if (${nextVar} && typeof ${nextVar} === 'object') {`);
            lines.push(this.indent(this.generateMemberSetterPath({ ...param, object: param.object }, nextVar, value), 1));
            lines.push('}');
            return lines.join('\n');
        }
        return `${currentVar} = ${value};`;
    }
    generateIndexedSetterPath(param, currentVar, value) {
        if (param.type === 'LDIndexedAccess') {
            const indexAccessor = this.generateParameterGetter(param.index);
            if (param.target.type === 'LDTagReference') {
                return `const __idx = ${indexAccessor};
if (Array.isArray(${currentVar}) && __idx >= 0 && __idx < ${currentVar}.length) {
  ${currentVar}[__idx] = ${value};
}`;
            }
        }
        return `${currentVar} = ${value};`;
    }
    getMemberOrIndexKey(param) {
        if (param.type === 'LDMemberAccess') {
            return param.member;
        }
        return '';
    }
    indent(code, level) {
        const prefix = '  '.repeat(level);
        return code
            .split('\n')
            .map((line) => (line.trim() ? prefix + line : line))
            .join('\n');
    }
}
