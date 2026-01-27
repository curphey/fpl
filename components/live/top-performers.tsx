import type { LiveElement, Player } from '@/lib/fpl/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';

interface LivePlayerRow {
  element: LiveElement;
  player: Player;
}

export function TopPerformers({
  elements,
  playerMap,
}: {
  elements: LiveElement[];
  playerMap: Map<number, Player>;
}) {
  const rows: LivePlayerRow[] = elements
    .map((e) => {
      const player = playerMap.get(e.id);
      if (!player) return null;
      return { element: e, player };
    })
    .filter((r): r is LivePlayerRow => r !== null)
    .sort((a, b) => b.element.stats.total_points - a.element.stats.total_points)
    .slice(0, 15);

  const columns: Column<LivePlayerRow>[] = [
    {
      key: 'rank',
      header: '#',
      className: 'w-8',
      render: (_, i) => <span className="text-fpl-muted">{i + 1}</span>,
    },
    {
      key: 'name',
      header: 'Player',
      render: (r) => <span className="font-medium">{r.player.web_name}</span>,
    },
    {
      key: 'mins',
      header: 'Mins',
      className: 'w-12 text-right',
      render: (r) => (
        <span className="text-fpl-muted">{r.element.stats.minutes}</span>
      ),
    },
    {
      key: 'goals',
      header: 'G',
      className: 'w-8 text-center',
      render: (r) =>
        r.element.stats.goals_scored > 0 ? (
          <span className="font-semibold text-fpl-green">
            {r.element.stats.goals_scored}
          </span>
        ) : (
          <span className="text-fpl-muted">-</span>
        ),
    },
    {
      key: 'assists',
      header: 'A',
      className: 'w-8 text-center',
      render: (r) =>
        r.element.stats.assists > 0 ? (
          <span className="font-semibold text-fpl-green">
            {r.element.stats.assists}
          </span>
        ) : (
          <span className="text-fpl-muted">-</span>
        ),
    },
    {
      key: 'bps',
      header: 'BPS',
      className: 'w-10 text-right',
      render: (r) => (
        <span className="text-fpl-muted">{r.element.stats.bps}</span>
      ),
    },
    {
      key: 'pts',
      header: 'Pts',
      className: 'w-10 text-right',
      render: (r) => (
        <span className="font-bold text-fpl-green">
          {r.element.stats.total_points}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Performers</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <DataTable
            columns={columns}
            data={rows}
            keyExtractor={(r) => r.element.id}
          />
        ) : (
          <p className="py-4 text-center text-sm text-fpl-muted">
            No live data yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
