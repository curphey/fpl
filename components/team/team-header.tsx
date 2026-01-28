import type { ManagerEntry, ManagerHistoryCurrent } from '@/lib/fpl/types';
import { StatCard } from '@/components/ui/stat-card';

export function TeamHeader({
  manager,
  entryHistory,
}: {
  manager: ManagerEntry;
  entryHistory: ManagerHistoryCurrent | null;
}) {
  const bank = entryHistory ? `\u00A3${(entryHistory.bank / 10).toFixed(1)}m` : '-';
  const value = entryHistory ? `\u00A3${(entryHistory.value / 10).toFixed(1)}m` : '-';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{manager.name}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="GW Points"
          value={entryHistory?.points ?? manager.summary_event_points}
        />
        <StatCard
          label="Overall Points"
          value={entryHistory?.total_points ?? manager.summary_overall_points}
        />
        <StatCard
          label="Overall Rank"
          value={(entryHistory?.overall_rank ?? manager.summary_overall_rank).toLocaleString()}
        />
        <StatCard label="Bank" value={bank} />
        <StatCard label="Squad Value" value={value} />
      </div>
    </div>
  );
}
