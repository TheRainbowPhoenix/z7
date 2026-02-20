import { useStore } from '@/store/store';
import StatusTabs, { StatusTabType } from '@/components/status/status-tabs';
import {
  CheckCircleOutlineOutlined,
  CancelOutlined,
  Close,
  DeleteOutline,
} from '@mui/icons-material';

export default function StatusBar() {
  const logs = useStore((state) => state.logs);
  const { isOpen, activeTab } = useStore((state) => state.editors.statusPanel);
  const testResult = useStore((state) => state.test.result);
  const testResultsCount = useStore((state) => {
    const testResult = state.test.result;
    if (!testResult) return 0;
    return testResult.summary.totalTests;
  });
  const changeStatusPanelTab = useStore((state) => state.changeStatusPanelTab);
  const openStatusPanelWithTab = useStore((state) => state.openStatusPanelWithTab);
  const closeStatusPanel = useStore((state) => state.closeStatusPanel);
  const clearLogs = useStore((state) => state.clearLogs);

  const errorCount = logs.filter((log) => log.type === 'error').length;
  const warningCount = logs.filter((log) => log.type === 'warning').length;
  const infoCount = logs.filter((log) => log.type === 'info').length;
  const totalCount = logs.length;

  const handleSelect = (tab: StatusTabType) => {
    if (isOpen) {
      changeStatusPanelTab(tab);
      return;
    }
    openStatusPanelWithTab(tab);
  };

  const handleClose = () => {
    closeStatusPanel();
  };

  const handleClear = () => {
    clearLogs();
  };

  return (
    <div className="flex items-center justify-between border-t border-slate-300 bg-slate-100 text-sm">
      <StatusTabs
        infoCount={infoCount}
        errorCount={errorCount}
        warningCount={warningCount}
        testResultsCount={testResultsCount}
        totalCount={totalCount}
        activeTab={activeTab}
        onSelect={handleSelect}
      />

      <div className="flex items-center">
        {activeTab === 'tests' && testResult && (
          <div className="flex items-center gap-1 pr-2">
            <span className="text-sm text-slate-700">Test Results</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-sm text-green-700">
              <CheckCircleOutlineOutlined className="h-4 w-4" />
              {testResult.summary.totalPassed}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-sm ${
                testResult.summary.totalFailed > 0 ? 'text-red-700' : 'text-slate-500'
              }`}
            >
              <CancelOutlined className="h-4 w-4" />
              {testResult.summary.totalFailed}
            </span>
          </div>
        )}

        {isOpen && (
          <>
            {(activeTab === 'all' ||
              activeTab === 'info' ||
              activeTab === 'errors' ||
              activeTab === 'warnings') && (
              <button
                onClick={handleClear}
                className="mx-2 flex h-8 w-8 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-700"
                title="Clear logs"
              >
                <DeleteOutline className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleClose}
              className="mx-2 flex h-8 w-8 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-700"
            >
              <Close className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
