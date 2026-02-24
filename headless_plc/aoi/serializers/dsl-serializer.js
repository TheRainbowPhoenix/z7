export function serializeDsl(aoi) {
    const escapeString = (s) => {
        if (!s)
            return '';
        return s.replace(/"/g, '\\"');
    };
    const serializeTagValue = (value) => {
        if (typeof value === 'string') {
            return `"${escapeString(value)}"`;
        }
        else if (typeof value === 'number') {
            return value.toString();
        }
        else if (typeof value === 'boolean') {
            return value ? '1' : '0';
        }
        else if (value === null || value === undefined) {
            return '0';
        }
        else {
            return JSON.stringify(value);
        }
    };
    const integerTypes = new Set([
        'DINT',
        'SINT',
        'INT',
        'LINT',
        'USINT',
        'UINT',
        'ULINT',
    ]);
    const floatTypes = new Set(['REAL', 'LREAL']);
    const formatDefaultLiteral = (dataType, value) => {
        if (value === undefined || value === null || Array.isArray(value)) {
            return null;
        }
        if (dataType === 'BOOL') {
            if (typeof value === 'boolean')
                return value ? '1' : '0';
            if (typeof value === 'number')
                return value !== 0 ? '1' : '0';
            if (typeof value === 'string') {
                const lower = value.toLowerCase();
                if (lower === 'true' || lower === '1')
                    return '1';
                if (lower === 'false' || lower === '0')
                    return '0';
            }
            return null;
        }
        if (dataType === 'STRING') {
            return `"${escapeString(String(value))}"`;
        }
        if (integerTypes.has(dataType)) {
            if (typeof value === 'number')
                return Math.trunc(value).toString();
            if (typeof value === 'string') {
                const parsed = parseInt(value, 10);
                return Number.isNaN(parsed) ? null : parsed.toString();
            }
            if (typeof value === 'boolean')
                return value ? '1' : '0';
            return null;
        }
        if (floatTypes.has(dataType)) {
            if (typeof value === 'number')
                return value.toString();
            if (typeof value === 'string') {
                const parsed = parseFloat(value);
                return Number.isNaN(parsed) ? null : parsed.toString();
            }
            if (typeof value === 'boolean')
                return value ? '1' : '0';
            return null;
        }
        if (typeof value === 'number')
            return value.toString();
        if (typeof value === 'string')
            return `"${escapeString(value)}"`;
        if (typeof value === 'boolean')
            return value ? '1' : '0';
        return null;
    };
    const headerLines = [];
    const localTags = aoi.tags.filter((t) => t.usage === 'local');
    for (const tag of aoi.tags) {
        if (tag.usage === 'input' || tag.usage === 'output') {
            const usage = tag.usage.toLowerCase();
            const dt = tag.dataType;
            if (!dt)
                continue;
            const hasDimension = 'dimension' in tag && tag.dimension !== undefined;
            const arraySpec = hasDimension ? `[${tag.dimension}]` : '';
            const fullDataType = `${dt}${arraySpec}`;
            let propsBlock = '';
            const hasProps = tag.description;
            if (hasProps) {
                const propLines = [];
                if (tag.description) {
                    propLines.push(`        desc := "${escapeString(tag.description)}";`);
                }
                propsBlock = ` {\n${propLines.join('\n')}\n    }`;
            }
            let defaultStr = '';
            if (tag.defaultValue !== undefined) {
                if (dt === 'BOOL') {
                    defaultStr = ` := ${tag.defaultValue ? '1' : '0'}`;
                }
                else if (dt === 'DINT' ||
                    dt === 'REAL' ||
                    dt === 'SINT' ||
                    dt === 'INT' ||
                    dt === 'LINT' ||
                    dt === 'USINT' ||
                    dt === 'UINT' ||
                    dt === 'ULINT' ||
                    dt === 'LREAL') {
                    defaultStr = ` := ${tag.defaultValue}`;
                }
            }
            headerLines.push(`${usage} ${fullDataType} ${tag.name}${propsBlock}${defaultStr}`);
        }
    }
    const header = headerLines.length
        ? `(
${headerLines.map((l) => `    ${l}`).join(',\n')}
)`
        : '()';
    const bodyParts = [];
    const desc = escapeString(aoi.description);
    if (desc)
        bodyParts.push(`    desc := "${desc}";`);
    for (const tag of localTags) {
        const dt = tag.dataType;
        if (!dt)
            continue;
        const hasDimension = 'dimension' in tag && tag.dimension !== undefined;
        const arraySpec = hasDimension ? `[${tag.dimension}]` : '';
        const isArrayTag = hasDimension;
        const serializeNestedObject = (obj, prefix = '') => {
            const lines = [];
            for (const [key, value] of Object.entries(obj)) {
                const path = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    lines.push(...serializeNestedObject(value, path));
                }
                else {
                    const serialized = formatDefaultLiteral(dt, value) ?? serializeTagValue(value);
                    lines.push(`        ${path} := ${serialized};`);
                }
            }
            return lines;
        };
        const hasElements = 'elements' in tag && tag.elements && Object.keys(tag.elements).length > 0;
        const hasScalarDefault = !isArrayTag && tag.defaultValue !== undefined;
        const hasStructuredDefault = !isArrayTag && typeof tag.defaultValue === 'object' && tag.defaultValue !== null;
        const hasProperties = Boolean(tag.description || hasElements || hasScalarDefault);
        if (hasProperties) {
            const propertyLines = [];
            if (tag.description) {
                propertyLines.push(`        desc := "${escapeString(tag.description)}";`);
            }
            if (hasStructuredDefault) {
                propertyLines.push(...serializeNestedObject(tag.defaultValue));
            }
            else if (hasScalarDefault && !hasStructuredDefault) {
                const literal = formatDefaultLiteral(dt, tag.defaultValue);
                if (literal) {
                    propertyLines.push(`        value := ${literal};`);
                }
            }
            if ('elements' in tag && tag.elements) {
                const sortedEntries = Object.entries(tag.elements).sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10));
                for (const [indexStr, element] of sortedEntries) {
                    const hasDesc = Boolean(element.description);
                    const hasDefault = element.defaultValue !== undefined;
                    const isStructuredDefault = typeof element.defaultValue === 'object' && element.defaultValue !== null;
                    if (!hasDesc && hasDefault && !isStructuredDefault) {
                        const literal = formatDefaultLiteral(dt, element.defaultValue);
                        if (literal) {
                            propertyLines.push(`        [${indexStr}] := ${literal};`);
                        }
                        continue;
                    }
                    if (hasDesc && !isStructuredDefault) {
                        propertyLines.push(`        [${indexStr}] {`);
                        propertyLines.push(`            desc := "${escapeString(element.description)}";`);
                        if (hasDefault) {
                            const literal = formatDefaultLiteral(dt, element.defaultValue);
                            if (literal) {
                                propertyLines.push(`            value := ${literal};`);
                            }
                        }
                        propertyLines.push(`        };`);
                    }
                    else if (hasDesc) {
                        propertyLines.push(`        [${indexStr}] {`);
                        propertyLines.push(`            desc := "${escapeString(element.description)}";`);
                        propertyLines.push(`        };`);
                    }
                    if (isStructuredDefault) {
                        const defaultObj = element.defaultValue;
                        for (const [key, value] of Object.entries(defaultObj)) {
                            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                const nestedLines = serializeNestedObject(value, key);
                                for (const line of nestedLines) {
                                    propertyLines.push(`        [${indexStr}].${line.trim()}`);
                                }
                            }
                            else {
                                const serialized = formatDefaultLiteral(dt, value) ?? serializeTagValue(value);
                                propertyLines.push(`        [${indexStr}].${key} := ${serialized};`);
                            }
                        }
                    }
                }
            }
            bodyParts.push(`    tag ${dt}${arraySpec} ${tag.name} {\n${propertyLines.join('\n')}\n    };`);
        }
        else {
            if (isArrayTag) {
                bodyParts.push(`    tag ${dt}${arraySpec} ${tag.name} {\n    };`);
            }
            else {
                bodyParts.push(`    tag ${dt}${arraySpec} ${tag.name};`);
            }
        }
    }
    // Serialize routines in a consistent order: Logic first, then Prescan, then EnableInFalse
    const routineOrder = ['Logic', 'Prescan', 'EnableInFalse'];
    for (const routineName of routineOrder) {
        const r = aoi.routines[routineName];
        if (!r)
            continue;
        const typeToken = r.type === 'st' ? 'st' : 'ld';
        const content = (r.content ?? '')
            .split('\n')
            .map((line) => (line.length ? `        ${line}` : ''))
            .join('\n');
        bodyParts.push(`    routine ${typeToken} ${routineName}() {\n${content}\n    }`);
    }
    const body = bodyParts.length ? ` {\n${bodyParts.join('\n')}\n}` : ' {\n}\n';
    return `aoi ${aoi.name}${header}${body}`;
}
