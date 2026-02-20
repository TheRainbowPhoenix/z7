interface TagViewTabsProps {
  activeView: 'all' | 'inputs' | 'outputs' | 'local';
  onViewChange: (view: 'all' | 'inputs' | 'outputs' | 'local') => void;
}

export function TagViewTabs({ activeView, onViewChange }: TagViewTabsProps) {
  const tabs = ['all', 'inputs', 'outputs', 'local'] as const;

  return (
    <div className="flex text-xs">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onViewChange(tab)}
          className={`flex-1 border-b-2 px-2 py-1 transition-colors ${
            activeView === tab
              ? 'border-blue-500 font-medium text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );
}
