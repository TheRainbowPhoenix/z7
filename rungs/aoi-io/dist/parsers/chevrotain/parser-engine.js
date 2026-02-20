import { AOILexer } from './lexer.js';
import { aoiParser } from './parser.js';
function isCstNode(value) {
    return typeof value === 'object' && value !== null && 'children' in value;
}
function isToken(value) {
    return typeof value === 'object' && value !== null && 'image' in value;
}
function asCstNodes(collection) {
    if (!collection)
        return undefined;
    if (collection.length === 0)
        return [];
    return isCstNode(collection[0]) ? collection : undefined;
}
function asTokens(collection) {
    if (!collection)
        return undefined;
    if (collection.length === 0)
        return [];
    return isToken(collection[0]) ? collection : undefined;
}
function firstCstNode(collection) {
    const nodes = asCstNodes(collection);
    return nodes?.[0];
}
function dedentRoutineContent(content) {
    const lines = content.split('\n');
    let minIndent = Infinity;
    for (const line of lines) {
        if (!line.trim())
            continue;
        const match = line.match(/^[ \t]*/);
        const indent = match ? match[0].length : 0;
        if (indent < minIndent)
            minIndent = indent;
    }
    if (!isFinite(minIndent) || minIndent === 0) {
        return content;
    }
    return lines
        .map((line) => {
        if (!line.trim())
            return '';
        let remove = minIndent;
        let index = 0;
        while (remove > 0 && index < line.length) {
            const char = line[index];
            if (char === ' ' || char === '\t') {
                index += 1;
                remove -= 1;
            }
            else {
                break;
            }
        }
        return line.slice(index);
    })
        .join('\n');
}
function extractText(node) {
    if (!node)
        return '';
    if (isToken(node)) {
        return String(node.image);
    }
    if (Array.isArray(node)) {
        return node.map(extractText).join(' ');
    }
    if (isCstNode(node)) {
        return extractTextFromChildren(node.children);
    }
    return '';
}
function extractTextFromChildren(children) {
    if (!children)
        return '';
    for (const key of Object.keys(children)) {
        const value = children[key];
        const tokens = asTokens(value);
        if (tokens && tokens[0]) {
            return String(tokens[0].image);
        }
    }
    return '';
}
function extractPropertyPath(node) {
    if (!isCstNode(node))
        return '';
    const parts = [];
    const ctx = node.children;
    for (const key of Object.keys(ctx)) {
        const value = ctx[key];
        const tokens = asTokens(value);
        if (!tokens)
            continue;
        tokens.forEach((token) => {
            if (key !== 'Dot') {
                parts.push(String(token.image));
            }
        });
    }
    return parts.join('.');
}
function parseLiteralValue(literalText) {
    if (!literalText)
        return undefined;
    if ((literalText.startsWith('"') && literalText.endsWith('"')) ||
        (literalText.startsWith("'") && literalText.endsWith("'"))) {
        return literalText.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n');
    }
    if (literalText === 'true')
        return true;
    if (literalText === 'false')
        return false;
    if (/^-?\d+$/.test(literalText)) {
        return parseInt(literalText, 10);
    }
    if (/^-?\d*\.\d+$/.test(literalText)) {
        return parseFloat(literalText);
    }
    return literalText;
}
function cstToAOI(cst, originalText = '') {
    const ctx = cst.children;
    const aoiName = extractText(ctx.aoiName?.[0]);
    const tags = [];
    const parameterListNode = firstCstNode(ctx.parameterList);
    const parameters = asCstNodes(parameterListNode?.children.parameter);
    if (parameters) {
        for (const param of parameters) {
            const paramCtx = param.children;
            const usage = paramCtx.Input ? 'input' : 'output';
            let dataType = '';
            let dimension;
            const dataTypeNode = firstCstNode(paramCtx.dataTypeWithArray);
            if (dataTypeNode) {
                const dataTypeCtx = dataTypeNode.children;
                dataType = extractText(dataTypeCtx.dataType?.[0]);
                const arraySizeTokens = asTokens(dataTypeCtx.arraySize);
                if (arraySizeTokens && arraySizeTokens.length > 0) {
                    dimension = parseInt(arraySizeTokens[0].image, 10);
                }
            }
            const paramName = extractText(paramCtx.parameterName?.[0]);
            let defaultValue;
            if (paramCtx.literal) {
                const literalText = extractText(paramCtx.literal[0]);
                if (dataType === 'BOOL') {
                    if (literalText === '1' || literalText === 'true')
                        defaultValue = true;
                    else if (literalText === '0' || literalText === 'false')
                        defaultValue = false;
                }
                else {
                    defaultValue = parseLiteralValue(literalText);
                }
            }
            const tag = {
                name: paramName,
                dataType,
                usage,
                description: '',
            };
            if (dimension !== undefined) {
                tag.dimension = dimension;
            }
            if (defaultValue !== undefined) {
                tag.defaultValue = defaultValue;
            }
            const parameterPropsNode = firstCstNode(paramCtx.propertiesBlock);
            if (parameterPropsNode) {
                const propsText = extractText(parameterPropsNode);
                const descMatch = propsText.match(/desc := (:?"([^"]*)"|'([^']*)')/);
                if (descMatch) {
                    tag.description = descMatch[1] || descMatch[2];
                }
            }
            tags.push(tag);
        }
    }
    const metadata = { major: 1, minor: 0, build: 0 };
    const routines = [];
    const bodyNode = firstCstNode(ctx.aoiBody);
    if (bodyNode) {
        const bodyCtx = bodyNode.children;
        const metadataAssignments = asCstNodes(bodyCtx.metadataAssignment);
        if (metadataAssignments) {
            for (const metaAssign of metadataAssignments) {
                const metaCtx = metaAssign.children;
                const value = extractText(metaCtx.literal?.[0]);
                if (metaCtx.Major)
                    metadata.major = parseInt(value, 10);
                else if (metaCtx.Minor)
                    metadata.minor = parseInt(value, 10);
                else if (metaCtx.Build)
                    metadata.build = parseInt(value, 10);
                else if (metaCtx.Desc)
                    metadata.description = value.replace(/"/g, '');
            }
        }
        const localTagDefinitions = asCstNodes(bodyCtx.localTagDefinition);
        if (localTagDefinitions) {
            for (const localTagDef of localTagDefinitions) {
                const localTagCtx = localTagDef.children;
                let dataType = '';
                let dimension;
                const dataTypeNode = firstCstNode(localTagCtx.dataTypeWithArray);
                if (dataTypeNode) {
                    const dataTypeCtx = dataTypeNode.children;
                    dataType = extractText(dataTypeCtx.dataType?.[0]);
                    const arraySizeTokens = asTokens(dataTypeCtx.arraySize);
                    if (arraySizeTokens && arraySizeTokens.length > 0) {
                        dimension = parseInt(arraySizeTokens[0].image, 10);
                    }
                }
                const tagName = extractText(localTagCtx.tagName?.[0]);
                const tag = {
                    name: tagName,
                    dataType,
                    usage: 'local',
                    description: '',
                };
                if (dimension !== undefined) {
                    tag.dimension = dimension;
                }
                const propertiesNode = firstCstNode(localTagCtx.propertiesBlock);
                if (propertiesNode) {
                    const propsCtx = propertiesNode.children;
                    const propertyAssignments = asCstNodes(propsCtx.propertyAssignment);
                    if (propertyAssignments) {
                        const elements = {};
                        const structuredOverrides = {};
                        const isArrayTag = tag.dimension !== undefined;
                        let scalarDefault;
                        const isValuePath = (path) => {
                            if (!path)
                                return false;
                            if (path.includes('.'))
                                return false;
                            const lower = path.toLowerCase();
                            return lower === 'value' || lower === 'defaultvalue';
                        };
                        const getOrCreateElement = (index) => {
                            const key = String(index);
                            if (!elements[key]) {
                                elements[key] = {};
                            }
                            return elements[key];
                        };
                        const assignElementDefault = (index, rawValue) => {
                            const element = getOrCreateElement(index);
                            element.defaultValue = rawValue;
                        };
                        const setNestedProperty = (obj, path, value) => {
                            const parts = path.split('.');
                            let current = obj;
                            for (let i = 0; i < parts.length - 1; i++) {
                                const part = parts[i];
                                if (!(part in current) || typeof current[part] !== 'object') {
                                    current[part] = {};
                                }
                                current = current[part];
                            }
                            current[parts[parts.length - 1]] = value;
                        };
                        for (const propAssign of propertyAssignments) {
                            const propCtx = propAssign.children;
                            if (propCtx.elementIndex && propCtx.propertiesBlock) {
                                const index = parseInt(extractText(propCtx.elementIndex[0]), 10);
                                const elementProps = getOrCreateElement(index);
                                const nestedBlock = firstCstNode(propCtx.propertiesBlock);
                                if (nestedBlock) {
                                    const nestedAssignments = asCstNodes(nestedBlock.children.propertyAssignment);
                                    if (nestedAssignments) {
                                        const nestedOverrides = {};
                                        for (const nestedProp of nestedAssignments) {
                                            const nestedCtx = nestedProp.children;
                                            const path = extractPropertyPath(nestedCtx.propertyPath?.[0]);
                                            const value = parseLiteralValue(extractText(nestedCtx.literal?.[0]));
                                            if (path === 'desc') {
                                                elementProps.description = typeof value === 'string' ? value : String(value);
                                            }
                                            else if (isValuePath(path)) {
                                                assignElementDefault(index, value);
                                            }
                                            else {
                                                setNestedProperty(nestedOverrides, path, value);
                                            }
                                        }
                                        if (Object.keys(nestedOverrides).length > 0) {
                                            const existing = elementProps.defaultValue || {};
                                            elementProps.defaultValue = { ...existing, ...nestedOverrides };
                                        }
                                    }
                                }
                            }
                            else if (propCtx.arrayIndex) {
                                const index = parseInt(extractText(propCtx.arrayIndex[0]), 10);
                                const path = extractPropertyPath(propCtx.propertyPath?.[0]);
                                const value = parseLiteralValue(extractText(propCtx.literal?.[0]));
                                if (isValuePath(path)) {
                                    assignElementDefault(index, value);
                                }
                                else {
                                    const element = getOrCreateElement(index);
                                    const existing = element.defaultValue || {};
                                    setNestedProperty(existing, path, value);
                                    element.defaultValue = existing;
                                }
                            }
                            else if (propCtx.arrayValueIndex) {
                                const index = parseInt(extractText(propCtx.arrayValueIndex[0]), 10);
                                const value = parseLiteralValue(extractText(propCtx.literal?.[0]));
                                assignElementDefault(index, value);
                            }
                            else if (propCtx.propertyPath) {
                                const path = extractPropertyPath(propCtx.propertyPath[0]);
                                const value = parseLiteralValue(extractText(propCtx.literal?.[0]));
                                if (path === 'desc') {
                                    tag.description = typeof value === 'string' ? value : String(value);
                                }
                                else if (isValuePath(path)) {
                                    scalarDefault = value;
                                }
                                else {
                                    setNestedProperty(structuredOverrides, path, value);
                                }
                            }
                        }
                        if (Object.keys(elements).length > 0) {
                            tag.elements = elements;
                        }
                        if (isArrayTag) {
                            if (scalarDefault !== undefined) {
                                tag.defaultValue = scalarDefault;
                            }
                        }
                        else {
                            if (scalarDefault !== undefined) {
                                tag.defaultValue = scalarDefault;
                            }
                            else if (Object.keys(structuredOverrides).length > 0) {
                                tag.defaultValue = structuredOverrides;
                            }
                        }
                    }
                }
                tags.push(tag);
            }
        }
        const routineDefinitions = asCstNodes(bodyCtx.routineDefinition);
        if (routineDefinitions) {
            for (const routineDef of routineDefinitions) {
                const routineCtx = routineDef.children;
                const routineType = routineCtx.St ? 'st' : 'ld';
                const routineName = extractText(routineCtx.routineName?.[0]);
                const content = extractRoutineContent(originalText, routineName);
                let mappedName = 'Logic';
                if (routineName === 'Prescan')
                    mappedName = 'Prescan';
                else if (routineName === 'EnableInFalse')
                    mappedName = 'EnableInFalse';
                routines.push({
                    name: mappedName,
                    type: routineType,
                    content: content,
                });
            }
        }
    }
    if (routines.length === 0) {
        routines.push({
            name: 'Logic',
            type: 'st',
            content: '',
        });
    }
    return {
        name: aoiName || 'UnknownAOI',
        description: metadata.description ?? '',
        tags: tags,
        routines: routines,
        metadata: metadata,
    };
}
function removeRoutineContent(text) {
    const routineHeader = /routine\s+\w+\s+\w+\s*\(\s*\)\s*\{/gi;
    let result = '';
    let lastIndex = 0;
    let match;
    while ((match = routineHeader.exec(text)) !== null) {
        result += text.slice(lastIndex, match.index);
        result += match[0].replace(/\{\s*$/, '') + '{}';
        let i = match.index + match[0].length;
        let depth = 1;
        while (i < text.length && depth > 0) {
            const ch = text[i];
            if (ch === '{')
                depth++;
            else if (ch === '}')
                depth--;
            i++;
        }
        lastIndex = i;
    }
    result += text.slice(lastIndex);
    return result;
}
function extractRoutineContent(text, routineName) {
    const routinePattern = new RegExp(`routine\\s+\\w+\\s+${routineName}\\s*\\(\\s*\\)\\s*\\{`, 'i');
    const match = routinePattern.exec(text);
    if (match) {
        const start = match.index + match[0].length;
        let braceCount = 1;
        let i = start;
        while (i < text.length && braceCount > 0) {
            if (text[i] === '{')
                braceCount++;
            else if (text[i] === '}')
                braceCount--;
            if (braceCount > 0)
                i++;
        }
        if (braceCount === 0) {
            const rawContent = text.substring(start, i);
            const trimmedEnd = rawContent.replace(/\s+$/, '');
            const withoutLeadingNewline = trimmedEnd.replace(/^\s*\n/, '');
            return dedentRoutineContent(withoutLeadingNewline);
        }
    }
    return '';
}
export function parseAOIWithChevrotainImpl(text) {
    const diagnostics = [];
    try {
        const cleanedText = removeRoutineContent(text);
        const lexResult = AOILexer.tokenize(cleanedText);
        lexResult.errors.forEach((error) => {
            diagnostics.push({
                type: 'error',
                message: `Lexer error: ${error.message}`,
                line: error.line,
                column: error.column,
            });
        });
        aoiParser.input = lexResult.tokens;
        const cst = aoiParser.aoiDefinition();
        aoiParser.errors.forEach((error) => {
            diagnostics.push({
                type: 'error',
                message: `Parser error: ${error.message}`,
                line: error.token?.startLine,
                column: error.token?.startColumn,
            });
        });
        if (lexResult.errors.length > 0 || aoiParser.errors.length > 0) {
            return {
                aoi: {
                    name: 'ParseError',
                    description: '',
                    tags: [],
                    routines: [{ name: 'Logic', type: 'st', content: '' }],
                    metadata: {},
                },
                diagnostics,
            };
        }
        const aoi = cstToAOI(cst, text);
        diagnostics.push({
            type: 'info',
            message: `Successfully parsed AOI '${aoi.name}'`,
        });
        return {
            aoi,
            diagnostics,
        };
    }
    catch (error) {
        diagnostics.push({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown parsing error',
        });
        return {
            aoi: {
                name: 'ParseError',
                description: '',
                tags: [],
                routines: [{ name: 'Logic', type: 'st', content: '' }],
                metadata: {},
            },
            diagnostics,
        };
    }
}
