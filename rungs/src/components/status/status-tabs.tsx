import { cn } from '@/lib/utils';
import TabButton from '@/components/ui/tab-button';
import {
  ErrorOutline,
  WarningAmberOutlined,
  InfoOutlined,
  ListAltOutlined,
  ScienceOutlined,
} from '@mui/icons-material';

export type StatusTabType = 'all' | 'info' | 'errors' | 'warnings' | 'tests';

type Props = {
  infoCount: number;
  errorCount: number;
  warningCount: number;
  testResultsCount: number;
  totalCount: number;
  activeTab: StatusTabType;
  onSelect: (tab: StatusTabType) => void;
  className?: string;
};

export default function StatusTabs({
  infoCount,
  errorCount,
  warningCount,
  testResultsCount,
  totalCount,
  activeTab,
  onSelect,
  className,
}: Props) {
  const handleClick = (tab: StatusTabType) => () => {
    if (onSelect) onSelect(tab);
  };

  return (
    <div className={cn('flex', className)}>
      <TabButton
        onClick={handleClick('all')}
        active={activeTab === 'all'}
        label="All"
        icon={<ListAltOutlined className="h-4 w-4 text-gray-500" />}
        badgeCount={totalCount}
        badgeVariant="neutral"
        title="Show All Logs"
        aria-label="Show All Logs"
      />

      <TabButton
        onClick={handleClick('errors')}
        active={activeTab === 'errors'}
        label="Errors"
        icon={<ErrorOutline className="h-4 w-4 text-red-500" />}
        badgeCount={errorCount}
        badgeVariant="danger"
        title="Show Errors"
        aria-label="Show Errors"
      />

      <TabButton
        onClick={handleClick('warnings')}
        active={activeTab === 'warnings'}
        label="Warnings"
        icon={<WarningAmberOutlined className="h-4 w-4 text-amber-500" />}
        badgeCount={warningCount}
        badgeVariant="warning"
        title="Show Warnings"
        aria-label="Show Warnings"
      />

      <TabButton
        onClick={handleClick('info')}
        active={activeTab === 'info'}
        label="Info"
        icon={<InfoOutlined className="h-4 w-4 text-blue-500" />}
        badgeCount={infoCount}
        badgeVariant="neutral"
        title="Show Info"
        aria-label="Show Info"
      />

      <TabButton
        onClick={handleClick('tests')}
        active={activeTab === 'tests'}
        label="Tests"
        icon={<ScienceOutlined className="h-4 w-4" />}
        badgeCount={testResultsCount}
        badgeVariant="neutral"
        title="Show Tests"
        aria-label="Show Tests"
      />
    </div>
  );
}
