import { createInitialTestState } from '../initial-state';
import type { StoreSlice, TestSlice } from '../types';

export const createTestSlice: StoreSlice<TestSlice> = (set) => ({
  test: createInitialTestState(),

  startTest: () =>
    set((state) => {
      state.test.isRunning = true;
    }),

  completeTest: (result) =>
    set((state) => {
      state.test.result = result;
      state.test.isRunning = false;
    }),

  failTest: () =>
    set((state) => {
      state.test.isRunning = false;
    }),

  clearTestResult: () =>
    set((state) => {
      state.test.result = null;
    }),

  resetTest: () =>
    set((state) => {
      state.test = createInitialTestState();
    }),
});
