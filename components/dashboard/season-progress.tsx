import type { Gameweek } from '@/lib/fpl/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function SeasonProgress({ events }: { events: Gameweek[] }) {
  const completed = events.filter((e) => e.finished).length;
  const total = 38;
  const pct = Math.round((completed / total) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Season Progress</CardTitle>
          <span className="text-xs text-fpl-muted">
            {completed}/{total} gameweeks
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-3 w-full overflow-hidden rounded-full bg-fpl-purple-light">
          <div
            className="h-full rounded-full bg-fpl-green transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-center text-sm font-medium text-fpl-muted">
          {pct}% complete
        </p>
      </CardContent>
    </Card>
  );
}
