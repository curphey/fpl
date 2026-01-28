'use client';

export type AnalyzerTab = 'eo' | 'differentials' | 'rival' | 'swing';

const tabs: { key: AnalyzerTab; label: string }[] = [
  { key: 'eo', label: 'Effective Ownership' },
  { key: 'differentials', label: 'Differentials' },
  { key: 'rival', label: 'Rival Comparison' },
  { key: 'swing', label: 'Swing Scenarios' },
];

export function AnalyzerTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: AnalyzerTab;
  onTabChange: (tab: AnalyzerTab) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onTabChange(t.key)}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === t.key
              ? 'bg-fpl-green/20 text-fpl-green'
              : 'bg-fpl-card text-fpl-muted hover:text-foreground'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
