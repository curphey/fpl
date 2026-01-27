import type { PriceChangeCandidate } from '@/lib/fpl/price-model';
import { DataTable, type Column } from '@/components/ui/data-table';
import { PositionBadge } from '@/components/ui/badge';
import { getPlayerDisplayName, getPlayerPrice } from '@/lib/fpl/utils';

const riserColumns: Column<PriceChangeCandidate>[] = [
  {
    key: 'rank',
    header: '#',
    className: 'w-8',
    render: (_, i) => <span className="text-fpl-muted">{i + 1}</span>,
  },
  {
    key: 'name',
    header: 'Player',
    render: (r) => (
      <div>
        <span className="font-medium">{getPlayerDisplayName(r.player)}</span>
        <span className="ml-2 text-xs text-fpl-muted">{r.player.team_short_name}</span>
      </div>
    ),
  },
  {
    key: 'pos',
    header: 'Pos',
    className: 'w-12',
    render: (r) => <PositionBadge position={r.player.element_type} label={r.player.position_short} />,
  },
  {
    key: 'price',
    header: 'Price',
    className: 'w-16 text-right',
    render: (r) => <span className="text-fpl-muted">{getPlayerPrice(r.player)}</span>,
  },
  {
    key: 'net',
    header: 'Net Transfers',
    className: 'w-24 text-right',
    render: (r) => (
      <span className={r.netTransfers > 0 ? 'text-fpl-green' : 'text-fpl-danger'}>
        {r.netTransfers > 0 ? '+' : ''}{r.netTransfers.toLocaleString()}
      </span>
    ),
  },
  {
    key: 'prob',
    header: 'Likelihood',
    className: 'w-24',
    render: (r) => (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 rounded-full bg-fpl-border">
          <div
            className={`h-1.5 rounded-full ${r.direction === 'rise' ? 'bg-fpl-green' : 'bg-fpl-danger'}`}
            style={{ width: `${r.probability * 100}%` }}
          />
        </div>
        <span className="text-xs text-fpl-muted">{Math.round(r.probability * 100)}%</span>
      </div>
    ),
  },
];

export function PriceChangesTable({
  risers,
  fallers,
}: {
  risers: PriceChangeCandidate[];
  fallers: PriceChangeCandidate[];
}) {
  return (
    <div className="space-y-6">
      {/* Risers */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-fpl-green">
          Likely Price Rises ({risers.length})
        </h3>
        {risers.length > 0 ? (
          <DataTable
            columns={riserColumns}
            data={risers}
            keyExtractor={(r) => r.player.id}
          />
        ) : (
          <p className="py-3 text-center text-xs text-fpl-muted">No likely risers detected</p>
        )}
      </div>

      {/* Fallers */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-fpl-danger">
          Likely Price Falls ({fallers.length})
        </h3>
        {fallers.length > 0 ? (
          <DataTable
            columns={riserColumns}
            data={fallers}
            keyExtractor={(r) => r.player.id}
          />
        ) : (
          <p className="py-3 text-center text-xs text-fpl-muted">No likely fallers detected</p>
        )}
      </div>
    </div>
  );
}
