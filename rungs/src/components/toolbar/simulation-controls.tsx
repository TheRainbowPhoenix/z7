import type { AOIDefinition, RoutineDefinition } from '@repo/plc-core';
import { type CompilationDiagnostic, type CompilationResult } from '@repo/plc-compiler';
import { PlayArrowOutlined, StopOutlined } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';
import { useStore } from '@/store/store';
import {
  useIsSimulationRunning,
  useSimulationMetrics,
  useSimulationActions,
} from '@/hooks/use-simulation';
import { simulationManager } from '@/lib/simulation-manager';
import { useDualSidebar } from '../ui/dual-sidebar';
import { compileRoutineSafe } from '@/lib/st-compiler-service';
import { analytics } from '@/lib/posthog-analytics';

function formatStudioErrorMessage(diagnostic: CompilationDiagnostic, routineName: string): string {
  if (diagnostic.type === 'service') {
    return `Routine '${routineName}': ${diagnostic.message}`;
  }
  const location = diagnostic.type === 'ld' ? `Rung ${diagnostic.rung}` : `Line ${diagnostic.line}`;
  return `Routine '${routineName}' (${location}): ${diagnostic.message}`;
}

async function validateAOILogic(aoi: AOIDefinition): Promise<{
  hasErrors: boolean;
  compilationResult?: CompilationResult;
  logicRoutine?: RoutineDefinition;
}> {
  const logicRoutine = aoi.routines?.Logic;
  if (!logicRoutine) {
    return { hasErrors: true };
  }

  if (!logicRoutine.content || logicRoutine.content.trim() === '') {
    return { hasErrors: true };
  }

  try {
    const compilationResult = await compileRoutineSafe({
      aoi,
      routine: logicRoutine,
      routineName: 'Logic',
    });

    return {
      hasErrors: !compilationResult.success,
      compilationResult,
      logicRoutine,
    };
  } catch {
    return { hasErrors: true };
  }
}

function SimulationControls() {
  const currentAOI = useStore((state) => state.aoi);
  const clearLogs = useStore((state) => state.clearLogs);
  const addLog = useStore((state) => state.addLog);
  const openStatusPanelWithTab = useStore((state) => state.openStatusPanelWithTab);
  const openAoiTrend = useStore((state) => state.openAoiTrend);
  const hasSeenStartButtonHighlight = useStore(
    (state) => state.onboarding.hasSeenStartButtonHighlight,
  );
  const hasOpenedTrendOnFirstStart = useStore(
    (state) => state.onboarding.hasOpenedTrendOnFirstStart,
  );
  const dismissStartButtonHighlight = useStore((state) => state.dismissStartButtonHighlight);
  const markTrendOpenedOnFirstStart = useStore((state) => state.markTrendOpenedOnFirstStart);
  const activeEditorTab = useStore((state) => state.editors.tabs[state.editors.activeTabIndex]);
  const activeEditorTabFileType = activeEditorTab?.fileType;
  const [shouldShowStartHighlight, setShouldShowStartHighlight] = useState(false);

  const isRunning = useIsSimulationRunning();
  const metrics = useSimulationMetrics();
  const { start, stop } = useSimulationActions();

  const { setRightOpen } = useDualSidebar();
  useEffect(() => {
    if (hasSeenStartButtonHighlight) return;
    const timeoutId = setTimeout(() => {
      setShouldShowStartHighlight(true);
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasSeenStartButtonHighlight]);

  const handleSimulationToggle = async () => {
    if (isRunning) {
      stop();
    } else {
      if (!hasSeenStartButtonHighlight) {
        dismissStartButtonHighlight();
      }
      clearLogs();

      if (!currentAOI) {
        analytics.trackSimulationStartFailed({
          aoi: null,
          reason: 'no_aoi',
        });
        return;
      }

      const validation = await validateAOILogic(currentAOI);

      if (!validation.logicRoutine) {
        addLog({
          message: 'No Logic routine found in AOI',
          type: 'error',
        });
        analytics.trackSimulationStartFailed({
          aoi: currentAOI,
          reason: 'no_logic_routine',
        });
        openStatusPanelWithTab('errors');
        return;
      } else if (
        !validation.logicRoutine.content ||
        validation.logicRoutine.content.trim() === ''
      ) {
        addLog({
          message: 'Logic routine is empty',
          type: 'error',
        });
        analytics.trackSimulationStartFailed({
          aoi: currentAOI,
          reason: 'empty_logic',
        });
        openStatusPanelWithTab('errors');
        return;
      } else if (validation.compilationResult) {
        validation.compilationResult.diagnostics.forEach((diagnostic: CompilationDiagnostic) => {
          const message = formatStudioErrorMessage(diagnostic, 'Logic');
          addLog({
            message: message,
            type: diagnostic.severity,
            code: diagnostic.code,
            line: diagnostic.type === 'st' ? diagnostic.line : undefined,
            column: diagnostic.type === 'st' ? diagnostic.column : undefined,
            routineName: 'Logic',
          });
        });

        if (validation.hasErrors) {
          analytics.trackSimulationStartFailed({
            aoi: currentAOI,
            reason: 'compile_failed_with_diagnostics',
            diagnosticCount: validation.compilationResult.diagnostics.length,
          });
          openStatusPanelWithTab('errors');
          return;
        }
      } else {
        addLog({
          message: 'Failed to compile Structured Text code due to internal error',
          type: 'error',
        });
        analytics.trackSimulationStartFailed({
          aoi: currentAOI,
          reason: 'compile_internal_error',
        });
        openStatusPanelWithTab('errors');
        return;
      }

      simulationManager.loadAOI(currentAOI);
      start();
      if (!hasOpenedTrendOnFirstStart && activeEditorTabFileType !== 'trend') {
        openAoiTrend({ aoiName: currentAOI.name });
        markTrendOpenedOnFirstStart();
      }
      setRightOpen(true);
    }
  };

  const hasAOI = currentAOI !== null;

  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleSimulationToggle}
              disabled={!hasAOI}
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-900"
            >
              {isRunning ? (
                <>
                  <StopOutlined className="size-6 text-red-600 dark:text-red-500" />
                  <span className="ml-1 text-sm">Stop</span>
                </>
              ) : (
                <>
                  <span className="relative inline-flex">
                    {!hasSeenStartButtonHighlight && shouldShowStartHighlight && (
                      <span className="absolute top-1/2 left-1/2 inline-flex size-5 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-green-500 opacity-75"></span>
                    )}
                    <PlayArrowOutlined className="relative size-6 text-green-600 dark:text-green-500" />
                  </span>
                  <span className="ml-1 text-sm">Start</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isRunning ? 'Stop simulation' : 'Start simulation'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {hasAOI && metrics && (
        <div className="flex items-center justify-end space-x-2 overflow-hidden px-3 py-2 text-right text-xs">
          <span className="shrink-0 font-mono whitespace-nowrap text-purple-600">
            {metrics.scanCount || 0} scans
          </span>
        </div>
      )}
    </div>
  );
}

export default SimulationControls;
