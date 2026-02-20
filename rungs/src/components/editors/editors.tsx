import { RoutineType } from '@/lib/enums';
import { useStore } from '@/store/store';
import Tags from './tags/tags';
import { STEditor } from './structured-text/st-editor';
import { LadderEditor } from './ladder/ladder-editor';
import TestEditor from './test/test-editor';
import TrendChart from './trend/trend-chart';
import Tabs from './tabs/tabs';

export default function Editors() {
  const currentAOI = useStore((state) => state.aoi);

  if (!currentAOI) {
    return (
      <div className="flex h-full w-full min-w-0 flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <Tabs />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Content />
      </div>
    </div>
  );
}

function Content() {
  const activeTab = useStore((state) => state.editors.tabs[state.editors?.activeTabIndex ?? 0]);
  const aoiLoadId = useStore((state) => state.aoiLoadId);

  switch (activeTab.fileType) {
    case RoutineType.ST:
      if ('aoiName' in activeTab && 'routineName' in activeTab) {
        return (
          <STEditor
            key={`${aoiLoadId}-${activeTab.fileId}`}
            routineName={activeTab.routineName}
          />
        );
      }
      return null;
    case RoutineType.LD:
      if ('aoiName' in activeTab && 'routineName' in activeTab) {
        return (
          <LadderEditor
            key={`${aoiLoadId}-${activeTab.fileId}`}
            routineName={activeTab.routineName}
          />
        );
      }
      return null;
    case 'tags':
      return <Tags />;
    case 'test':
      return <TestEditor />;
    case 'trend':
      if ('aoiName' in activeTab) {
        return <TrendChart aoiName={activeTab.aoiName} />;
      }
      return null;
    default:
      return null;
  }
}
