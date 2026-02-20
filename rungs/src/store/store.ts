import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { persistOptions } from './persist-config';
import { createEditorSlice } from './slices/editor-slice';
import { createLibrarySlice } from './slices/library-slice';
import { createLogSlice } from './slices/log-slice';
import { createOnboardingSlice } from './slices/onboarding-slice';
import { createAoiSlice } from './slices/aoi-slice';
import { createTestSlice } from './slices/test-slice';
import type { StudioStore } from './types';
import { registerStudioBootstrap } from './studio-bootstrap';

export const useStore = create<StudioStore>()(
  devtools(
    persist(
      immer((...args) => ({
        ...createAoiSlice(...args),
        ...createEditorSlice(...args),
        ...createTestSlice(...args),
        ...createLogSlice(...args),
        ...createLibrarySlice(...args),
        ...createOnboardingSlice(...args),
      })),
      persistOptions,
    ),
    { name: 'rungs-studio', enabled: import.meta.env.MODE === 'development' },
  ),
);

registerStudioBootstrap();

export * from './persist-config';
export * from './selectors';
export * from './types';
