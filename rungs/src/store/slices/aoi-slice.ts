import { RoutineType } from '@/lib/enums';
import { AoiNameSchema } from '@repo/plc-core';
import { createInitialAoiState } from '../initial-state';
import type { AoiSlice, StoreSlice } from '../types';
import { analytics } from '@/lib/posthog-analytics';

export const createAoiSlice: StoreSlice<AoiSlice> = (set) => ({
  ...createInitialAoiState(),

  loadAoi: (aoi) =>
    set((state) => {
      state.aoi = aoi;
      state.isAoiModified = false;
      state.aoiLoadId += 1;
    }),

  renameAoi: (name) =>
    set((state) => {
      if (!state.aoi) return;
      const trimmedName = name.trim();
      if (!trimmedName) return;
      const validation = AoiNameSchema.safeParse(trimmedName);
      if (!validation.success) return;
      const nextName = validation.data;
      const previousName = state.aoi.name;
      if (nextName === previousName) return;

      state.aoi.name = nextName;
      state.isAoiModified = true;

      state.editors.tabs.forEach((tab) => {
        if (!('aoiName' in tab) || tab.aoiName !== previousName) {
          return;
        }

        tab.aoiName = nextName;

        if (tab.fileType === 'tags') {
          tab.fileId = `aoi-${nextName}-parameters`;
        } else if (tab.fileType === RoutineType.ST && 'routineName' in tab) {
          tab.fileId = `aoi-${nextName}-routine-${tab.routineName}`;
        } else if (tab.fileType === 'test') {
          tab.fileId = `aoi-${nextName}-test`;
        } else if (tab.fileType === 'trend') {
          tab.fileId = `aoi-${nextName}-trend`;
        }
      });
    }),

  addTag: (tag) =>
    set((state) => {
      if (!state.aoi) return;
      state.aoi.tags = [...(state.aoi.tags ?? []), tag];
      state.isAoiModified = true;
      analytics.trackTagCreated(state.aoi, tag);
    }),

  updateTag: ({ originalName, originalUsage, tag }) =>
    set((state) => {
      if (!state.aoi) return;
      const tags = state.aoi.tags ?? [];
      const idx = tags.findIndex((t) => t.name === originalName && t.usage === originalUsage);
      if (idx !== -1) {
        state.aoi.tags[idx] = tag;
        state.isAoiModified = true;
      }
    }),

  deleteTag: ({ name, usage }) =>
    set((state) => {
      if (!state.aoi) return;
      state.aoi.tags = (state.aoi.tags ?? []).filter(
        (t) => !(t.name === name && t.usage === usage),
      );
      state.isAoiModified = true;
    }),

  updateRoutine: ({ routineName, routine }) =>
    set((state) => {
      if (!state.aoi) return;
      const name = routineName as keyof typeof state.aoi.routines;
      const previousRoutine = state.aoi.routines[name];
      if (previousRoutine === undefined) return;
      if (
        previousRoutine.type === routine.type &&
        previousRoutine.content === routine.content &&
        previousRoutine.description === routine.description
      ) {
        return;
      }
      state.aoi.routines[name] = routine;
      state.isAoiModified = true;
    }),

  updateTestContent: (content) =>
    set((state) => {
      if (!state.aoi?.testing) return;
      state.aoi.testing.content = content;
      state.isAoiModified = true;
    }),

  markAoiAsSaved: () =>
    set((state) => {
      state.isAoiModified = false;
    }),
});
