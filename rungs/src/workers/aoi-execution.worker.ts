/// <reference lib="webworker" />

import type { CompilationContext, CompilationResult } from '@repo/plc-compiler';
import type { AOIDefinition } from '@repo/plc-core';
import {
  ExecutionServiceCore,
  type ExecutionParameters,
  type ExecutionOptions,
  type ExecuteRoutineResponse,
  type SerializedExecutionContext,
} from '../lib/execution-service-core';

interface CompileRequestPayload {
  sourceCode?: string;
  context?: CompilationContext;
}

interface ExecuteRequestPayload {
  compilationResult: CompilationResult;
  parameters?: ExecutionParameters;
  options?: ExecutionOptions;
}

interface ExecuteRoutineRequestPayload {
  aoi: AOIDefinition;
  routineName: string;
  parameters?: ExecutionParameters;
  options?: ExecutionOptions;
}

interface CacheInvalidatePayload {
  aoiName: string;
}

type WorkerCommand =
  | { id: string; type: 'compile'; payload: CompileRequestPayload }
  | { id: string; type: 'execute'; payload: ExecuteRequestPayload }
  | { id: string; type: 'executeRoutine'; payload: ExecuteRoutineRequestPayload }
  | { id: string; type: 'clearCache' }
  | { id: string; type: 'invalidateCache'; payload: CacheInvalidatePayload };

interface WorkerResponse<T = unknown> {
  id: string;
  success: true;
  result: T;
}

interface WorkerErrorResponse {
  id: string;
  success: false;
  error: string;
}

type WorkerMessageResponse<T = unknown> = WorkerResponse<T> | WorkerErrorResponse;

self.onmessage = (event: MessageEvent<WorkerCommand>) => {
  const message = event.data;

  const respond = <T>(response: WorkerMessageResponse<T>) => {
    self.postMessage(response);
  };

  try {
    switch (message.type) {
      case 'compile': {
        const { sourceCode, context } = message.payload;
        const result = ExecutionServiceCore.compile(sourceCode, context);
        respond({ id: message.id, success: true, result });
        break;
      }
      case 'execute': {
        const { compilationResult, parameters, options } = message.payload;
        const context = ExecutionServiceCore.execute(compilationResult, parameters, options);
        respond({
          id: message.id,
          success: true,
          result: {
            variables: Array.from(context.variables.entries()),
            logs: [...context.logs],
            scanTime: context.scanTime,
          } satisfies SerializedExecutionContext,
        });
        break;
      }
      case 'executeRoutine': {
        const { aoi, routineName, parameters, options } = message.payload;
        const response = ExecutionServiceCore.executeRoutine(aoi, routineName, parameters, options);

        if (response.executionContext) {
          const serialized: ExecuteRoutineResponse = {
            compilationResult: response.compilationResult,
            executionContext: {
              variables: Array.from(response.executionContext.variables.entries()),
              logs: [...response.executionContext.logs],
              scanTime: response.executionContext.scanTime,
            },
          };
          respond({ id: message.id, success: true, result: serialized });
        } else {
          respond({
            id: message.id,
            success: true,
            result: {
              compilationResult: response.compilationResult,
            } satisfies ExecuteRoutineResponse,
          });
        }
        break;
      }
      case 'clearCache': {
        ExecutionServiceCore.clearCache();
        respond({ id: message.id, success: true, result: null });
        break;
      }
      case 'invalidateCache': {
        ExecutionServiceCore.invalidateCacheForAOI(message.payload.aoiName);
        respond({ id: message.id, success: true, result: null });
        break;
      }
      default: {
        const neverType: never = message;
        throw new Error(`Unknown worker command: ${JSON.stringify(neverType)}`);
      }
    }
  } catch (error) {
    respond({
      id: message.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown worker execution error',
    });
  }
};

export default null;
