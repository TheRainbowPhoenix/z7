import { tonr } from './instructions/tonr.js';
import { tofr } from './instructions/tofr.js';
import { rtor } from './instructions/rtor.js';
import { ctud } from './instructions/ctud.js';
import { size } from './instructions/size.js';
export class STRuntime {
    staticBuiltIns = new Map([
        ['ABS', (x) => Math.abs(x)],
        ['MIN', (a, b) => Math.min(a, b)],
        ['MAX', (a, b) => Math.max(a, b)],
        ['SQRT', (x) => Math.sqrt(x)],
        ['SIN', (x) => Math.sin(x)],
        ['COS', (x) => Math.cos(x)],
        ['TAN', (x) => Math.tan(x)],
        ['CTUD', ctud],
        ['SIZE', size],
    ]);
    buildFunctions(scanTime) {
        const funcs = new Map(this.staticBuiltIns);
        funcs.set('TONR', (timer) => tonr(timer, scanTime));
        funcs.set('TOFR', (timer) => tofr(timer, scanTime));
        funcs.set('RTOR', (timer) => rtor(timer, scanTime));
        return funcs;
    }
    execute(compiledCode, context) {
        const scanTime = context.scanTime ?? 100;
        try {
            const func = new Function('context', 'vars', 'funcs', 'log', '__scanTime', `'use strict';\n${compiledCode}`);
            func({ variables: context.variables, logs: context.logs }, context.variables, Object.freeze(this.buildFunctions(scanTime)), context.logs, scanTime);
            return context;
        }
        catch (error) {
            context.logs.push(`Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return context;
        }
    }
}
// Convenience function for external use
export function executeCompiledCode(compiledCode, context) {
    const runtime = new STRuntime();
    return runtime.execute(compiledCode, context);
}
