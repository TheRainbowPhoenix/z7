import { compileLadderLogic, compileStructuredText, createExecutionContext } from './compiler/index.js';
import { getMembersForDataType } from './core/utils/tag-utils.js';

// Mock compilation context
const context = {
    tags: [
        { name: 'Tag1', dataType: 'BOOL', usage: 'local', defaultValue: false },
        { name: 'Tag2', dataType: 'BOOL', usage: 'local', defaultValue: false },
        { name: 'Counter1', dataType: 'COUNTER', usage: 'local', defaultValue: undefined, members: getMembersForDataType('COUNTER') },
        { name: 'Timer1', dataType: 'TIMER', usage: 'local', defaultValue: undefined, members: getMembersForDataType('TIMER') }
    ]
};

// Ladder Logic Demo
const ldSource = `
XIC(Tag1) OTE(Tag2);
XIC(Tag2) CTU(Counter1, 5, 0);
`;

console.log('--- Compiling Ladder Logic ---');
const ldResult = compileLadderLogic(ldSource, context);
console.log('LD Compilation Success:', ldResult.success);

if (!ldResult.success) {
    console.error('LD Errors:', ldResult.diagnostics);
} else {
    console.log('LD Generated Code (Snippet):\n', ldResult.code.substring(0, 200) + '...');

    // Execute
    console.log('\n--- Executing Ladder Logic ---');
    const execContext = createExecutionContext();
    const vars = execContext.variables;
    const log = execContext.logs;
    const __scanTime = 10;

    // Initialize variables
    vars.set('Tag1', 1); // Set Tag1 to true (input)
    vars.set('Tag2', 0);
    // Counter needs initialization structure
    vars.set('Counter1', { PRE: 5, ACC: 0, CU: 0, CD: 0, DN: 0, OV: 0, UN: 0 });

    try {
        // Evaluate the code with the context variables in scope
        const runCode = new Function('vars', 'log', '__scanTime', ldResult.code);
        runCode(vars, log, __scanTime);

        console.log('Execution Result:');
        console.log('Tag1 (Input):', vars.get('Tag1'));
        console.log('Tag2 (Output):', vars.get('Tag2'));
        console.log('Counter1 (Accumulator):', vars.get('Counter1').ACC);
        console.log('Counter1 (Done):', vars.get('Counter1').DN);
    } catch (e) {
        console.error('Execution Error:', e);
    }
}

// Structured Text Demo
const stSource = `
IF Tag1 THEN
    Tag2 := TRUE;
ELSE
    Tag2 := FALSE;
END_IF;
`;

console.log('\n--- Compiling Structured Text ---');
const stResult = compileStructuredText(stSource, context);
console.log('ST Compilation Success:', stResult.success);

if (!stResult.success) {
    console.error('ST Errors:', stResult.diagnostics);
} else {
    console.log('ST Generated Code (Snippet):\n', stResult.code.substring(0, 200) + '...');
}
