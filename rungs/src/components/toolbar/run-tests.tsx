import { analytics } from '@/lib/posthog-analytics';
import { useStore } from '@/store/store';
import { ScienceOutlined } from '@mui/icons-material';
import { nanoid } from 'nanoid';
import { TestExecutionService } from '../../lib/test-execution-service';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

function RunTests() {
  const currentAOI = useStore((state) => state.aoi);
  const isRunning = useStore((state) => state.test.isRunning);
  const startTest = useStore((state) => state.startTest);
  const completeTest = useStore((state) => state.completeTest);
  const failTest = useStore((state) => state.failTest);
  const openStatusPanelWithTab = useStore((state) => state.openStatusPanelWithTab);

  const hasTests = Boolean(currentAOI?.testing?.content);

  const handleRunTests = async () => {
    if (!hasTests || isRunning || !currentAOI) return;

    const runId = nanoid();
    const startTime = Date.now();

    startTest();
    openStatusPanelWithTab('tests');
    analytics.trackTestRunStarted(currentAOI, runId);

    try {
      const results = await TestExecutionService.executeAOITests(currentAOI);
      completeTest(results);

      const durationMs = Date.now() - startTime;
      const totalCount = results.summary.totalPassed + results.summary.totalFailed;
      const passedCount = results.summary.totalPassed;
      const failedCount = results.summary.totalFailed;
      const status = failedCount === 0 ? 'passed' : passedCount === 0 ? 'failed' : 'partial';

      analytics.trackTestRunCompleted(
        currentAOI,
        runId,
        status,
        totalCount,
        passedCount,
        failedCount,
        durationMs,
      );
    } catch {
      failTest();
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRunTests}
            disabled={!hasTests || isRunning}
            className="h-8 px-2 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-900"
          >
            <ScienceOutlined className={`size-6 ${isRunning ? 'animate-pulse' : ''}`} />
            <span className="ml-1 text-sm">{isRunning ? 'Running...' : 'Test'}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {hasTests
              ? `Run tests for ${currentAOI?.name || 'current AOI'}`
              : 'No tests available for current AOI'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default RunTests;
