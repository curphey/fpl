'use client';

import type { ManagerLeague } from '@/lib/fpl/types';

interface LeagueListProps {
  leagues: ManagerLeague[];
  selectedLeagueId: number | null;
  onSelectLeague: (id: number) => void;
}

export function LeagueList({ leagues, selectedLeagueId, onSelectLeague }: LeagueListProps) {
  // Filter out system leagues (league_type 's')
  const classicLeagues = leagues.filter((l) => l.league_type !== 's');

  if (classicLeagues.length === 0) {
    return (
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-4 text-center text-sm text-fpl-muted">
        No classic leagues found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card">
      <div className="border-b border-fpl-border px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fpl-muted">
          Your Leagues
        </h2>
      </div>
      <ul className="divide-y divide-fpl-border">
        {classicLeagues.map((league) => {
          const isSelected = league.id === selectedLeagueId;
          const rankDelta = league.entry_last_rank - league.entry_rank;

          return (
            <li key={league.id}>
              <button
                onClick={() => onSelectLeague(league.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'bg-fpl-purple-light text-foreground'
                    : 'text-fpl-muted hover:bg-fpl-purple-light/50 hover:text-foreground'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{league.name}</p>
                  <p className="text-xs text-fpl-muted">
                    Rank: {league.entry_rank.toLocaleString()}
                    {league.rank_count != null && (
                      <span> / {league.rank_count.toLocaleString()}</span>
                    )}
                  </p>
                </div>
                {rankDelta !== 0 && (
                  <span
                    className={`text-xs font-semibold ${
                      rankDelta > 0 ? 'text-fpl-green' : 'text-fpl-danger'
                    }`}
                  >
                    {rankDelta > 0 ? `+${rankDelta}` : rankDelta}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
