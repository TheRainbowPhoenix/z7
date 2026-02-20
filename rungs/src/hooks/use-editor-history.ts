import { useSyncExternalStore } from 'react';

type EditorHistoryHandle = {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const DEFAULT_HANDLE: EditorHistoryHandle = {
  undo: () => {},
  redo: () => {},
  canUndo: false,
  canRedo: false,
};

let current: EditorHistoryHandle = DEFAULT_HANDLE;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function setEditorHistory(handle: EditorHistoryHandle) {
  current = handle;
  notify();
}

export function clearEditorHistory() {
  current = DEFAULT_HANDLE;
  notify();
}

export function useEditorHistory(): EditorHistoryHandle {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => DEFAULT_HANDLE,
  );
}
