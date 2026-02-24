// Parser module exports
export { STParser } from './parser.js';
// Convenience function for external use
import { Tokenizer } from '../lexer/tokenizer.js';
import { STParser } from './parser.js';
export function parseStructuredText(sourceCode) {
    const tokenizer = new Tokenizer(sourceCode);
    const tokens = tokenizer.tokenize();
    const lexerDiagnostics = tokenizer.getDiagnostics();
    const parser = new STParser(tokens);
    const parseResult = parser.parse();
    return {
        ...parseResult,
        errors: [...lexerDiagnostics, ...parseResult.errors],
    };
}
