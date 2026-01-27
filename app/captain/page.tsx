'use client';

import { useState, useMemo } from 'react';
import { useBootstrapStatic, useFixtures } from '@/lib/fpl/hooks/use-fpl';
import { getNextGameweek, getCurrentGameweek, enrichPlayers, buildTeamMap } from '@/lib/fpl/utils';
import { scoreCaptainOptions } from '@/lib/fpl/captain-model';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { CaptainCard } from '@/components/captain/captain-card';

type CaptainFilter = 'all' | 'safe' | 'differential';

export default function CaptainPage() {
  const { data: bootstrap, isLoading: bsLoading, error: bsError, refetch: bsRefetch } = useBootstrapStatic();
  const { data: fixtures, isLoading: fxLoading, error: fxError, refetch: fxRefetch } = useFixtures();

  const [filter, setFilter] = useState<CaptainFilter>('all');

  const nextGw = bootstrap ? getNextGameweek(bootstrap.events) : undefined;
  const currentGw = bootstrap ? getCurrentGameweek(bootstrap.events) : undefined;
  const targetGw = nextGw ?? currentGw;

  const picks = useMemo(() => {
    if (!bootstrap || !fixtures || !targetGw) return [];
    const enriched = enrichPlayers(bootstrap);
    const teamMap = buildTeamMap(bootstrap.teams);
    return scoreCaptainOptions(enriched, fixtures, teamMap, targetGw.id);
  }, [bootstrap, fixtures, targetGw]);

  const filtered = useMemo(() => {
    if (filter === 'all') return picks.slice(0, 15);
    return picks.filter((p) => p.category === filter).slice(0, 15);
  }, [picks, filter]);

  const isLoading = bsLoading || fxLoading;
  const error = bsError || fxError;

  if (isLoading && !bootstrap) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={() => { bsRefetch(); fxRefetch(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Captain Selector</h1>
        <p className="text-sm text-fpl-muted">
          {targetGw ? `${targetGw.name} captain recommendations` : 'Captain recommendations'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(
          [
            { key: 'all', label: 'All Picks' },
            { key: 'safe', label: 'Safe' },
            { key: 'differential', label: 'Differential' },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-fpl-green/20 text-fpl-green'
                : 'bg-fpl-card text-fpl-muted hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Captain cards */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((pick, i) => (
            <CaptainCard key={pick.player.id} pick={pick} rank={i + 1} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center text-sm text-fpl-muted">
          No captain options available for the selected filter.
        </div>
      )}
    </div>
  );
}
