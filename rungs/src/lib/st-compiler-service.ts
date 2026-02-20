import { compileStructuredText, compileLadderLogic } from '@repo/plc-compiler';
import type { CompilationContext, CompilationResult } from '@repo/plc-compiler';
import type { AOIDefinition, RoutineDefinition } from '@repo/plc-core';
import { buildCompilationContext } from './st-compilation-context';
import {
  compileRoutineInWorker,
  compileSourceInWorker,
  createCompilerWorkerErrorResult,
} from './compiler-worker-client';

type RoutineKey = string;

interface CachedRoutine {
  signature: string;
  result: CompilationResult;
}

const routineCache = new Map<RoutineKey, CachedRoutine>();

function getRoutineKey(aoiName: string, routineName: string): RoutineKey {
  return `${aoiName}:${routineName}`;
}

function getSignature(content: string, context: CompilationContext): string {
  const tagsSignature = context.tags ? JSON.stringify(context.tags) : '';
  return `${content}::${tagsSignature}`;
}

export interface CompileRoutineOptions {
  aoi: AOIDefinition;
  routine: RoutineDefinition;
  routineName: string;
}

export interface CompileRoutineSafeOptions extends CompileRoutineOptions {
  timeoutMs?: number;
}

export function compileRoutine({ aoi, routine, routineName }: CompileRoutineOptions): CompilationResult {
  const context = buildCompilationContext(aoi);
  const cacheKey = getRoutineKey(aoi.name, routineName);
  const signature = getSignature(routine.content, context);

  const cached = routineCache.get(cacheKey);
  if (cached && cached.signature === signature) {
    return cached.result;
  }

  const result =
    routine.type === 'ld'
      ? compileLadderLogic(routine.content, context)
      : compileStructuredText(routine.content, context);
  routineCache.set(cacheKey, { signature, result });
  return result;
}

export async function compileRoutineSafe({
  aoi,
  routine,
  routineName,
  timeoutMs = 1200,
}: CompileRoutineSafeOptions): Promise<CompilationResult> {
  const context = buildCompilationContext(aoi);
  const cacheKey = getRoutineKey(aoi.name, routineName);
  const signature = getSignature(routine.content, context);

  const cached = routineCache.get(cacheKey);
  if (cached && cached.signature === signature) {
    return cached.result;
  }

  try {
    const result = await compileRoutineInWorker(aoi, routine, timeoutMs);
    routineCache.set(cacheKey, { signature, result });
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === 'Compiler worker unavailable') {
      return compileRoutine({ aoi, routine, routineName });
    }
    return createCompilerWorkerErrorResult(error);
  }
}

export interface CompileSourceOptions {
  aoi?: AOIDefinition;
  source: string;
  contextOverride?: CompilationContext;
}

export function compileSource({ aoi, source, contextOverride }: CompileSourceOptions): CompilationResult {
  const context = contextOverride ?? buildCompilationContext(aoi);
  return compileStructuredText(source, context);
}

export interface CompileSourceSafeOptions extends CompileSourceOptions {
  timeoutMs?: number;
  language?: 'st' | 'ld';
}

export async function compileSourceSafe({
  aoi,
  source,
  contextOverride,
  timeoutMs = 1200,
  language = 'st',
}: CompileSourceSafeOptions): Promise<CompilationResult> {
  const context = contextOverride ?? buildCompilationContext(aoi);

  try {
    return await compileSourceInWorker(source, context, language, timeoutMs);
  } catch (error) {
    if (error instanceof Error && error.message === 'Compiler worker unavailable') {
      if (language === 'ld') {
        return compileLadderLogic(source, context);
      }
      return compileStructuredText(source, context);
    }
    return createCompilerWorkerErrorResult(error);
  }
}

export function clearCompilerCache(): void {
  routineCache.clear();
}

export function invalidateCompilerCacheForAOI(aoiName: string): void {
  const prefix = `${aoiName}:`;
  for (const key of Array.from(routineCache.keys())) {
    if (key.startsWith(prefix)) {
      routineCache.delete(key);
    }
  }
}
