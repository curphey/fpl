import type { BootstrapStatic } from '@/lib/fpl/types';
import {
  enrichPlayers,
  getPlayerOwnership,
  getPlayerDisplayName,
  getPlayerForm,
} from '@/lib/fpl/utils';
import { StatCard } from '@/components/ui/stat-card';

export function KeyStatsOverview({ data }: { data: BootstrapStatic }) {
  const enriched = enrichPlayers(data);

  const byPoints = [...enriched].sort((a, b) => b.total_points - a.total_points);
  const byForm = [...enriched].sort((a, b) => getPlayerForm(b) - getPlayerForm(a));
  const mostSelected = [...enriched].sort(
    (a, b) => getPlayerOwnership(b) - getPlayerOwnership(a),
  )[0];

  const topScorer = byPoints[0];
  const bestForm = byForm[0];

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard
        label="Total Players"
        value={data.total_players.toLocaleString()}
        subvalue="managers playing"
      />
      <StatCard
        label="Most Selected"
        value={mostSelected ? getPlayerDisplayName(mostSelected) : '-'}
        subvalue={
          mostSelected ? `${mostSelected.selected_by_percent}% ownership` : undefined
        }
      />
      <StatCard
        label="Top Scorer"
        value={topScorer ? getPlayerDisplayName(topScorer) : '-'}
        subvalue={topScorer ? `${topScorer.total_points} pts` : undefined}
      />
      <StatCard
        label="Best Form"
        value={bestForm ? getPlayerDisplayName(bestForm) : '-'}
        subvalue={bestForm ? `${getPlayerForm(bestForm).toFixed(1)} form` : undefined}
      />
    </div>
  );
}
