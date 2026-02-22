export function renderLadder(ast) {
    if (!ast || ast.type !== 'LDProgram') {
        return '<div class="text-red-500">Invalid Ladder Logic AST</div>';
    }
    return `
    <div class="flex flex-col w-full h-full bg-gray-50 p-4 overflow-auto">
        ${ast.rungs.map(renderRung).join('\n')}
    </div>`;
}

function renderRung(rung) {
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
            <div class="flex min-w-full shrink-0">
                ${renderCircuit(rung.circuit)}
                <div class="relative flex h-15 min-w-4 flex-col justify-center w-full">
                    <div class="h-px w-full bg-slate-400"></div>
                </div>
            </div>
        </div>
    </div>`;
}

function renderCircuit(circuit) {
    return circuit.elements.map(renderElement).join('');
}

function renderElement(element) {
    if (element.type === 'LDBranch') {
        return renderBranch(element);
    }
    if (element.type === 'LDInstruction') {
        return renderInstructionWrapper(element);
    }
    return '';
}

function renderInstructionWrapper(instruction) {
    const innerHtml = renderInstruction(instruction);
    return `
    <div class="flex min-w-full shrink-0">
        <div class="relative flex min-w-full shrink-0">
            <div class="relative flex h-15 min-w-4 flex-col justify-center w-4">
                <div class="h-px w-full bg-slate-400"></div>
            </div>
            <div class="flex shrink-0">
                ${innerHtml}
            </div>
        </div>
    </div>`;
}

function renderInstruction(instruction) {
    const type = instruction.instructionType;
    const params = instruction.parameters;

    switch (type) {
        case 'XIC': return renderContact('XIC', params[0]);
        case 'XIO': return renderContact('XIO', params[0]);
        case 'OTE': return renderCoil('OTE', params[0]);
        case 'OTL': return renderCoil('OTL', params[0]);
        case 'OTU': return renderCoil('OTU', params[0]);
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
            return renderBlock(type, params);
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

function renderContact(type, param) {
    const tagName = renderParameter(param);
    const isXIO = type === 'XIO';
    const symbolColor = isXIO ? 'bg-green-400' : '';

    return `
    <div class="inline-flex" title="${type} ${tagName}">
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

function renderCoil(type, param) {
    const tagName = renderParameter(param);
    let symbolChar = '';
    if (type === 'OTL') symbolChar = 'L';
    if (type === 'OTU') symbolChar = 'U';

    return `
    <div class="inline-flex" title="${type} ${tagName}">
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
                    <div class="my-1 w-1/2"></div>
                </div>

                <div class="relative col-start-2 row-start-2 flex h-5 py-0.5">
                    <div class="w-0.5"></div>
                    <div class="w-2 rounded-tl-full rounded-bl-full border border-r-0 border-slate-400"></div>
                    <div class="flex items-center justify-center w-2">
                        <span class="select-none text-sm text-slate-400 font-bold">${symbolChar}</span>
                    </div>
                    <div class="w-2 rounded-tr-full rounded-br-full border border-l-0 border-slate-400"></div>
                    <div class="w-0.5"></div>
                </div>

                <div class="relative col-start-3 row-start-2 flex h-5 min-w-[16px] py-0.5">
                    <div class="absolute top-0 right-0 bottom-0 -left-0.5 flex items-center">
                        <div class="h-px w-full bg-slate-400"></div>
                    </div>
                    <div class="my-1 w-1/2"></div>
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

function renderBlock(type, params) {
    const paramNames = BLOCK_PARAMS[type] || [];

    const paramRows = params.map((p, i) => {
        const pVal = renderParameter(p);
        const pLabel = paramNames[i] || `Param ${i}`;
        return `
        <div class="flex min-h-5 items-start justify-between gap-3 border-x bg-white px-2 border-slate-400">
            <p class="text-sm text-slate-500">${pLabel}</p>
            <div class="flex flex-col items-end">
                <p class="min-w-12 text-right text-sm text-black tabular-nums">${pVal}</p>
            </div>
        </div>`;
    }).join('');

    return `
    <div class="inline-flex" title="${type}">
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

function renderBranch(branch) {
    const circuitsHtml = branch.circuits.map((circuit, index) => {
        const isFirst = index === 0;
        const isLast = index === branch.circuits.length - 1;

        return `
        <div class="flex flex-row">
            <div class="relative flex flex-col w-4">
                ${!isFirst ? '<div class="absolute top-0 left-0 w-px h-1/2 bg-slate-400"></div>' : ''}
                ${!isLast ? '<div class="absolute bottom-0 left-0 w-px h-1/2 bg-slate-400"></div>' : ''}
                <div class="absolute top-1/2 left-0 w-full h-px bg-slate-400"></div>
            </div>

            <div class="flex flex-row">
                ${renderCircuit(circuit)}
            </div>

             <div class="relative flex flex-col w-4">
                ${!isFirst ? '<div class="absolute top-0 right-0 w-px h-1/2 bg-slate-400"></div>' : ''}
                ${!isLast ? '<div class="absolute bottom-0 right-0 w-px h-1/2 bg-slate-400"></div>' : ''}
                <div class="absolute top-1/2 right-0 w-full h-px bg-slate-400"></div>
            </div>
        </div>`;
    }).join('');

    return `
    <div class="flex flex-col ml-2 mr-2">
        ${circuitsHtml}
    </div>`;
}
