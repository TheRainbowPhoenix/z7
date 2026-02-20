import { createInitialLibraryState } from '../initial-state';
import type { LibrarySlice, StoreSlice } from '../types';

export const createLibrarySlice: StoreSlice<LibrarySlice> = (set) => ({
  library: createInitialLibraryState(),

  loadInstructionExamples: (examples) =>
    set((state) => {
      state.library.instructionExamples = examples;
    }),

  loadExampleAois: (examples) =>
    set((state) => {
      state.library.exampleAois = examples;
    }),

  resetLibrary: () =>
    set((state) => {
      state.library = createInitialLibraryState();
    }),
});
