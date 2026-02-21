/**
 * @module PLC-Compiler
 * @description Provides functionality to compile Ladder Logic (LD) and Structured Text (ST) into executable JavaScript.
 */

export * from './languages/st/index.js';
export * from './languages/ld/index.js';

/**
 * Creates an execution context for running compiled PLC code.
 * The context holds variables and runtime logs.
 *
 * @param {Object} [options={}] - Configuration options for the execution context.
 * @param {number} [options.scanTime] - The scan time in milliseconds (default is implementation dependent).
 * @returns {ExecutionContext} A context object containing `variables` (Map) and `logs` (Array).
 */
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
