export * from './languages/st/index.js';
export * from './languages/ld/index.js';
export function createExecutionContext(options = {}) {
    const context = {
        variables: new Map(),
        logs: [],
    };
    if (typeof options.scanTime === 'number') {
        context.scanTime = options.scanTime;
    }
    return context;
}
