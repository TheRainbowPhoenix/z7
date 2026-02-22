import { LDTokenizer } from '../lexer/tokenizer.js';
import { LDParser } from './parser.js';
export { LDParser } from './parser.js';
export function parseLadderLogic(source) {
    const tokenizer = new LDTokenizer(source);
    const tokens = tokenizer.tokenize();
    const lexerDiagnostics = tokenizer.getDiagnostics();
    const parser = new LDParser(tokens);
    const result = parser.parse();
    return {
        ast: result.ast,
        errors: [...lexerDiagnostics, ...result.errors],
        warnings: result.warnings,
    };
}
