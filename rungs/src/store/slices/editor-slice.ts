import { RoutineType } from '@/lib/enums';
import { createInitialEditorState } from '../initial-state';
import type { EditorSlice, StoreSlice } from '../types';

export const createEditorSlice: StoreSlice<EditorSlice> = (set) => ({
  editors: createInitialEditorState(),

  openTab: (tab) =>
    set((state) => {
      if (!state.editors.tabs.some((t) => t.fileId === tab.fileId)) {
        state.editors.tabs.push(tab);
      }
      const tabIndex = state.editors.tabs.findIndex((t) => t.fileId === tab.fileId);
      state.editors.activeTabIndex = tabIndex;
    }),

  selectTab: (index) =>
    set((state) => {
      state.editors.activeTabIndex = index;
    }),

  openAoiRoutine: ({ aoiName, routineName }) =>
    set((state) => {
      const fileId = `aoi-${aoiName}-routine-${routineName}`;
      const existingTabIndex = state.editors.tabs.findIndex((tab) => tab.fileId === fileId);

      if (existingTabIndex === -1) {
        const routine = state.aoi?.routines[routineName];
        const routineType = routine?.type === 'ld' ? RoutineType.LD : RoutineType.ST;
        state.editors.tabs.push({
          fileId,
          fileType: routineType,
          aoiName,
          routineName,
        });
        state.editors.activeTabIndex = state.editors.tabs.length - 1;
      } else {
        state.editors.activeTabIndex = existingTabIndex;
      }
    }),

  openAoiTrend: ({ aoiName }) =>
    set((state) => {
      const fileId = `aoi-${aoiName}-trend`;
      const existingTabIndex = state.editors.tabs.findIndex((tab) => tab.fileId === fileId);

      if (existingTabIndex === -1) {
        state.editors.tabs.push({
          fileId,
          fileType: 'trend',
          aoiName,
        });
        state.editors.activeTabIndex = state.editors.tabs.length - 1;
      } else {
        state.editors.activeTabIndex = existingTabIndex;
      }
    }),

  openAoiTabs: ({ aoiName, routines, isNewAOI }) =>
    set((state) => {
      const currentTab = state.editors.tabs[state.editors.activeTabIndex];
      const currentTabType = currentTab?.fileType;
      const currentRoutineName =
        currentTab && 'routineName' in currentTab ? currentTab.routineName : undefined;

      state.editors.tabs = [];

      state.editors.tabs.push({
        fileId: `aoi-${aoiName}-parameters`,
        fileType: 'tags',
        aoiName,
      });

      routines.forEach((routineName) => {
        const fileId = `aoi-${aoiName}-routine-${routineName}`;
        const routine = state.aoi?.routines[routineName];
        const routineType = routine?.type === 'ld' ? RoutineType.LD : RoutineType.ST;
        state.editors.tabs.push({
          fileId,
          fileType: routineType,
          aoiName,
          routineName,
        });
      });

      state.editors.tabs.push({
        fileId: `aoi-${aoiName}-test`,
        fileType: 'test',
        aoiName,
      });

      state.editors.tabs.push({
        fileId: `aoi-${aoiName}-trend`,
        fileType: 'trend',
        aoiName,
      });

      let newTabIndex = 0;
      if (isNewAOI) {
        newTabIndex = 0;
      } else if (currentTabType) {
        const matchingTabIndex = state.editors.tabs.findIndex((tab) => {
          if (tab.fileType !== currentTabType) return false;
          if (currentRoutineName && 'routineName' in tab) {
            return tab.routineName === currentRoutineName;
          }
          return true;
        });

        if (matchingTabIndex !== -1) {
          newTabIndex = matchingTabIndex;
        } else if (currentRoutineName) {
          const logicTabIndex = state.editors.tabs.findIndex(
            (tab) => 'routineName' in tab && tab.routineName === 'Logic',
          );
          if (logicTabIndex !== -1) {
            newTabIndex = logicTabIndex;
          }
        }
      }

      state.editors.activeTabIndex = newTabIndex;
    }),

  closeAoi: () =>
    set((state) => {
      state.editors.tabs = [];
      state.editors.activeTabIndex = 0;
    }),

  toggleStatusPanel: () =>
    set((state) => {
      state.editors.statusPanel.isOpen = !state.editors.statusPanel.isOpen;
      if (state.editors.statusPanel.isOpen) {
        state.editors.statusPanel.unreadErrorCount = 0;
      }
    }),

  openStatusPanel: () =>
    set((state) => {
      state.editors.statusPanel.isOpen = true;
      state.editors.statusPanel.unreadErrorCount = 0;
    }),

  closeStatusPanel: () =>
    set((state) => {
      state.editors.statusPanel.isOpen = false;
    }),

  openStatusPanelWithTab: (tab) =>
    set((state) => {
      state.editors.statusPanel.isOpen = true;
      state.editors.statusPanel.activeTab = tab;
      state.editors.statusPanel.unreadErrorCount = 0;
    }),

  changeStatusPanelTab: (tab) =>
    set((state) => {
      state.editors.statusPanel.activeTab = tab;
    }),

  changeStatusPanelHeight: (height) =>
    set((state) => {
      state.editors.statusPanel.height = height;
    }),

  incrementErrorCount: () =>
    set((state) => {
      if (!state.editors.statusPanel.isOpen) {
        state.editors.statusPanel.unreadErrorCount += 1;
      }
    }),

  toggleCollapsibleSection: ({ sectionId, isOpen }) =>
    set((state) => {
      if (isOpen !== undefined) {
        state.editors.ui.collapsibleSections[sectionId] = isOpen;
      } else {
        state.editors.ui.collapsibleSections[sectionId] =
          !state.editors.ui.collapsibleSections[sectionId];
      }
    }),
});
