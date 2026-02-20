import type { AOIDefinition } from '@repo/plc-core';
import { parseDslWithDiagnostics, parseRungs, type ParseDiagnostic } from '@repo/aoi-io';
import { useStore } from '@/store/store';
import { createTestingForAOI } from './aoi-factory';

function isLikelyDsl(text: string): boolean {
  return /^\s*aoi\s+[A-Za-z_][A-Za-z0-9_]{0,39}\s*\(/.test(text);
}

function ensureAOIHasTesting(aoi: AOIDefinition): AOIDefinition {
  if (!aoi.testing?.content) {
    return {
      ...aoi,
      testing: createTestingForAOI(aoi.name),
    };
  }
  return aoi;
}

let pickerLock: Promise<void> = Promise.resolve();

async function runWithPickerLock<T>(task: () => Promise<T>): Promise<T> {
  await pickerLock;
  let release!: () => void;
  pickerLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  try {
    return await task();
  } finally {
    release();
  }
}

function createAbortError(): DOMException {
  return new DOMException('File selection cancelled', 'AbortError');
}

async function pickFileWithNativePicker(): Promise<File | null | undefined> {
  if (typeof window.showOpenFilePicker !== 'function') {
    return undefined;
  }

  if (!window.isSecureContext) {
    return undefined;
  }

  try {
    const [fileHandle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'Rungs File',
          accept: { 'application/yaml': ['.rungs'] },
        },
        {
          description: 'DSL AOI',
          accept: { 'text/plain': ['.dsl'] },
        },
      ],
    });

    return await fileHandle.getFile();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }

    console.warn('[aoi-file-import] Native file picker failed, using fallback:', error);
    return undefined;
  }
}

async function pickFileWithInput(): Promise<File | null> {
  return new Promise<File | null>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rungs,.dsl';
    input.style.display = 'none';
    input.value = '';

    let settled = false;

    const finalize = (file: File | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };

    const cleanup = () => {
      window.removeEventListener('focus', handleFocus);
      input.removeEventListener('change', handleChange);
      input.remove();
    };

    const handleChange = () => {
      const file = input.files?.[0] ?? null;
      finalize(file);
    };

    const handleFocus = () => {
      setTimeout(() => {
        if (!settled) {
          finalize(null);
        }
      }, 300);
    };

    input.addEventListener('change', handleChange);
    setTimeout(() => {
      window.addEventListener('focus', handleFocus, { once: true });
    }, 100);

    document.body.appendChild(input);

    try {
      input.click();
    } catch (err) {
      cleanup();
      reject(err);
      return;
    }
  });
}

async function pickAOIFile(): Promise<File> {
  const fileFromNative = await pickFileWithNativePicker();
  if (fileFromNative) return fileFromNative;
  if (fileFromNative === null) throw createAbortError();

  const fileFromInput = await pickFileWithInput();
  if (fileFromInput) return fileFromInput;

  throw createAbortError();
}

export async function openAOIFromFile(): Promise<AOIDefinition> {
  return runWithPickerLock(async () => {
    const file = await pickAOIFile();
    const text = await file.text();

    if (isLikelyDsl(text)) {
      const { aoi, diagnostics } = parseDslWithDiagnostics(text);
      diagnostics.forEach((d: ParseDiagnostic) => {
        const logType = d.type;
        useStore.getState().addLog({ type: logType, message: d.message });
      });
      return ensureAOIHasTesting(aoi);
    }

    try {
      const { aoi, diagnostics } = parseRungs(text);
      diagnostics.forEach((d: ParseDiagnostic) => {
        const logType = d.type;
        useStore.getState().addLog({ type: logType, message: d.message });
      });
      if (aoi) {
        return ensureAOIHasTesting(aoi);
      }
    } catch {
      // Fall through to throw unsupported format error
    }

    throw new Error('Unsupported AOI file format');
  });
}
