import { posthog } from './posthog-init';
import type { AOIDefinition, RoutineType, TagDefinition, TagUsage } from '@repo/plc-core';
import type { ExportFormat } from './aoi-file-export';
import packageJson from '../../package.json';

type StandardEventProperties = {
  aoi_id?: string;
  session_id?: string;
  app_version: string;
};

type DefaultExampleBootstrappedProperties = StandardEventProperties & {
  example_aoi_id: string;
};

type SimulationStartFailedReason =
  | 'no_aoi'
  | 'no_logic_routine'
  | 'empty_logic'
  | 'compile_failed_with_diagnostics'
  | 'compile_internal_error';

type SimulationStartFailedProperties = StandardEventProperties & {
  reason: SimulationStartFailedReason;
  diagnostic_count?: number;
};

type SimulationStartedProperties = StandardEventProperties & {
  run_id: string;
};

type SimulationCompletedProperties = StandardEventProperties & {
  run_id: string;
  duration_ms: number;
  duration_cycles: number;
  input_change_count: number;
  unique_inputs_changed: number;
  language: RoutineType;
};

type TestRunStartedProperties = StandardEventProperties & {
  run_id: string;
};

type TestRunCompletedProperties = StandardEventProperties & {
  run_id: string;
  status: 'passed' | 'failed' | 'partial';
  total_count: number;
  passed_count: number;
  failed_count: number;
  duration_ms: number;
};

type AoiExportedProperties = StandardEventProperties & {
  format: ExportFormat;
};

type TagCreatedProperties = StandardEventProperties & {
  data_type: string;
  usage: TagUsage;
};

type AoiCreatedProperties = StandardEventProperties & {
  language: RoutineType;
};

type RoutineEditingSessionCompletedProperties = StandardEventProperties & {
  routine_name: 'Logic' | 'Prescan' | 'EnableInFalse';
  language: RoutineType;
  duration_ms: number;
  edit_count: number;
};

type ShareCreatedProperties = StandardEventProperties & {
  share_token: string;
};

type SharedAoiLoadedProperties = StandardEventProperties & {
  share_token: string;
};

type ExampleAoiOpenedProperties = StandardEventProperties & {
  category: 'example_aoi' | 'instruction_example';
};

function getAppVersion(): string {
  return packageJson.version;
}

function getStandardProperties(aoi?: AOIDefinition | null): StandardEventProperties {
  return {
    aoi_id: aoi?.name,
    session_id: posthog?.get_session_id?.(),
    app_version: getAppVersion(),
  };
}

type RoutineKey = 'Logic' | 'Prescan' | 'EnableInFalse';

type AccumulatedEditSession = {
  startTime: number;
  editCount: number;
  language: RoutineType;
  aoi: AOIDefinition | null;
};

const editingSessions = new Map<RoutineKey, AccumulatedEditSession>();

function flushEditingSessions(): void {
  for (const [routineName, session] of editingSessions) {
    const properties: RoutineEditingSessionCompletedProperties = {
      ...getStandardProperties(session.aoi),
      routine_name: routineName,
      language: session.language,
      duration_ms: Date.now() - session.startTime,
      edit_count: session.editCount,
    };
    posthog?.capture('routine_editing_session_completed', properties);
  }
  editingSessions.clear();
}

document.addEventListener('pagehide', flushEditingSessions);
document.addEventListener('beforeunload', flushEditingSessions);

export const analytics = {
  trackDefaultExampleBootstrapped(exampleAoiId: string): void {
    const properties: DefaultExampleBootstrappedProperties = {
      ...getStandardProperties(null),
      example_aoi_id: exampleAoiId,
    };
    posthog?.capture('default_example_bootstrapped', properties);
  },

  trackSimulationStartFailed(params: {
    aoi: AOIDefinition | null;
    reason: SimulationStartFailedReason;
    diagnosticCount?: number;
  }): void {
    const properties: SimulationStartFailedProperties = {
      ...getStandardProperties(params.aoi),
      reason: params.reason,
      diagnostic_count: params.diagnosticCount,
    };
    posthog?.capture('simulation_start_failed', properties);
  },

  trackAoiCreated(aoi: AOIDefinition): void {
    const properties: AoiCreatedProperties = {
      ...getStandardProperties(aoi),
      language: aoi.routines.Logic.type,
    };
    posthog?.capture('aoi_created', properties);
  },

  trackAoiImported(aoi: AOIDefinition): void {
    posthog?.capture('aoi_imported', getStandardProperties(aoi));
  },

  trackAoiExported(aoi: AOIDefinition, format: ExportFormat): void {
    const properties: AoiExportedProperties = {
      ...getStandardProperties(aoi),
      format,
    };
    posthog?.capture('aoi_exported', properties);
  },

  trackSimulationStarted(aoi: AOIDefinition | null, runId: string): void {
    const properties: SimulationStartedProperties = {
      ...getStandardProperties(aoi),
      run_id: runId,
    };
    posthog?.capture('simulation_started', properties);
  },

  trackSimulationCompleted(params: {
    aoi: AOIDefinition | null;
    runId: string;
    durationMs: number;
    durationCycles: number;
    inputChangeCount: number;
    uniqueInputsChanged: number;
    language: RoutineType;
  }): void {
    const properties: SimulationCompletedProperties = {
      ...getStandardProperties(params.aoi),
      run_id: params.runId,
      duration_ms: params.durationMs,
      duration_cycles: params.durationCycles,
      input_change_count: params.inputChangeCount,
      unique_inputs_changed: params.uniqueInputsChanged,
      language: params.language,
    };
    posthog?.capture('simulation_completed', properties);
  },

  trackTestRunStarted(aoi: AOIDefinition | null, runId: string): void {
    const properties: TestRunStartedProperties = {
      ...getStandardProperties(aoi),
      run_id: runId,
    };
    posthog?.capture('test_run_started', properties);
  },

  trackTestRunCompleted(
    aoi: AOIDefinition | null,
    runId: string,
    status: 'passed' | 'failed' | 'partial',
    totalCount: number,
    passedCount: number,
    failedCount: number,
    durationMs: number,
  ): void {
    const properties: TestRunCompletedProperties = {
      ...getStandardProperties(aoi),
      run_id: runId,
      status,
      total_count: totalCount,
      passed_count: passedCount,
      failed_count: failedCount,
      duration_ms: durationMs,
    };
    posthog?.capture('test_run_completed', properties);
  },

  trackTagCreated(aoi: AOIDefinition | null, tag: TagDefinition): void {
    const properties: TagCreatedProperties = {
      ...getStandardProperties(aoi),
      data_type: tag.dataType,
      usage: tag.usage,
    };
    posthog?.capture('tag_created', properties);
  },

  recordRoutineEdit(aoi: AOIDefinition | null, routineName: RoutineKey, language: RoutineType): void {
    const existing = editingSessions.get(routineName);
    if (existing) {
      existing.editCount++;
      existing.aoi = aoi;
    } else {
      editingSessions.set(routineName, { startTime: Date.now(), editCount: 1, language, aoi });
    }
  },

  trackShareCreated(aoi: AOIDefinition | null, shareToken: string): void {
    const properties: ShareCreatedProperties = {
      ...getStandardProperties(aoi),
      share_token: shareToken,
    };
    posthog?.capture('share_created', properties);
  },

  trackSharedAoiLoaded(shareToken: string, aoi?: AOIDefinition): void {
    const properties: SharedAoiLoadedProperties = {
      ...getStandardProperties(aoi),
      share_token: shareToken,
    };
    posthog?.capture('shared_aoi_loaded', properties);
  },

  trackExampleAoiOpened(aoi: AOIDefinition, category: 'example_aoi' | 'instruction_example'): void {
    const properties: ExampleAoiOpenedProperties = {
      ...getStandardProperties(aoi),
      category,
    };
    posthog?.capture('example_aoi_opened', properties);
  },
};
