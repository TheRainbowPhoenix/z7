import { memo, useCallback } from 'react';
import type { KeyboardEventHandler } from 'react';
import { useStore, type EditorTab } from '@/store/store';
import TabButton from '@/components/ui/tab-button';
import { RoutineType } from '@/lib/enums';
import { LocalOfferOutlined, ScienceOutlined, ShowChartOutlined } from '@mui/icons-material';
import { LadderFileIcon } from '@/components/icons/ladder-file-icon';
import { StFileIcon } from '@/components/icons/st-file-icon';

type Props = {
  tab: EditorTab;
  index: number;
};

function Tab({ tab, index }: Props) {
  const { fileId, fileType } = tab;
  const selectTabAction = useStore((state) => state.selectTab);

  let fileName = 'Tab';
  if (fileType === 'tags') {
    fileName = 'Tags';
  } else if (fileType === RoutineType.ST && 'routineName' in tab) {
    fileName = tab.routineName;
  } else if (fileType === RoutineType.LD && 'routineName' in tab) {
    fileName = tab.routineName;
  } else if (fileType === 'test') {
    fileName = 'Tests';
  } else if (fileType === 'trend') {
    fileName = 'Trend';
  }

  const isSelected = useStore(
    (state) => state.editors.tabs[state.editors.activeTabIndex]?.fileId === fileId,
  );

  const selectTab = useCallback(() => {
    selectTabAction(index);
  }, [selectTabAction, index]);

  const handleKeyDown: KeyboardEventHandler<HTMLButtonElement> = useCallback(
    (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectTab();
      }
    },
    [selectTab],
  );

  const FileIcons = {
    tags: <LocalOfferOutlined className="h-4 w-4" />,
    st: <StFileIcon className="h-4 w-4" />,
    ld: <LadderFileIcon className="h-4 w-4" />,
    test: <ScienceOutlined className="h-4 w-4" />,
    trend: <ShowChartOutlined className="h-4 w-4" />,
  } as const;

  return (
    <TabButton
      role="tab"
      aria-selected={isSelected}
      aria-controls={`tabpanel-${fileId}`}
      tabIndex={isSelected ? 0 : -1}
      onClick={selectTab}
      onKeyDown={handleKeyDown}
      active={isSelected}
      label={fileName}
      icon={<div className="text-inherit">{FileIcons[fileType]}</div>}
      title={`Switch to ${fileName} tab`}
    />
  );
}

export default memo(Tab);
