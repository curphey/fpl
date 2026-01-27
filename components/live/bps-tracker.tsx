import type { LiveElement, Player, Fixture } from '@/lib/fpl/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BPSEntry {
  player: Player;
  bps: number;
  bonusProjection: number; // 3, 2, 1, or 0
}

function computeBPSForFixture(
  fixture: Fixture,
  elements: LiveElement[],
  playerMap: Map<number, Player>,
): BPSEntry[] {
  // Find all players in this fixture
  const fixturePlayerIds = new Set<number>();
  for (const stat of fixture.stats) {
    for (const s of [...stat.h, ...stat.a]) {
      fixturePlayerIds.add(s.element);
    }
  }

  // Also include elements that have minutes and are on one of the two teams
  for (const el of elements) {
    const player = playerMap.get(el.id);
    if (
      player &&
      (player.team === fixture.team_h || player.team === fixture.team_a) &&
      el.stats.minutes > 0
    ) {
      fixturePlayerIds.add(el.id);
    }
  }

  const entries: BPSEntry[] = [];
  for (const id of fixturePlayerIds) {
    const el = elements.find((e) => e.id === id);
    const player = playerMap.get(id);
    if (!el || !player || el.stats.minutes === 0) continue;
    entries.push({ player, bps: el.stats.bps, bonusProjection: 0 });
  }

  // Sort by BPS descending and assign projected bonus
  entries.sort((a, b) => b.bps - a.bps);
  if (entries.length >= 1) entries[0].bonusProjection = 3;
  if (entries.length >= 2) entries[1].bonusProjection = 2;
  if (entries.length >= 3) entries[2].bonusProjection = 1;

  return entries.slice(0, 5); // top 5 per match
}

export function BPSTracker({
  fixtures,
  elements,
  playerMap,
  teamMap,
}: {
  fixtures: Fixture[];
  elements: LiveElement[];
  playerMap: Map<number, Player>;
  teamMap: Map<number, { short_name: string }>;
}) {
  const activeFixtures = fixtures.filter((f) => f.started);

  if (activeFixtures.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bonus Points (BPS)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-fpl-muted">
            No active matches.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bonus Points (BPS)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activeFixtures.map((fixture) => {
            const homeTeam = teamMap.get(fixture.team_h);
            const awayTeam = teamMap.get(fixture.team_a);
            const bpsEntries = computeBPSForFixture(fixture, elements, playerMap);

            return (
              <div key={fixture.id}>
                <p className="mb-1 text-xs font-semibold text-fpl-muted">
                  {homeTeam?.short_name ?? '???'} vs {awayTeam?.short_name ?? '???'}
                </p>
                <div className="space-y-1">
                  {bpsEntries.map((entry) => (
                    <div
                      key={entry.player.id}
                      className="flex items-center justify-between rounded border border-fpl-border/30 px-2 py-1 text-sm"
                    >
                      <span>{entry.player.web_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-fpl-muted">
                          {entry.bps} BPS
                        </span>
                        {entry.bonusProjection > 0 && (
                          <Badge variant="green">+{entry.bonusProjection}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
