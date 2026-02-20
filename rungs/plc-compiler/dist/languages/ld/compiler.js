import { parseLadderLogic } from './parser/index.js';
import { LDSemanticAnalyzer } from './analysis/index.js';
import { LDCodeGenerator } from './codegen/code-generator.js';
export class LDCompiler {
    codeGenerator = new LDCodeGenerator();
    compile(sourceCode, context) {
        const diagnostics = [];
        const parseResult = parseLadderLogic(sourceCode);
        const ast = parseResult.ast;
        parseResult.errors.forEach((error) => {
            diagnostics.push({ ...error, type: 'ld', rung: error.rung ?? 0 });
        });
        parseResult.warnings.forEach((warning) => {
            diagnostics.push({ ...warning, type: 'ld', rung: warning.rung ?? 0 });
        });
        const analyzer = new LDSemanticAnalyzer(context);
        const semanticDiagnostics = analyzer.analyze(ast);
        diagnostics.push(...semanticDiagnostics);
        const hasErrors = diagnostics.some((d) => d.severity === 'error');
        let jsCode;
        if (!hasErrors && ast) {
            try {
                jsCode = this.codeGenerator.generate(ast, context);
            }
            catch (error) {
                diagnostics.push({
                    type: 'ld',
                    severity: 'error',
                    message: error instanceof Error ? error.message : 'Code generation failed',
                    code: 'LD-CG-001',
                    source: 'semantic',
                    rung: 0,
                });
            }
        }
        return {
            success: !hasErrors,
            code: jsCode,
            diagnostics,
        };
    }
}
export function compileLadderLogic(sourceCode, context) {
    const compiler = new LDCompiler();
    return compiler.compile(sourceCode, context);
}
