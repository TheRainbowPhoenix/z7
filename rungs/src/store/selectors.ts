import type { StudioStore } from './types';

export const selectAoiState = (state: StudioStore) => ({
  aoi: state.aoi,
  isAoiModified: state.isAoiModified,
});
export const selectAoi = (state: StudioStore) => state.aoi;
export const selectAoiIsModified = (state: StudioStore) => state.isAoiModified;

export const selectEditors = (state: StudioStore) => state.editors;
export const selectEditorTabs = (state: StudioStore) => state.editors.tabs;
export const selectActiveTabIndex = (state: StudioStore) => state.editors.activeTabIndex;
export const selectActiveTab = (state: StudioStore) =>
  state.editors.tabs[state.editors.activeTabIndex];
export const selectStatusPanel = (state: StudioStore) => state.editors.statusPanel;
export const selectStatusPanelActiveTab = (state: StudioStore) =>
  state.editors.statusPanel.activeTab;
export const selectCollapsibleSections = (state: StudioStore) =>
  state.editors.ui.collapsibleSections;

export const selectTest = (state: StudioStore) => state.test;
export const selectTestResult = (state: StudioStore) => state.test.result;
export const selectIsTestRunning = (state: StudioStore) => state.test.isRunning;

export const selectLogs = (state: StudioStore) => state.logs;
export const selectErrorLogs = (state: StudioStore) =>
  state.logs.filter((log) => log.type === 'error');
export const selectWarningLogs = (state: StudioStore) =>
  state.logs.filter((log) => log.type === 'warning');
export const selectInfoLogs = (state: StudioStore) => state.logs.filter((log) => log.type === 'info');

export const selectLibrary = (state: StudioStore) => state.library;
export const selectInstructionExamples = (state: StudioStore) =>
  state.library.instructionExamples;
export const selectExampleAois = (state: StudioStore) => state.library.exampleAois;

export type LogicalModelData = {
  id: string;
  fileType: 'folder';
  fileName: 'Add-On Instructions';
};

export const selectLogicalOrganizer = (): LogicalModelData => ({
  id: 'logical-model',
  fileType: 'folder',
  fileName: 'Add-On Instructions',
});

export const selectEditorState = (state: StudioStore) => ({
  tabs: state.editors.tabs,
  activeTabIndex: state.editors.activeTabIndex,
  statusPanel: state.editors.statusPanel,
});
