import { useMemo, type ReactNode, type ReactElement } from 'react';
import { CheckCircleOutlineOutlined, CancelOutlined } from '@mui/icons-material';
import { useStore } from '@/store/store';
import type { TestDetail } from '../../lib/test-execution-service';

export default function TestResults() {
  // Get the single test result
  const testResult = useStore((state) => state.test.result);
  const allTestResults = useMemo(() => (testResult ? [testResult] : []), [testResult]);

  if (allTestResults.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No test results</p>
          <p className="text-sm">Run tests to see results here</p>
        </div>
      </div>
    );
  }

  const statusStyles: Partial<Record<TestDetail['status'], { icon: ReactNode; color: string }>> = {
    passed: {
      icon: <CheckCircleOutlineOutlined className="h-4 w-4" />,
      color: 'text-green-600',
    },
    failed: {
      icon: <CancelOutlined className="h-4 w-4" />,
      color: 'text-red-600',
    },
  };
  const getStatusMeta = (status: TestDetail['status']) =>
    statusStyles[status] ?? {
      icon: <span className="text-[11px]">?</span>,
      color: 'text-gray-600',
    };

  // Helpers
  const formatMs = (ms: number) => `${ms.toFixed(0)}ms`;

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 overflow-auto">
        {allTestResults.map((testResult) => {
          const fileBlocks = testResult.testResults
            .map((fileResult, fileIndex) => {
              const details = fileResult.results?.details || [];
              const hasRenderableDetails = details.length > 0;

              if (!hasRenderableDetails && !fileResult.error) {
                return null;
              }

              const fileKey = `test-${testResult.aoiName}-${fileIndex}`;

              return (
                <div key={fileKey} className="border-b border-gray-100">
                  {hasRenderableDetails && (
                    <div className="flex flex-col">
                      {details.map((detail, detailIndex) => {
                        const meta = getStatusMeta(detail.status);
                        const failureMessages =
                          detail.failures && detail.failures.length > 0
                            ? detail.failures
                            : detail.error
                              ? [detail.error]
                              : [];
                        const showFailures =
                          detail.status === 'failed' && failureMessages.length > 0;
                        return (
                          <div
                            key={`${fileKey}-detail-${detailIndex}`}
                            className="flex items-start gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-50"
                          >
                            <div
                              className={`${meta.color} flex h-5 w-5 shrink-0 items-center justify-center text-base`}
                              aria-hidden
                            >
                              {meta.icon}
                            </div>
                            <div className="flex flex-1 flex-col gap-1">
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-gray-900" title={detail.name}>
                                  {detail.name}
                                </span>
                                <span className="text-[11px] text-gray-500 tabular-nums">
                                  {detail.duration > 0 ? formatMs(detail.duration) : '0ms'}
                                </span>
                              </div>
                              {showFailures && (
                                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
                                  <div className="flex flex-col gap-1 font-mono text-[11px] leading-relaxed">
                                    {failureMessages.map((message, failureIndex) => (
                                      <div key={`${detail.name}-failure-${failureIndex}`}>
                                        {message}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {fileResult.error && (
                    <div className="p-3 text-red-600">
                      <div className="font-medium">Error</div>
                      <div className="text-sm">{fileResult.error}</div>
                    </div>
                  )}
                </div>
              );
            })
            .filter((block): block is ReactElement => Boolean(block));

          if (fileBlocks.length === 0) {
            return null;
          }

          return <div key={testResult.aoiName}>{fileBlocks}</div>;
        })}
      </div>
    </div>
  );
}
