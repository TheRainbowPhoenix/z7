import type { CompilationContext, CompilationResult } from '@repo/plc-compiler';
import type { AOIDefinition, RoutineDefinition } from '@repo/plc-core';

type CompileRoutineWorkerRequest = {
  id: string;
  kind: 'compile-routine';
  aoi: AOIDefinition;
  routine: RoutineDefinition;
};

type CompileSourceWorkerRequest = {
  id: string;
  kind: 'compile-source';
  source: string;
  context?: CompilationContext;
  language?: 'st' | 'ld';
};

type WorkerRequestPayload = Omit<CompileRoutineWorkerRequest, 'id'> | Omit<CompileSourceWorkerRequest, 'id'>;

type WorkerSuccessResponse = {
  id: string;
  ok: true;
  result: CompilationResult;
};

type WorkerErrorResponse = {
  id: string;
  ok: false;
  message: string;
};

type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

type PendingRequest = {
  resolve: (result: CompilationResult) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

let compilerWorker: Worker | null = null;
const pendingRequests = new Map<string, PendingRequest>();

function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function rejectAllPending(errorMessage: string): void {
  for (const [id, pending] of pendingRequests.entries()) {
    clearTimeout(pending.timeoutId);
    pending.reject(new Error(errorMessage));
    pendingRequests.delete(id);
  }
}

function resetWorker(errorMessage?: string): void {
  if (compilerWorker) {
    compilerWorker.terminate();
    compilerWorker = null;
  }
  if (errorMessage) {
    rejectAllPending(errorMessage);
  }
}

function getWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }

  if (!compilerWorker) {
    compilerWorker = new Worker(new URL('./compiler-worker.ts', import.meta.url), {
      type: 'module',
    });

    compilerWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pending = pendingRequests.get(response.id);
      if (!pending) return;

      pendingRequests.delete(response.id);
      clearTimeout(pending.timeoutId);

      if (response.ok) {
        pending.resolve(response.result);
      } else {
        pending.reject(new Error(response.message));
      }
    };

    compilerWorker.onerror = () => {
      resetWorker('Compiler worker crashed');
    };
  }

  return compilerWorker;
}

function requestWorker(
  requestWithoutId: WorkerRequestPayload,
  timeoutMs: number,
): Promise<CompilationResult> {
  const worker = getWorker();
  if (!worker) {
    return Promise.reject(new Error('Compiler worker unavailable'));
  }

  const id = createRequestId();

  return new Promise<CompilationResult>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      resetWorker(`Compiler worker timed out after ${timeoutMs}ms`);
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timeoutId });
    worker.postMessage({ ...requestWithoutId, id });
  });
}

export async function compileRoutineInWorker(
  aoi: AOIDefinition,
  routine: RoutineDefinition,
  timeoutMs: number,
): Promise<CompilationResult> {
  return requestWorker(
    {
      kind: 'compile-routine',
      aoi,
      routine,
    },
    timeoutMs,
  );
}

export async function compileSourceInWorker(
  source: string,
  context: CompilationContext | undefined,
  language: 'st' | 'ld',
  timeoutMs: number,
): Promise<CompilationResult> {
  return requestWorker(
    {
      kind: 'compile-source',
      source,
      context,
      language,
    },
    timeoutMs,
  );
}

export function createCompilerWorkerErrorResult(error: unknown): CompilationResult {
  const message = error instanceof Error ? error.message : 'Compiler worker failed';
  return {
    success: false,
    error: message,
    diagnostics: [
      {
        type: 'service',
        severity: 'error',
        message,
      },
    ],
  };
}
