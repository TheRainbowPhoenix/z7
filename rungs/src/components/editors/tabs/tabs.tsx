import type { KeyboardEvent } from 'react';
import { useStore } from '@/store/store';
import Tab from './tab';

function Tabs() {
  const openTabs = useStore((state) => state.editors.tabs);
  const activeTabIndex = useStore((state) => state.editors.activeTabIndex);
  const selectTab = useStore((state) => state.selectTab);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      const newIndex = (activeTabIndex + direction + openTabs.length) % openTabs.length;
      selectTab(newIndex);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="AOI Editor Tabs"
      onKeyDown={handleKeyDown}
      className="flex border-b bg-slate-100"
    >
      {openTabs.map((tab, index) => (
        <Tab key={tab.fileId} tab={tab} index={index} />
      ))}
    </div>
  );
}

export default Tabs;
