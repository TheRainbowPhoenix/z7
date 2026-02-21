// AOI Test Kit Implementation
import { compileLadderLogic, compileStructuredText, createExecutionContext } from '../compiler/index.js';
import { getMembersForDataType } from '../core/utils/tag-utils.js';

class Expectation {
    constructor(actual) {
        this.actual = actual;
    }

    toBe(expected) {
        if (this.actual !== expected) {
            throw new Error(`Expected ${expected}, but got ${this.actual}`);
        }
    }

    toBeGreaterThan(expected) {
        if (!(this.actual > expected)) {
            throw new Error(`Expected ${this.actual} to be > ${expected}`);
        }
    }

    toBeLessThan(expected) {
        if (!(this.actual < expected)) {
            throw new Error(`Expected ${this.actual} to be < ${expected}`);
        }
    }
}

export function expect(actual) {
    return new Expectation(actual);
}

export function describe(name, fn) {
    console.log(`\n--- ${name} ---`);
    fn();
}

export function it(name, fn) {
    try {
        fn();
        console.log(`PASS: ${name}`);
    } catch (e) {
        console.error(`FAIL: ${name}`);
        console.error(e.message);
        // We do not exit immediately so other tests can run, but should mark failure.
    }
}

export class AOITestKit {
    constructor(aoi) {
        this.aoi = aoi;
        this.context = {
            tags: aoi.tags.map(tag => ({
                ...tag,
                members: getMembersForDataType(tag.dataType)
            }))
        };

        const logicRoutine = aoi.routines.Logic;
        if (!logicRoutine) {
             throw new Error("No Logic routine found");
        }

        let result;
        if (logicRoutine.type === 'ld') {
            console.log("Compiling LD...");
            result = compileLadderLogic(logicRoutine.content, this.context);
        } else {
             console.log("Compiling ST...");
            result = compileStructuredText(logicRoutine.content, this.context);
        }

        if (!result.success) {
            console.error("Compilation Errors:", result.diagnostics);
            throw new Error("Compilation failed");
        }
        this.code = result.code;
    }

    run(inputs = {}) {
        const execContext = createExecutionContext();
        const vars = execContext.variables;

        // Initialize variables based on tags
        this.aoi.tags.forEach(tag => {
            let initialValue;
            if (inputs[tag.name] !== undefined) {
                initialValue = inputs[tag.name];
            } else if (tag.defaultValue !== undefined) {
                 initialValue = tag.defaultValue;
            } else {
                 // Default zero values
                 if (tag.dataType === 'BOOL') initialValue = 0;
                 else if (tag.dataType === 'DINT') initialValue = 0;
                 else if (tag.dataType === 'REAL') initialValue = 0.0;
                 else initialValue = {}; // Structures
            }
            vars.set(tag.name, initialValue);
        });

        // Execute
        const __scanTime = 10;
        const log = execContext.logs;
        try {
            const runFn = new Function('vars', 'log', '__scanTime', this.code);
            runFn(vars, log, __scanTime);
        } catch (e) {
            console.error("Runtime Error", e);
            throw e;
        }

        const outputs = Object.fromEntries(vars);
        return { outputs };
    }
}
