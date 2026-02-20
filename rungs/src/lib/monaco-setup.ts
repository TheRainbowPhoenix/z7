import { loader } from '@monaco-editor/react';

let monacoPromise: Promise<typeof import('monaco-editor')> | null = null;

function lazyInit() {
  if (!monacoPromise) {
    monacoPromise = (async () => {
      self.MonacoEnvironment = {
        getWorker: async (_workerId: string, label: string) => {
          if (label === 'javascript' || label === 'typescript') {
            const { default: TsWorker } = await import('monaco-editor/esm/vs/language/typescript/ts.worker?worker');
            return new TsWorker();
          }
          const { default: EditorWorker } = await import('monaco-editor/esm/vs/editor/editor.worker?worker');
          return new EditorWorker();
        },
      };
      return await import('monaco-editor');
    })();
  }

  let isCanceled = false;
  return {
    then(onFulfilled?: (m: typeof import('monaco-editor')) => unknown, onRejected?: (e: unknown) => unknown) {
      return monacoPromise!.then(
        (value) => {
          if (isCanceled) return undefined;
          if (!onFulfilled) return value;
          return onFulfilled(value);
        },
        (error) => {
          if (isCanceled) return undefined;
          if (onRejected) return onRejected(error);
          throw error;
        },
      );
    },
    cancel() {
      isCanceled = true;
    },
  };
}

loader.init = lazyInit as unknown as typeof loader.init;
