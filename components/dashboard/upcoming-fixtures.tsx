import type { Fixture, Team } from '@/lib/fpl/types';
import {
  buildTeamMap,
  formatKickoffTime,
  getFixtureDifficultyClass,
} from '@/lib/fpl/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function UpcomingFixtures({
  fixtures,
  teams,
  gameweekId,
}: {
  fixtures: Fixture[];
  teams: Team[];
  gameweekId: number;
}) {
  const teamMap = buildTeamMap(teams);

  const gwFixtures = fixtures
    .filter((f) => f.event === gameweekId)
    .sort((a, b) => {
      if (!a.kickoff_time) return 1;
      if (!b.kickoff_time) return -1;
      return new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime();
    });

  if (gwFixtures.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Fixtures</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-fpl-muted">No fixtures scheduled.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Fixtures</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {gwFixtures.map((fixture) => {
            const home = teamMap.get(fixture.team_h);
            const away = teamMap.get(fixture.team_a);
            return (
              <div
                key={fixture.id}
                className="flex items-center justify-between rounded-md border border-fpl-border/50 px-3 py-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${getFixtureDifficultyClass(fixture.team_a_difficulty)}`}
                  />
                  <span className="font-medium">{home?.short_name ?? '???'}</span>
                </div>
                <div className="text-xs text-fpl-muted">
                  {fixture.finished
                    ? `${fixture.team_h_score} - ${fixture.team_a_score}`
                    : formatKickoffTime(fixture.kickoff_time)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{away?.short_name ?? '???'}</span>
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${getFixtureDifficultyClass(fixture.team_h_difficulty)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
