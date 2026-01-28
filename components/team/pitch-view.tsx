import type { Player, Team, Pick, AutomaticSub, PlayerPosition } from '@/lib/fpl/types';
import { PlayerCard } from './player-card';

export function PitchView({
  picks,
  playerMap,
  teamMap,
  livePointsMap,
  autoSubs,
}: {
  picks: Pick[];
  playerMap: Map<number, Player>;
  teamMap: Map<number, Team>;
  livePointsMap: Map<number, number> | null;
  autoSubs: AutomaticSub[];
}) {
  const starters = picks.filter((p) => p.position <= 11);
  const bench = picks.filter((p) => p.position > 11);

  const autoSubInIds = new Set(autoSubs.map((s) => s.element_in));
  const autoSubOutIds = new Set(autoSubs.map((s) => s.element_out));

  // Group starters by position: GK (1), DEF (2), MID (3), FWD (4)
  const rows: { position: PlayerPosition; picks: Pick[] }[] = [
    { position: 1, picks: [] },
    { position: 2, picks: [] },
    { position: 3, picks: [] },
    { position: 4, picks: [] },
  ];

  for (const pick of starters) {
    const player = playerMap.get(pick.element);
    if (!player) continue;
    const row = rows.find((r) => r.position === player.element_type);
    if (row) row.picks.push(pick);
  }

  function getAutoSub(elementId: number): 'in' | 'out' | undefined {
    if (autoSubInIds.has(elementId)) return 'in';
    if (autoSubOutIds.has(elementId)) return 'out';
    return undefined;
  }

  function getPoints(elementId: number): number | null {
    if (livePointsMap) {
      const pts = livePointsMap.get(elementId);
      return pts !== undefined ? pts : null;
    }
    const player = playerMap.get(elementId);
    return player ? player.event_points : null;
  }

  function renderPick(pick: Pick) {
    const player = playerMap.get(pick.element);
    if (!player) return null;
    const team = teamMap.get(player.team);
    return (
      <PlayerCard
        key={pick.element}
        player={player}
        teamShortName={team?.short_name ?? '???'}
        points={getPoints(pick.element)}
        isCaptain={pick.is_captain}
        isViceCaptain={pick.is_vice_captain}
        isBench={pick.position > 11}
        autoSub={getAutoSub(pick.element)}
      />
    );
  }

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
      {/* Pitch rows */}
      <div className="flex flex-col items-center gap-3">
        {rows.map((row) => (
          <div key={row.position} className="flex justify-center gap-3">
            {row.picks.map((pick) => renderPick(pick))}
          </div>
        ))}
      </div>

      {/* Bench separator */}
      <div className="my-4 border-t border-dashed border-fpl-border" />

      {/* Bench label + row */}
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-fpl-muted">
        Bench
      </p>
      <div className="flex justify-center gap-3">
        {bench.map((pick) => renderPick(pick))}
      </div>
    </div>
  );
}
