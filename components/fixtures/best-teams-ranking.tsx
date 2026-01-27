import type { TeamFixtureRow } from '@/lib/fpl/fixture-planner';
import { sortByEasiestFixtures } from '@/lib/fpl/fixture-planner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function BestTeamsRanking({ rows }: { rows: TeamFixtureRow[] }) {
  const sorted = sortByEasiestFixtures(rows);
  const top10 = sorted.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Easiest Fixtures</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {top10.map((row, i) => {
            let fixtureCount = 0;
            for (const cells of row.fixtures.values()) {
              fixtureCount += cells.length;
            }
            const avgDifficulty =
              fixtureCount > 0
                ? (row.totalDifficulty / fixtureCount).toFixed(2)
                : '-';
            return (
              <div
                key={row.team.id}
                className="flex items-center justify-between rounded-md border border-fpl-border/50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-xs text-fpl-muted">{i + 1}</span>
                  <span className="text-sm font-medium">{row.team.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-fpl-muted">
                  <span>{fixtureCount} matches</span>
                  <span className="font-semibold text-fpl-green">
                    {avgDifficulty} avg
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
