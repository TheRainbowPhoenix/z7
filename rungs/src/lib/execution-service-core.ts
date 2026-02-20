import {
  executeCompiledCode,
  createExecutionContext,
  type CompilationResult,
  type ExecutionContext,
  type CompilationContext,
  type ExecutionContextOptions,
  type RuntimeLog,
} from '@repo/plc-compiler';
import { type AOIDefinition } from '@repo/plc-core';
import { cloneCompilationValue } from './st-compilation-context';
import {
  clearCompilerCache,
  compileRoutine,
  compileSource,
  invalidateCompilerCacheForAOI,
} from './st-compiler-service';
import { extractExecutionParameters, normalizeBool } from './materialize-tag';

export type ExecutionParameters = Record<string, unknown>;
export interface ExecutionOptions extends ExecutionContextOptions {
  timeoutMs?: number;
}

export class ExecutionServiceCore {
  static compile(sourceCode?: string, context?: CompilationContext): CompilationResult {
    const code = sourceCode ?? '';

    if (!code.trim()) {
      return {
        success: false,
        error: 'No source code provided',
        diagnostics: [
          {
            type: 'service',
            severity: 'error',
            message: 'No source code provided',
          },
        ],
      };
    }

    try {
      return compileSource({ source: code, contextOverride: context });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown compilation error',
        diagnostics: [
          {
            type: 'service',
            severity: 'error',
            message: error instanceof Error ? error.message : 'Unknown compilation error',
          },
        ],
      };
    }
  }

  static execute(
    compilationResult: CompilationResult,
    parameters: ExecutionParameters = {},
    options: ExecutionOptions = {},
  ): ExecutionContext {
    if (!compilationResult.success || !compilationResult.code) {
      throw new Error('Cannot execute unsuccessful compilation');
    }

    const { ...contextOptions } = options;
    const context = createExecutionContext(contextOptions);

    Object.entries(parameters).forEach(([key, value]) => {
      context.variables.set(key, value);
    });

    return executeCompiledCode(compilationResult.code, context);
  }

  static executeRoutine(
    aoi: AOIDefinition,
    routineName: string,
    parameters: ExecutionParameters = {},
    options: ExecutionOptions = {},
  ): {
    compilationResult: CompilationResult;
    executionContext?: ExecutionContext;
  } {
    const routine = aoi.routines[routineName as keyof typeof aoi.routines];
    if (!routine) {
      return {
        compilationResult: {
          success: false,
          error: `Routine '${routineName}' not found in AOI '${aoi.name}'`,
          diagnostics: [
            {
              type: 'service',
              severity: 'error',
              message: `Routine '${routineName}' not found in AOI '${aoi.name}'`,
            },
          ],
        },
      };
    }

    if (!routine.content || routine.content.trim() === '') {
      return {
        compilationResult: {
          success: false,
          error: `Routine '${routineName}' has no content`,
          diagnostics: [
            {
              type: 'service',
              severity: 'error',
              message: `Routine '${routineName}' has no content`,
            },
          ],
        },
      };
    }

    const compilationResult = compileRoutine({ aoi, routine, routineName });

    if (!compilationResult.success) {
      return { compilationResult };
    }

    try {
      const baseParameters = extractExecutionParameters(aoi.tags ?? []);
      const executionParameters: ExecutionParameters = { ...baseParameters };

      Object.entries(parameters).forEach(([key, value]) => {
        executionParameters[key] = cloneCompilationValue(value);
      });

      if ('EnableIn' in parameters && !('EnableOut' in parameters)) {
        executionParameters['EnableOut'] = normalizeBool(parameters['EnableIn']);
      }

      const executionContext = this.execute(compilationResult, executionParameters, options);

      return {
        compilationResult,
        executionContext,
      };
    } catch (error) {
      return {
        compilationResult: {
          success: false,
          error: error instanceof Error ? error.message : 'Execution failed',
          diagnostics: [
            {
              type: 'service',
              severity: 'error',
              message: error instanceof Error ? error.message : 'Execution failed',
            },
          ],
        },
      };
    }
  }

  static invalidateCacheForAOI(aoiName: string): void {
    invalidateCompilerCacheForAOI(aoiName);
  }

  static clearCache(): void {
    clearCompilerCache();
  }

  static formatResults(executionContext: ExecutionContext): {
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    locals: Record<string, unknown>;
    logs: RuntimeLog[];
  } {
    const variables = Object.fromEntries(executionContext.variables);

    return {
      inputs: variables,
      outputs: variables,
      locals: variables,
      logs: executionContext.logs,
    };
  }

}

export interface SerializedExecutionContext {
  variables: [string, unknown][];
  logs: RuntimeLog[];
  scanTime?: number;
}

export interface ExecuteRoutineResponse {
  compilationResult: CompilationResult;
  executionContext?: SerializedExecutionContext;
}
