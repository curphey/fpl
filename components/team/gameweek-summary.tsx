import type { ManagerHistoryCurrent } from '@/lib/fpl/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const chipDisplayNames: Record<string, string> = {
  '3xc': 'Triple Captain',
  bboost: 'Bench Boost',
  wildcard: 'Wildcard',
  freehit: 'Free Hit',
};

export function GameweekSummary({
  entryHistory,
  activeChip,
}: {
  entryHistory: ManagerHistoryCurrent;
  activeChip: string | null;
}) {
  const hits = entryHistory.event_transfers_cost;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-fpl-muted">Transfers </span>
          <span className="font-semibold">{entryHistory.event_transfers}</span>
        </div>

        <div>
          <span className="text-fpl-muted">Hits </span>
          <span className={`font-semibold ${hits > 0 ? 'text-fpl-danger' : ''}`}>
            {hits > 0 ? `-${hits}` : '0'}
          </span>
        </div>

        <div>
          <span className="text-fpl-muted">Bench Pts </span>
          <span className="font-semibold">{entryHistory.points_on_bench}</span>
        </div>

        {activeChip && (
          <Badge variant="green">
            {chipDisplayNames[activeChip] ?? activeChip}
          </Badge>
        )}
      </div>
    </Card>
  );
}
