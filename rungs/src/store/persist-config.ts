import { createJSONStorage, type PersistOptions } from 'zustand/middleware';
import { AOIDefinitionSchema } from '@repo/plc-core';
import { coerceArrayDefaultValue } from '@/lib/materialize-tag';
import { createDefaultStatusPanel } from './initial-state';
import type { AoiState, EditorState, EditorTab, OnboardingState, StudioStore } from './types';
import type { AOIDefinition } from '@repo/plc-core';

export const STORAGE_KEY = 'rungs-project';
export const CURRENT_VERSION = 3;

export interface PersistedState {
  aoi: AoiState['aoi'];
  isAoiModified?: AoiState['isAoiModified'];
  editors: {
    tabs: EditorTab[];
    activeTabIndex: number;
    ui: EditorState['ui'];
  };
  onboarding: OnboardingState;
}

export const persistOptions: PersistOptions<StudioStore, PersistedState> = {
  name: STORAGE_KEY,
  version: CURRENT_VERSION,
  storage: createJSONStorage(() => localStorage),

  partialize: (state): PersistedState => ({
    aoi: state.aoi,
    isAoiModified: state.isAoiModified,
    editors: {
      tabs: state.editors.tabs,
      activeTabIndex: state.editors.activeTabIndex,
      ui: state.editors.ui,
    },
    onboarding: state.onboarding,
  }),

  migrate: (persisted: unknown, version: number) => {
    const state = persisted as PersistedState;
    if (version < 3 && state.editors?.tabs) {
      state.editors.tabs = state.editors.tabs.map(normalizePersistedTab);
    }
    return state;
  },

  merge: (persistedState, currentState) => {
    const persisted = persistedState as Partial<PersistedState> | undefined;
    if (!persisted) return currentState;

    let validatedAoi = currentState.aoi;
    if (persisted.aoi) {
      const normalizedAoi = normalizePersistedAoi(persisted.aoi as AOIDefinition);
      const result = AOIDefinitionSchema.safeParse(normalizedAoi);
      if (result.success) {
        validatedAoi = result.data;
      } else {
        console.error('[Persistence] Invalid AOI data, using default:', result.error.message);
      }
    }

    return {
      ...currentState,
      aoi: validatedAoi,
      isAoiModified: persisted.isAoiModified ?? currentState.isAoiModified,
      editors: {
        ...currentState.editors,
        tabs: Array.isArray(persisted.editors?.tabs)
          ? persisted.editors.tabs
          : currentState.editors.tabs,
        activeTabIndex: persisted.editors?.activeTabIndex ?? currentState.editors.activeTabIndex,
        ui: persisted.editors?.ui ?? currentState.editors.ui,
        statusPanel: createDefaultStatusPanel(),
      },
      onboarding: persisted.onboarding ?? currentState.onboarding,
    };
  },
};

function normalizePersistedAoi(aoi: AOIDefinition): AOIDefinition {
  const normalizedRoutines = { ...aoi.routines };
  for (const key of Object.keys(normalizedRoutines) as (keyof typeof normalizedRoutines)[]) {
    const routine = normalizedRoutines[key];
    if (routine && !routine.type) {
      normalizedRoutines[key] = { ...routine, type: 'st' };
    }
  }

  return {
    ...aoi,
    tags: (aoi.tags ?? []).map(coerceArrayDefaultValue),
    routines: normalizedRoutines,
  };
}

const ROUTINE_TYPE_MIGRATION: Record<string, string> = { ST: 'st', LD: 'ld' };

function normalizePersistedTab(tab: EditorTab): EditorTab {
  const fileType = ROUTINE_TYPE_MIGRATION[tab.fileType] ?? tab.fileType;
  return fileType !== tab.fileType ? { ...tab, fileType } as EditorTab : tab;
}

export function clearPersistedState(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('Cleared persisted AOI data');
}

export function hasPersistedState(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}
