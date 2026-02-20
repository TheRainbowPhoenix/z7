import { compileLadderLogic, compileStructuredText, type CompilationContext, type CompilationResult } from '@repo/plc-compiler';
import type { AOIDefinition, RoutineDefinition } from '@repo/plc-core';
import { buildCompilationContext } from './st-compilation-context';

type CompileRoutineRequest = {
  id: string;
  kind: 'compile-routine';
  aoi: AOIDefinition;
  routine: RoutineDefinition;
};

type CompileSourceRequest = {
  id: string;
  kind: 'compile-source';
  source: string;
  context?: CompilationContext;
  language?: 'st' | 'ld';
};

type WorkerRequest = CompileRoutineRequest | CompileSourceRequest;

type WorkerResponse = {
  id: string;
  ok: true;
  result: CompilationResult;
} | {
  id: string;
  ok: false;
  message: string;
};

function compileRoutine(aoi: AOIDefinition, routine: RoutineDefinition): CompilationResult {
  const context = buildCompilationContext(aoi);
  if (routine.type === 'ld') {
    return compileLadderLogic(routine.content, context);
  }
  return compileStructuredText(routine.content, context);
}

function compileSource(
  source: string,
  context: CompilationContext | undefined,
  language: 'st' | 'ld',
): CompilationResult {
  if (language === 'ld') {
    return compileLadderLogic(source, context);
  }
  return compileStructuredText(source, context);
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    const result =
      request.kind === 'compile-routine'
        ? compileRoutine(request.aoi, request.routine)
        : compileSource(request.source, request.context, request.language ?? 'st');

    const response: WorkerResponse = {
      id: request.id,
      ok: true,
      result,
    };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id: request.id,
      ok: false,
      message: error instanceof Error ? error.message : 'Compiler worker failed',
    };
    self.postMessage(response);
  }
});
