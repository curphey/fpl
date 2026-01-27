import type { Fixture, Team } from '@/lib/fpl/types';
import { formatKickoffTime } from '@/lib/fpl/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

function MatchCard({
  fixture,
  teamMap,
}: {
  fixture: Fixture;
  teamMap: Map<number, Team>;
}) {
  const home = teamMap.get(fixture.team_h);
  const away = teamMap.get(fixture.team_a);
  const isLive = fixture.started && !fixture.finished;

  return (
    <div className="rounded-lg border border-fpl-border/50 bg-fpl-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{home?.short_name ?? '???'}</span>
        <div className="text-center">
          {fixture.started ? (
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold">
                {fixture.team_h_score ?? 0}
              </span>
              <span className="text-fpl-muted">-</span>
              <span className="text-lg font-bold">
                {fixture.team_a_score ?? 0}
              </span>
            </div>
          ) : (
            <span className="text-xs text-fpl-muted">
              {formatKickoffTime(fixture.kickoff_time)}
            </span>
          )}
          {isLive && (
            <div className="flex items-center justify-center gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-fpl-green" />
              <span className="text-[10px] font-semibold text-fpl-green">
                {fixture.minutes}&apos;
              </span>
            </div>
          )}
          {fixture.finished && (
            <span className="text-[10px] text-fpl-muted">FT</span>
          )}
        </div>
        <span className="text-sm font-medium">{away?.short_name ?? '???'}</span>
      </div>
    </div>
  );
}

export function MatchScores({
  fixtures,
  teamMap,
}: {
  fixtures: Fixture[];
  teamMap: Map<number, Team>;
}) {
  const sorted = [...fixtures].sort((a, b) => {
    // Live first, then upcoming, then finished
    const aLive = a.started && !a.finished ? 0 : a.finished ? 2 : 1;
    const bLive = b.started && !b.finished ? 0 : b.finished ? 2 : 1;
    if (aLive !== bLive) return aLive - bLive;
    if (!a.kickoff_time) return 1;
    if (!b.kickoff_time) return -1;
    return new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime();
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Matches</CardTitle>
          {sorted.some((f) => f.started && !f.finished) && (
            <span className="flex items-center gap-1 text-xs text-fpl-green">
              <span className="h-2 w-2 animate-pulse rounded-full bg-fpl-green" />
              LIVE
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((f) => (
            <MatchCard key={f.id} fixture={f} teamMap={teamMap} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
