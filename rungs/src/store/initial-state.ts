import type {
  AoiState,
  EditorState,
  LibraryState,
  OnboardingState,
  StatusPanelState,
  StudioState,
  TestState,
} from './types';

export function getInitialStatusPanelHeight(): number {
  if (typeof window !== 'undefined') {
    return Math.floor(window.innerHeight * 0.3);
  }
  return 320;
}

export function createDefaultStatusPanel(): StatusPanelState {
  return {
    isOpen: false,
    height: getInitialStatusPanelHeight(),
    unreadErrorCount: 0,
    activeTab: 'errors',
  };
}

export function createInitialAoiState(): AoiState {
  return {
    aoi: null,
    isAoiModified: false,
    aoiLoadId: 0,
  };
}

export function createInitialTestState(): TestState {
  return {
    result: null,
    isRunning: false,
  };
}

export function createInitialLibraryState(): LibraryState {
  return {
    instructionExamples: [],
    exampleAois: [],
  };
}

export function createInitialOnboardingState(): OnboardingState {
  return {
    hasSeenStartButtonHighlight: false,
    hasOpenedTrendOnFirstStart: false,
  };
}

export function createInitialEditorState(): EditorState {
  return {
    tabs: [],
    activeTabIndex: 0,
    statusPanel: createDefaultStatusPanel(),
    ui: {
      collapsibleSections: {},
    },
  };
}

export function createInitialState(): StudioState {
  const aoiState = createInitialAoiState();
  return {
    aoi: aoiState.aoi,
    isAoiModified: aoiState.isAoiModified,
    aoiLoadId: aoiState.aoiLoadId,
    editors: createInitialEditorState(),
    test: createInitialTestState(),
    logs: [],
    library: createInitialLibraryState(),
    onboarding: createInitialOnboardingState(),
  };
}
