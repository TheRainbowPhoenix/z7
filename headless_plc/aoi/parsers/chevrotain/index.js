import { parseAOIWithChevrotainImpl } from './parser-engine.js';
export function parseAOIWithChevrotain(text) {
    return parseAOIWithChevrotainImpl(text);
}
// Export types and components for testing
export * from './types.js';
export { AOILexer } from './lexer.js';
export { aoiParser } from './parser.js';
