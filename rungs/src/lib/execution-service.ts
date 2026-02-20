import {
  ExecutionServiceCore,
} from './execution-service-core';
import type {
  CompilationContext,
  CompilationResult,
  ExecutionContext,
  RuntimeLog,
} from '@repo/plc-compiler';
import type { AOIDefinition } from '@repo/plc-core';
import type {
  ExecutionOptions,
  ExecutionParameters,
  ExecuteRoutineResponse,
  SerializedExecutionContext,
} from './execution-service-core';

export type { ExecutionOptions, ExecutionParameters } from './execution-service-core';

type WorkerRequestPayloadMap = {
  compile: {
    sourceCode?: string;
    context?: CompilationContext;
  };
  execute: {
    compilationResult: CompilationResult;
    parameters?: ExecutionParameters;
    options?: ExecutionOptions;
  };
  executeRoutine: {
    aoi: AOIDefinition;
    routineName: string;
    parameters?: ExecutionParameters;
    options?: ExecutionOptions;
  };
  clearCache: undefined;
  invalidateCache: {
    aoiName: string;
  };
};

type WorkerResponseMap = {
  compile: CompilationResult;
  execute: SerializedExecutionContext;
  executeRoutine: ExecuteRoutineResponse;
  clearCache: null;
  invalidateCache: null;
};

type WorkerCommand = keyof WorkerRequestPayloadMap;

interface WorkerSuccessResponse<T> {
  id: string;
  success: true;
  result: T;
}

interface WorkerErrorResponse {
  id: string;
  success: false;
  error: string;
}

type WorkerMessage<T> = WorkerSuccessResponse<T> | WorkerErrorResponse;

const workerSupportsModule = typeof Worker !== 'undefined' && typeof URL !== 'undefined';

const DEFAULT_EXECUTION_TIMEOUT_MS = 1_000;

const resolveExecutionTimeout = (timeoutMs?: number): number | undefined => {
  if (typeof timeoutMs !== 'number') {
    return DEFAULT_EXECUTION_TIMEOUT_MS;
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    return DEFAULT_EXECUTION_TIMEOUT_MS;
  }

  if (timeoutMs === 0) {
    return undefined;
  }

  return timeoutMs;
};

export class ExecutionTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Execution timed out after ${timeoutMs}ms`);
    this.name = 'ExecutionTimeoutError';
  }
}

class ExecutionWorkerProxy {
  private worker: Worker | null = null;
  private requestId = 0;
  private readonly pending = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      timeoutId?: ReturnType<typeof setTimeout>;
    }
  >();

  constructor() {
    if (!workerSupportsModule) {
      return;
    }

    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      const worker = new Worker(
        new URL('../workers/aoi-execution.worker.ts', import.meta.url),
        { type: 'module' },
      );

      worker.onmessage = (event: MessageEvent<WorkerMessage<unknown>>) => {
        const message = event.data;
        const handler = this.pending.get(message.id);
        if (!handler) {
          return;
        }

        this.pending.delete(message.id);

        if (handler.timeoutId !== undefined) {
          clearTimeout(handler.timeoutId);
        }

        if (message.success) {
          handler.resolve(message.result);
        } else {
          handler.reject(new Error(message.error));
        }
      };

      worker.onerror = (event: ErrorEvent) => {
        const error = new Error(event.message || 'Execution worker error');
        this.restartWorker(error);
      };

      worker.onmessageerror = () => {
        const error = new Error('Execution worker message error');
        this.restartWorker(error);
      };

      this.worker = worker;
    } catch (error) {
      console.warn('Failed to initialize execution worker, falling back to in-thread execution.', error);
      this.worker = null;
    }
  }

  private restartWorker(error?: Error) {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.pending.size > 0) {
      this.rejectAll(error ?? new Error('Execution worker restarted'));
    }

    if (workerSupportsModule) {
      this.initializeWorker();
    }
  }

  private rejectAll(error: Error) {
    for (const [, handler] of this.pending) {
      if (handler.timeoutId !== undefined) {
        clearTimeout(handler.timeoutId);
      }
      handler.reject(error);
    }
    this.pending.clear();
  }

  isAvailable(): boolean {
    return this.worker !== null;
  }

  send<K extends WorkerCommand>(
    type: K,
    payload: WorkerRequestPayloadMap[K],
    options?: { timeoutMs?: number },
  ): Promise<WorkerResponseMap[K]> {
    if (!this.worker) {
      return Promise.reject(new Error('Execution worker is not available'));
    }

    const id = `${Date.now()}-${this.requestId++}`;
    const message =
      payload === undefined
        ? ({ id, type } as { id: string; type: K })
        : ({ id, type, payload } as {
            id: string;
            type: K;
            payload: WorkerRequestPayloadMap[K];
          });

    return new Promise<WorkerResponseMap[K]>((resolve, reject) => {
      const pendingEntry = {
        resolve: resolve as (value: unknown) => void,
        reject: reject as (reason: unknown) => void,
        timeoutId: undefined as ReturnType<typeof setTimeout> | undefined,
      };

      const timeoutMs = options?.timeoutMs;
      if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
        pendingEntry.timeoutId = setTimeout(() => {
          if (!this.pending.has(id)) {
            return;
          }

          this.pending.delete(id);
          const timeoutError = new ExecutionTimeoutError(timeoutMs);
          reject(timeoutError);
          this.restartWorker(timeoutError);
        }, timeoutMs);
      }

      this.pending.set(id, pendingEntry);

      try {
        this.worker!.postMessage(message);
      } catch (error) {
        this.pending.delete(id);
        if (pendingEntry.timeoutId !== undefined) {
          clearTimeout(pendingEntry.timeoutId);
        }

        const normalizedError =
          error instanceof Error
            ? error
            : new Error('Failed to post message to execution worker');

        reject(normalizedError);
        this.restartWorker(normalizedError);
      }
    });
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.pending.size > 0) {
      this.rejectAll(new Error('Execution worker disposed'));
    }
  }
}

const workerProxy = new ExecutionWorkerProxy();

const hydrateExecutionContext = (
  serialized?: SerializedExecutionContext,
): ExecutionContext | undefined => {
  if (!serialized) {
    return undefined;
  }

  return {
    variables: new Map(serialized.variables),
    logs: [...serialized.logs],
    scanTime: serialized.scanTime,
  };
};

export class ExecutionService {
  static async compile(
    sourceCode?: string,
    context?: CompilationContext,
  ): Promise<CompilationResult> {
    if (workerProxy.isAvailable()) {
      return workerProxy.send('compile', { sourceCode, context });
    }

    return ExecutionServiceCore.compile(sourceCode, context);
  }

  static async execute(
    compilationResult: CompilationResult,
    parameters: ExecutionParameters = {},
    options: ExecutionOptions = {},
  ): Promise<ExecutionContext> {
    const timeoutMs = resolveExecutionTimeout(options.timeoutMs);
    const executionOptions: ExecutionOptions =
      timeoutMs !== undefined ? { ...options, timeoutMs } : options;

    if (workerProxy.isAvailable()) {
      const sendOptions = timeoutMs !== undefined ? { timeoutMs } : undefined;
      const result = await workerProxy.send('execute', {
        compilationResult,
        parameters,
        options: executionOptions,
      }, sendOptions);
      const context = hydrateExecutionContext(result);
      if (!context) {
        throw new Error('Execution worker returned empty context');
      }

      return context;
    }

    return ExecutionServiceCore.execute(compilationResult, parameters, executionOptions);
  }

  static async executeRoutine(
    aoi: AOIDefinition,
    routineName: string,
    parameters: ExecutionParameters = {},
    options: ExecutionOptions = {},
  ): Promise<{
    compilationResult: CompilationResult;
    executionContext?: ExecutionContext;
  }> {
    const timeoutMs = resolveExecutionTimeout(options.timeoutMs);
    const executionOptions: ExecutionOptions =
      timeoutMs !== undefined ? { ...options, timeoutMs } : options;

    if (workerProxy.isAvailable()) {
      const sendOptions = timeoutMs !== undefined ? { timeoutMs } : undefined;
      const result = await workerProxy.send('executeRoutine', {
        aoi,
        routineName,
        parameters,
        options: executionOptions,
      }, sendOptions);

      return {
        compilationResult: result.compilationResult,
        executionContext: hydrateExecutionContext(result.executionContext),
      };
    }

    return ExecutionServiceCore.executeRoutine(aoi, routineName, parameters, executionOptions);
  }

  static async invalidateCacheForAOI(aoiName: string): Promise<void> {
    if (workerProxy.isAvailable()) {
      await workerProxy.send('invalidateCache', { aoiName });
      return;
    }

    ExecutionServiceCore.invalidateCacheForAOI(aoiName);
  }

  static async clearCache(): Promise<void> {
    if (workerProxy.isAvailable()) {
      await workerProxy.send('clearCache', undefined);
      return;
    }

    ExecutionServiceCore.clearCache();
  }

  static dispose(): void {
    workerProxy.dispose();
  }

  static compileSync(sourceCode?: string, context?: CompilationContext): CompilationResult {
    return ExecutionServiceCore.compile(sourceCode, context);
  }

  static executeSync(
    compilationResult: CompilationResult,
    parameters: ExecutionParameters = {},
    options: ExecutionOptions = {},
  ): ExecutionContext {
    return ExecutionServiceCore.execute(compilationResult, parameters, options);
  }

  static executeRoutineSync(
    aoi: AOIDefinition,
    routineName: string,
    parameters: ExecutionParameters = {},
    options: ExecutionOptions = {},
  ): {
    compilationResult: CompilationResult;
    executionContext?: ExecutionContext;
  } {
    return ExecutionServiceCore.executeRoutine(aoi, routineName, parameters, options);
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
