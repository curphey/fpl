'use client';

import { useState, useMemo } from 'react';
import type { Pick, Player, Team } from '@/lib/fpl/types';
import type { RivalTeam } from '@/lib/fpl/league-analyzer';
import { compareWithRival } from '@/lib/fpl/league-analyzer';
import { Badge } from '@/components/ui/badge';

export function RivalComparisonView({
  userPicks,
  rivals,
  playerMap,
  teamMap,
}: {
  userPicks: Pick[];
  rivals: RivalTeam[];
  playerMap: Map<number, Player>;
  teamMap: Map<number, Team>;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const rival = rivals[selectedIdx];

  const comparison = useMemo(() => {
    if (!rival) return null;
    return compareWithRival(userPicks, rival);
  }, [userPicks, rival]);

  if (rivals.length === 0) {
    return (
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center text-sm text-fpl-muted">
        No rivals loaded for comparison.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rival selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-fpl-muted">Compare with:</label>
        <select
          value={selectedIdx}
          onChange={(e) => setSelectedIdx(Number(e.target.value))}
          className="rounded-md border border-fpl-border bg-fpl-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-fpl-green"
        >
          {rivals.map((r, i) => (
            <option key={r.entry} value={i}>
              {r.name} (#{r.rank}, {r.pointsGap > 0 ? '+' : ''}{r.pointsGap} pts)
            </option>
          ))}
        </select>
      </div>

      {comparison && rival && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Summary card */}
          <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fpl-muted">
              Head to Head
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-fpl-green">
                  {comparison.shared.length}
                </p>
                <p className="text-xs text-fpl-muted">Shared</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {comparison.userOnly.length}
                </p>
                <p className="text-xs text-fpl-muted">Your Only</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-fpl-pink">
                  {comparison.rivalOnly.length}
                </p>
                <p className="text-xs text-fpl-muted">Their Only</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs">
              <span className="text-fpl-muted">Captain match:</span>
              <Badge variant={comparison.captainMatch ? 'green' : 'danger'}>
                {comparison.captainMatch ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="mt-2 text-center text-xs text-fpl-muted">
              Points gap:{' '}
              <span className={comparison.pointsGap > 0 ? 'text-fpl-danger' : 'text-fpl-green'}>
                {comparison.pointsGap > 0 ? '+' : ''}
                {comparison.pointsGap}
              </span>
            </div>
          </div>

          {/* Player lists */}
          <div className="space-y-3">
            <PlayerList
              title="Shared Players"
              playerIds={comparison.shared}
              playerMap={playerMap}
              teamMap={teamMap}
              variant="default"
            />
            <PlayerList
              title="Your Differentials"
              playerIds={comparison.userOnly}
              playerMap={playerMap}
              teamMap={teamMap}
              variant="green"
            />
            <PlayerList
              title="Their Differentials"
              playerIds={comparison.rivalOnly}
              playerMap={playerMap}
              teamMap={teamMap}
              variant="pink"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerList({
  title,
  playerIds,
  playerMap,
  teamMap,
  variant,
}: {
  title: string;
  playerIds: number[];
  playerMap: Map<number, Player>;
  teamMap: Map<number, Team>;
  variant: 'default' | 'green' | 'pink';
}) {
  const borderClass =
    variant === 'green'
      ? 'border-fpl-green/30'
      : variant === 'pink'
        ? 'border-fpl-pink/30'
        : 'border-fpl-border';

  return (
    <div className={`rounded-lg border ${borderClass} bg-fpl-card p-3`}>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fpl-muted">
        {title} ({playerIds.length})
      </h4>
      {playerIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {playerIds.map((id) => {
            const player = playerMap.get(id);
            const team = player ? teamMap.get(player.team) : undefined;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-fpl-purple-light px-2.5 py-1 text-xs"
              >
                <span className="font-medium">
                  {player?.web_name ?? `#${id}`}
                </span>
                {team && (
                  <span className="text-fpl-muted">{team.short_name}</span>
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-fpl-muted">None</p>
      )}
    </div>
  );
}
