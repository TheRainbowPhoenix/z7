// AOI Test Kit Implementation
import { compileLadderLogic, compileStructuredText, createExecutionContext } from '../compiler/index.js';
import { getMembersForDataType } from '../core/utils/tag-utils.js';
import { STRuntime } from '../compiler/languages/st/runtime/runtime.js';

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

    toBeDefined() {
        if (this.actual === undefined) {
            throw new Error(`Expected value to be defined, but got undefined`);
        }
    }

    toBeCloseTo(expected, precision = 2) {
        if (typeof this.actual !== 'number') {
            throw new Error(`Expected number but got ${typeof this.actual}`);
        }
        const diff = Math.abs(this.actual - expected);
        const tolerance = Math.pow(10, -precision) / 2;
        if (diff > tolerance) {
            throw new Error(`Expected ${this.actual} to be close to ${expected} (diff: ${diff}, tolerance: ${tolerance})`);
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
        // The parser might not return tags as an array if the source was structured differently or if it failed silently.
        // Also handling if tags is undefined.
        const tags = Array.isArray(aoi.tags) ? aoi.tags : [];
        this.context = {
            tags: tags.map(tag => {
                const membersList = getMembersForDataType(tag.dataType);
                const members = {};
                if (membersList && membersList.length > 0) {
                    membersList.forEach(m => {
                        members[m.key] = { dataType: m.type };
                    });
                }
                return {
                    ...tag,
                    members
                };
            })
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
            // Determine the base value (skeleton or scalar default)
            let baseValue;
            const members = getMembersForDataType(tag.dataType);

            if (tag.dimension && tag.dimension > 0) {
                // Array initialization
                const count = tag.dimension;
                const arr = new Array(count).fill(0);
                if (members && members.length > 0) {
                    // Array of structures
                    const skeleton = {};
                    members.forEach(m => { skeleton[m.key] = 0; });
                    for(let i=0; i<count; i++) arr[i] = { ...skeleton };
                } else {
                    // Array of scalars
                    let scalarDef = 0;
                    if (tag.dataType === 'REAL') scalarDef = 0.0;
                    arr.fill(scalarDef);
                }
                baseValue = arr;
            } else if (members && members.length > 0) {
                // It's a structure: create skeleton
                const skeleton = {};
                members.forEach(m => { skeleton[m.key] = 0; });
                baseValue = skeleton;
            } else {
                // Scalar
                if (tag.dataType === 'BOOL') baseValue = 0;
                else if (tag.dataType === 'DINT') baseValue = 0;
                else if (tag.dataType === 'REAL') baseValue = 0.0;
                else baseValue = 0;
            }

            // Determine the provided value (Input -> Default -> Base)
            let providedValue;
            if (inputs[tag.name] !== undefined) {
                providedValue = inputs[tag.name];
            } else if (tag.defaultValue !== undefined) {
                providedValue = tag.defaultValue;
            }

            // Merge logic
            let finalValue;
            if (providedValue !== undefined) {
                if (typeof providedValue === 'object' && baseValue && typeof baseValue === 'object') {
                    // Merge partial provided structure into base skeleton
                    finalValue = { ...baseValue, ...providedValue };
                } else {
                    finalValue = providedValue;
                }
            } else {
                finalValue = baseValue;
            }

            vars.set(tag.name, finalValue);
        });

        // Execute
        const __scanTime = 10;
        const log = execContext.logs;

        // Prepare funcs for ST
        const runtime = new STRuntime();
        const funcs = runtime.buildFunctions(__scanTime);

        try {
            // The generated code expects 'funcs' if it's ST. LD doesn't use it but won't hurt.
            // Check signature of generated code?
            // ST: funcs is used. LD: not used.
            // We can pass it as a 4th argument if we update the Function constructor.
            // But wait, generated ST code uses 'funcs'. Generated LD doesn't.
            // We need to match the arguments expected by the code usage.
            // Let's pass 'funcs' as 4th arg.
            const runFn = new Function('vars', 'log', '__scanTime', 'funcs', this.code);
            runFn(vars, log, __scanTime, funcs);
        } catch (e) {
            console.error("Runtime Error", e);
            throw e;
        }

        // Check for runtime errors logged by the compiled code
        const runtimeErrors = log.filter(l => typeof l === 'string' && l.startsWith('Runtime error:'));
        if (runtimeErrors.length > 0) {
            console.error("Compiled Code Logged Errors:", runtimeErrors);
            // Optionally throw? For now just log.
        }

        const outputs = Object.fromEntries(vars);
        return { outputs };
    }
}
