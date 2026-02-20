import { useStore } from '@/store/store';
import { ErrorOutline, WarningAmberOutlined, InfoOutlined } from '@mui/icons-material';

type LogViewerProps = {
  filterType?: 'info' | 'error' | 'warning';
};

export default function LogViewer({ filterType }: LogViewerProps) {
  const allLogs = useStore((state) => state.logs);
  const logs = filterType ? allLogs.filter((log) => log.type === filterType) : allLogs;

  const messageTypeConfig = {
    info: {
      color: 'text-blue-500',
      icon: <InfoOutlined className="h-4 w-4" />,
    },
    warning: {
      color: 'text-amber-500',
      icon: <WarningAmberOutlined className="h-4 w-4" />,
    },
    error: {
      color: 'text-red-500',
      icon: <ErrorOutline className="h-4 w-4" />,
    },
  };

  if (logs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No logs</p>
          <p className="text-sm">
            {filterType ? `No ${filterType} logs found` : 'No logs to display'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 overflow-auto p-2">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 py-1 text-sm">
            <div
              className={`${messageTypeConfig[log.type].color} flex h-5 w-5 shrink-0 items-center justify-center`}
            >
              {messageTypeConfig[log.type].icon}
            </div>
            <div className="flex flex-1 gap-1">
              {log.code && <span className="text-gray-600">{log.code}</span>}
              <span>{log.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
