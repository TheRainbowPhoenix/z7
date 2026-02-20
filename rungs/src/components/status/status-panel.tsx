import { useEffect, useState } from 'react';
import { useStore } from '@/store/store';
import LogViewer from './log-viewer';
import TestResults from './test-results';
import StatusBar from './status-bar';

export default function StatusPanel() {
  const { isOpen, height, activeTab } = useStore((state) => state.editors.statusPanel);
  const changeStatusPanelHeight = useStore((state) => state.changeStatusPanelHeight);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartHeight(height);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartY - e.clientY; // Inverted because we're dragging from bottom
      const newHeight = Math.max(200, Math.min(window.innerHeight * 0.8, dragStartHeight + deltaY));
      changeStatusPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartY, dragStartHeight, changeStatusPanelHeight]);

  const ActiveComponent = activeTab === 'tests' ? TestResults : LogViewer;
  const activeFilterType =
    activeTab === 'info'
      ? 'info'
      : activeTab === 'errors'
        ? 'error'
        : activeTab === 'warnings'
          ? 'warning'
          : activeTab === 'all'
            ? undefined
            : undefined;

  const panelHeight = isOpen ? `${height}px` : undefined;

  return (
    <div
      className="absolute right-0 bottom-0 left-0 z-50 flex flex-col border-t border-slate-300 bg-white shadow-lg"
      style={{ height: panelHeight }}
    >
      {isOpen && (
        <div
          className="h-1 cursor-row-resize bg-slate-300 transition-colors hover:bg-slate-400"
          onMouseDown={handleMouseDown}
        />
      )}

      <StatusBar />

      {isOpen && (
        <div className="flex-1 overflow-hidden">
          {ActiveComponent === LogViewer ? (
            <LogViewer filterType={activeFilterType} />
          ) : (
            <ActiveComponent />
          )}
        </div>
      )}
    </div>
  );
}
