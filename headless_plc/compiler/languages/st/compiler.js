import { parseStructuredText } from './parser/index.js';
import { SemanticAnalyzer } from './analysis/index.js';
import { STCodeGenerator } from './codegen/code-generator.js';
import { STRuntime } from './runtime/runtime.js';
export class STCompiler {
    codeGenerator = new STCodeGenerator();
    runtime = new STRuntime();
    compile(sourceCode, context) {
        const diagnostics = [];
        const parseResult = parseStructuredText(sourceCode);
        const ast = parseResult.ast;
        parseResult.errors.forEach((error) => {
            diagnostics.push({
                type: 'st',
                severity: 'error',
                message: error.message,
                line: error.line,
                column: error.column,
                endLine: error.endLine,
                endColumn: error.endColumn,
                code: error.code,
                source: error.source,
            });
        });
        parseResult.warnings.forEach((warning) => {
            diagnostics.push({
                type: 'st',
                severity: 'warning',
                message: warning.message,
                line: warning.line,
                column: warning.column,
                endLine: warning.endLine,
                endColumn: warning.endColumn,
                code: warning.code,
                source: warning.source,
            });
        });
        const analyzer = new SemanticAnalyzer(context, sourceCode);
        const semanticDiagnostics = analyzer.analyze(ast);
        diagnostics.push(...semanticDiagnostics);
        const hasErrors = diagnostics.some((d) => d.severity === 'error');
        let jsCode;
        if (!hasErrors && ast) {
            try {
                jsCode = this.codeGenerator.generate(ast);
            }
            catch (error) {
                diagnostics.push({
                    type: 'st',
                    severity: 'error',
                    message: error instanceof Error ? error.message : 'Code generation failed',
                    line: 1,
                    column: 1,
                    code: 'ST-CG-001',
                    source: 'semantic',
                });
            }
        }
        return {
            success: !hasErrors,
            code: jsCode,
            ast: ast,
            diagnostics: diagnostics,
        };
    }
    execute(compiledCode, context) {
        return this.runtime.execute(compiledCode, context);
    }
}
export function compileStructuredText(sourceCode, context) {
    const compiler = new STCompiler();
    return compiler.compile(sourceCode, context);
}
