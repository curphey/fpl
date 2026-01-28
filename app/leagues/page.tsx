'use client';

import { useState, useMemo } from 'react';
import { useManagerContext } from '@/lib/fpl/manager-context';
import { ConnectPrompt } from '@/components/leagues/connect-prompt';
import { LeagueList } from '@/components/leagues/league-list';
import { LeagueStandingsTable } from '@/components/leagues/league-standings-table';

export default function LeaguesPage() {
  const { manager } = useManagerContext();
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  // Track manager to reset selection when it changes
  const [prevManagerId, setPrevManagerId] = useState<number | null>(null);

  const classicLeagues = useMemo(
    () => manager?.leagues.classic.filter((l) => l.league_type !== 's') ?? [],
    [manager],
  );

  // Derive: reset selection when manager changes (using React pattern for derived state)
  const currentManagerId = manager?.id ?? null;
  if (currentManagerId !== prevManagerId) {
    setPrevManagerId(currentManagerId);
    setSelectedLeagueId(null);
  }

  // Derive default selection from leagues list
  const activeLeagueId =
    selectedLeagueId ?? (classicLeagues.length > 0 ? classicLeagues[0].id : null);

  if (!manager) {
    return <ConnectPrompt />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leagues</h1>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <LeagueList
            leagues={classicLeagues}
            selectedLeagueId={activeLeagueId}
            onSelectLeague={setSelectedLeagueId}
          />
        </div>
        <div>
          {activeLeagueId ? (
            <LeagueStandingsTable leagueId={activeLeagueId} />
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-fpl-border bg-fpl-card p-12 text-sm text-fpl-muted">
              Select a league to view standings
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
