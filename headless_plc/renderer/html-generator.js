export function renderLadder(ast, variables = null) {
    if (!ast || ast.type !== 'LDProgram') {
        return '<div class="text-red-500">Invalid Ladder Logic AST</div>';
    }
    const context = { variables };
    return `
    <style>
        .h-15 { height: 3.75rem; }
    </style>
    <div class="flex flex-col w-full h-full bg-gray-50 p-4 overflow-auto">
        ${ast.rungs.map(r => renderRung(r, context)).join('\n')}
    </div>`;
}

function renderRung(rung, context) {
    return `
    <div class="relative flex cursor-default opacity-100 pr-2 mb-2">
        <div>
            <div class="flex h-full">
                <div role="button" class="bg-transparent">
                    <div class="flex h-14 w-12 flex-none">
                        <div class="w-2"></div>
                        <p class="text-md my-auto select-none text-black font-mono">${rung.index}</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="relative flex w-full overflow-visible border-l border-slate-400">
            ${renderCircuit(rung.circuit, null, context)}
        </div>
    </div>`;
}

function renderCircuit(circuit, branchContext = null, context = {}) {
    const lastNonOutputIndex = findLastNonOutputIndex(circuit.elements);

    // Initial Spacer (full if no inputs, i.e., circuit starts with outputs)
    const initialSpacerFull = lastNonOutputIndex === -1;
    let html = renderSpacer(initialSpacerFull);

    const elementsHtml = circuit.elements.map((el, i) => {
        const isFullSpacer = i === lastNonOutputIndex;
        const isBranch = el.type === 'LDBranch';

        // Element Wrapper
        const wrapperClass = isBranch ? 'flex shrink-0 flex-col' : 'flex shrink-0';
        const elHtml = `
            <div class="${wrapperClass}">
                ${renderElement(el, context)}
            </div>`;

        // Following Spacer
        const spacerHtml = renderSpacer(isFullSpacer);

        return elHtml + spacerHtml;
    }).join('');

    // Branch Vertical Lines Logic
    let leftLines = '';
    let rightLines = '';

    if (branchContext) {
        const { isFirst, isLast } = branchContext;

        // Left Side
        if (!isFirst) {
            // Connects to previous (up)
            leftLines += '<div class="absolute top-0 left-0 w-px h-1/2 bg-slate-400"></div>';
        }
        if (!isLast) {
            // Connects to next (down)
            leftLines += '<div class="absolute bottom-0 left-0 w-px h-1/2 bg-slate-400"></div>';
        }

        // Right Side
        if (!isFirst) {
            // Connects to previous (up)
            rightLines += '<div class="absolute top-0 right-0 w-px h-1/2 bg-slate-400"></div>';
        }
        if (!isLast) {
            // Connects to next (down)
            rightLines += '<div class="absolute bottom-0 right-0 w-px h-1/2 bg-slate-400"></div>';
        }
    }

    return `
    <div class="flex min-w-full shrink-0">
        <div class="flex min-w-full shrink-0">
            <div class="relative flex min-w-full shrink-0">
                 ${leftLines}
                 ${html}
                 ${elementsHtml}
                 ${rightLines}
            </div>
        </div>
    </div>`;
}

function renderSpacer(full) {
    const widthClass = full ? 'w-full' : 'w-4';
    return `
    <div class="flex h-15 min-w-4 flex-col justify-center ${widthClass}">
        <div class="h-px w-full bg-slate-400"></div>
    </div>`;
}

function findLastNonOutputIndex(elements) {
    // Iterate backwards to find the last element that is NOT an output instruction.
    // OTE, OTL, OTU are considered outputs.
    // Branches and other instructions are considered inputs/intermediates.
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === 'LDInstruction') {
            if (!['OTE', 'OTL', 'OTU'].includes(el.instructionType)) {
                return i;
            }
        } else {
            // LDBranch is treated as input/intermediate logic
            return i;
        }
    }
    return -1;
}

function renderElement(element, context) {
    if (element.type === 'LDBranch') {
        return renderBranch(element, context);
    }
    if (element.type === 'LDInstruction') {
        return renderInstruction(element, context);
    }
    return '';
}

function renderInstruction(instruction, context) {
    const type = instruction.instructionType;
    const params = instruction.parameters;

    switch (type) {
        case 'XIC': return renderContact('XIC', params[0], context);
        case 'XIO': return renderContact('XIO', params[0], context);
        case 'OTE': return renderCoil('OTE', params[0], context);
        case 'OTL': return renderCoil('OTL', params[0], context);
        case 'OTU': return renderCoil('OTU', params[0], context);
        case 'TON':
        case 'TOF':
        case 'RTO':
        case 'CTU':
        case 'CTD':
        case 'MOVE':
        case 'ADD':
        case 'SUB':
        case 'MUL':
        case 'DIV':
        case 'EQ':
        case 'NE':
        case 'GT':
        case 'GE':
        case 'LT':
        case 'LE':
        case 'LIMIT':
            return renderBlock(type, params, context);
        default:
            return `<div class="border border-red-500 p-1">Unknown: ${type}</div>`;
    }
}

function renderParameter(param) {
    if (!param) return '?';
    if (param.type === 'LDTagReference') return param.name;
    if (param.type === 'LDNumericLiteral') return String(param.value);
    if (param.type === 'LDMemberAccess') return `${renderParameter(param.object)}.${param.member}`;
    if (param.type === 'LDIndexedAccess') return `${renderParameter(param.target)}[${renderParameter(param.index)}]`;
    return '?';
}

function getTagValue(paramName, variables) {
    if (!variables || !paramName) return undefined;
    // Simple lookup. Does not handle nested member access resolution against the map keys if they are flattened?
    // In server.js variables is a Map of flattened keys if possible, or just top level.
    // The previous implementation used Map<string, number>.
    // But struct access `Timer.DN` needs to be resolved.
    // server.js initializes variables using `aoi.tags`.
    // If we have a Timer tag `MyTimer`, variables has `MyTimer`.
    // But we might not have `MyTimer.DN` as a separate key if it's an object in the Map.
    // Let's assume variables map contains objects for structs.

    if (variables.has(paramName)) return variables.get(paramName);

    // Try member access splitting
    if (paramName.includes('.')) {
        const parts = paramName.split('.');
        let current = variables.get(parts[0]);
        for (let i = 1; i < parts.length; i++) {
            if (current && typeof current === 'object') {
                current = current[parts[i]];
            } else {
                return undefined;
            }
        }
        return current;
    }
    return undefined;
}

function renderContact(type, param, context) {
    const tagName = renderParameter(param);
    const isXIO = type === 'XIO';

    let isActive = false;
    if (context.variables) {
        const val = getTagValue(tagName, context.variables);
        if (val !== undefined) {
            isActive = Boolean(val);
        }
    }

    // XIC: Green if True
    // XIO: Green if False
    const isGreen = isXIO ? !isActive : isActive;

    const symbolColor = isGreen ? 'bg-green-400' : '';

    return `
    <div class="inline-flex" title="${type} ${tagName}" data-tag="${tagName}" data-instruction-type="${type}">
        <div class="flex shrink-0 cursor-default focus:outline-hidden opacity-100">
            <div class="inline-grid grid-cols-[min-content_minmax(min-content,1.25rem)_min-content] grid-rows-[1.25rem_1.25rem]">

                <div class="col-start-1 col-end-4 row-start-1">
                    <div class="h-full w-full border-x-2 border-t-2 border-transparent hover:border-blue-200"></div>
                </div>
                <div class="relative col-start-1 col-end-4 row-start-2">
                    <div class="absolute -bottom-px -top-px left-0 right-0 border-x-2 border-b-2 border-transparent hover:border-blue-200"></div>
                </div>

                <div class="col-start-1 col-end-4 row-start-1 flex flex-col justify-center">
                    <p class="px-1 text-center text-sm text-black truncate max-w-[100px]">${tagName}</p>
                </div>

                <div class="relative col-start-1 row-start-2 flex h-5 min-w-[16px] py-0.5">
                    <div class="absolute top-0 -right-0.5 bottom-0 left-0 flex items-center">
                        <div class="h-px w-full bg-slate-400"></div>
                    </div>
                    <div class="w-1/2"></div>
                    <div class="my-1 w-1/2 ${symbolColor}"></div>
                </div>

                <div class="relative col-start-2 row-start-2 flex h-5 py-0.5">
                    <div class="w-1 border-y border-r border-slate-400"></div>
                    <div class="w-3 flex items-center justify-center">
                        ${isXIO ? '<span class="-mt-0.5 select-none text-sm/6 text-slate-400">/</span>' : ''}
                    </div>
                    <div class="w-1 border-y border-l border-slate-400"></div>
                </div>

                <div class="relative col-start-3 row-start-2 flex h-5 min-w-[16px] py-0.5">
                    <div class="absolute top-0 right-0 bottom-0 -left-0.5 flex items-center">
                        <div class="h-px w-full bg-slate-400"></div>
                    </div>
                    <div class="my-1 w-1/2 ${symbolColor}"></div>
                    <div class="w-1/2"></div>
                </div>

            </div>
        </div>
    </div>`;
}

function renderCoil(type, param, context) {
    const tagName = renderParameter(param);
    let symbolChar = '';
    if (type === 'OTL') symbolChar = 'L';
    if (type === 'OTU') symbolChar = 'U';

    let isActive = false;
    if (context.variables) {
        const val = getTagValue(tagName, context.variables);
        if (val !== undefined) {
            isActive = Boolean(val);
        }
    }
    const symbolColor = isActive ? 'bg-green-400' : '';

    return `
    <div class="inline-flex" title="${type} ${tagName}" data-tag="${tagName}" data-instruction-type="${type}">
        <div class="flex shrink-0 cursor-default focus:outline-hidden opacity-100">
            <div class="inline-grid grid-cols-[min-content_minmax(min-content,1.25rem)_min-content] grid-rows-[1.25rem_1.25rem]">

                <div class="col-start-1 col-end-4 row-start-1">
                    <div class="h-full w-full border-x-2 border-t-2 border-transparent hover:border-blue-200"></div>
                </div>
                <div class="relative col-start-1 col-end-4 row-start-2">
                    <div class="absolute -bottom-px -top-px left-0 right-0 border-x-2 border-b-2 border-transparent hover:border-blue-200"></div>
                </div>

                <div class="col-start-1 col-end-4 row-start-1 flex flex-col justify-center">
                    <p class="px-1 text-center text-sm text-black truncate max-w-[100px]">${tagName}</p>
                </div>

                <div class="relative col-start-1 row-start-2 flex h-5 min-w-[16px] py-0.5">
                    <div class="absolute top-0 -right-0.5 bottom-0 left-0 flex items-center">
                        <div class="h-px w-full bg-slate-400"></div>
                    </div>
                    <div class="w-1/2"></div>
                    <div class="my-1 w-1/2 ${symbolColor}"></div>
                </div>

                <div class="relative col-start-2 row-start-2 flex h-5 py-0.5">
                    <div class="w-0.5"></div>
                    <div class="w-2 rounded-tl-full rounded-bl-full border border-r-0 border-slate-400 ${isActive ? 'bg-green-200' : ''}"></div>
                    <div class="flex items-center justify-center w-2 ${isActive ? 'bg-green-200' : ''}">
                        <span class="select-none text-sm text-slate-400 font-bold">${symbolChar}</span>
                    </div>
                    <div class="w-2 rounded-tr-full rounded-br-full border border-l-0 border-slate-400 ${isActive ? 'bg-green-200' : ''}"></div>
                    <div class="w-0.5"></div>
                </div>

                <div class="relative col-start-3 row-start-2 flex h-5 min-w-[16px] py-0.5">
                    <div class="absolute top-0 right-0 bottom-0 -left-0.5 flex items-center">
                        <div class="h-px w-full bg-slate-400"></div>
                    </div>
                    <div class="my-1 w-1/2 ${symbolColor}"></div>
                    <div class="w-1/2"></div>
                </div>

            </div>
        </div>
    </div>`;
}

const BLOCK_PARAMS = {
    'TON': ['Timer', 'Preset', 'Accum'],
    'TOF': ['Timer', 'Preset', 'Accum'],
    'RTO': ['Timer', 'Preset', 'Accum'],
    'CTU': ['Counter', 'Preset', 'Accum'],
    'CTD': ['Counter', 'Preset', 'Accum'],
    'MOVE': ['Source', 'Dest'],
    'ADD': ['Source A', 'Source B', 'Dest'],
    'SUB': ['Source A', 'Source B', 'Dest'],
    'MUL': ['Source A', 'Source B', 'Dest'],
    'DIV': ['Source A', 'Source B', 'Dest'],
    'EQ': ['Source A', 'Source B'],
    'NE': ['Source A', 'Source B'],
    'GT': ['Source A', 'Source B'],
    'GE': ['Source A', 'Source B'],
    'LT': ['Source A', 'Source B'],
    'LE': ['Source A', 'Source B'],
    'LIMIT': ['Low Limit', 'Test', 'High Limit']
};

function renderBlock(type, params, context) {
    const paramNames = BLOCK_PARAMS[type] || [];

    const paramRows = params.map((p, i) => {
        const pName = renderParameter(p);
        const pLabel = paramNames[i] || `Param ${i}`;
        let displayVal = pName;

        if (context.variables) {
            const val = getTagValue(pName, context.variables);
            if (val !== undefined && val !== null && typeof val !== 'object') {
                // Show value
                // displayVal = `${val}`; // Just value?
                // Or Name = Value?
                // Logic viewers usually show value if it's a variable.
                displayVal = String(val);
            } else if (p.type === 'LDNumericLiteral') {
                displayVal = String(p.value);
            }
        }

        return `
        <div class="flex min-h-5 items-start justify-between gap-3 border-x bg-white px-2 border-slate-400">
            <p class="text-sm text-slate-500">${pLabel}</p>
            <div class="flex flex-col items-end">
                <p class="min-w-12 text-right text-sm text-black tabular-nums" title="${pName}">${displayVal}</p>
            </div>
        </div>`;
    }).join('');

    return `
    <div class="inline-flex" title="${type}" data-instruction-type="${type}">
        <div class="flex shrink-0 cursor-default focus:outline-hidden opacity-100">
            <div class="mb-2 flex flex-col self-start shadow-sm min-w-[120px]">
                <div class="flex h-6 items-center justify-center border border-slate-400 bg-blue-100">
                    <p class="text-sm font-bold text-slate-700">${type}</p>
                </div>
                ${paramRows}
                <div class="border-t border-slate-400"></div>
            </div>
        </div>
    </div>`;
}

function renderBranch(branch, context) {
    const circuitsHtml = branch.circuits.map((circuit, index) => {
        const isFirst = index === 0;
        const isLast = index === branch.circuits.length - 1;

        // Pass context to renderCircuit for vertical line rendering
        return renderCircuit(circuit, { isBranch: true, isFirst, isLast }, context);
    }).join('');

    return `
    <div class="flex shrink-0 flex-col">
        ${circuitsHtml}
    </div>`;
}
