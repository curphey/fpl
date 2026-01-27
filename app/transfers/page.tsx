'use client';

import { useState, useMemo } from 'react';
import { useBootstrapStatic, useFixtures } from '@/lib/fpl/hooks/use-fpl';
import { getNextGameweek, getCurrentGameweek, enrichPlayers } from '@/lib/fpl/utils';
import { scoreTransferTargets } from '@/lib/fpl/transfer-model';
import type { PlayerPosition } from '@/lib/fpl/types';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TransferTable } from '@/components/transfers/transfer-table';

type PositionFilter = 'all' | PlayerPosition;

const positionFilters: { key: PositionFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 1, label: 'GK' },
  { key: 2, label: 'DEF' },
  { key: 3, label: 'MID' },
  { key: 4, label: 'FWD' },
];

const priceRanges = [
  { label: 'All prices', min: 0, max: 20 },
  { label: 'Budget (<6.0)', min: 0, max: 5.9 },
  { label: 'Mid (6.0-9.0)', min: 6.0, max: 9.0 },
  { label: 'Premium (>9.0)', min: 9.1, max: 20 },
];

export default function TransfersPage() {
  const { data: bootstrap, isLoading: bsLoading, error: bsError, refetch: bsRefetch } = useBootstrapStatic();
  const { data: fixtures, isLoading: fxLoading, error: fxError, refetch: fxRefetch } = useFixtures();

  const [posFilter, setPosFilter] = useState<PositionFilter>('all');
  const [priceIdx, setPriceIdx] = useState(0);
  const [showDifferentials, setShowDifferentials] = useState(false);

  const nextGw = bootstrap ? getNextGameweek(bootstrap.events) : undefined;
  const currentGw = bootstrap ? getCurrentGameweek(bootstrap.events) : undefined;
  const nextGwId = nextGw?.id ?? currentGw?.id ?? 1;

  const recommendations = useMemo(() => {
    if (!bootstrap || !fixtures) return [];

    let players = enrichPlayers(bootstrap);

    // Position filter
    if (posFilter !== 'all') {
      players = players.filter((p) => p.element_type === posFilter);
    }

    // Price filter
    const range = priceRanges[priceIdx];
    players = players.filter((p) => {
      const price = p.now_cost / 10;
      return price >= range.min && price <= range.max;
    });

    // Differential filter (< 10% ownership)
    if (showDifferentials) {
      players = players.filter((p) => parseFloat(p.selected_by_percent) < 10);
    }

    return scoreTransferTargets(players, fixtures, nextGwId).slice(0, 25);
  }, [bootstrap, fixtures, posFilter, priceIdx, showDifferentials, nextGwId]);

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
        <h1 className="text-xl font-bold">Transfer Recommender</h1>
        <p className="text-sm text-fpl-muted">
          Best transfer targets based on form, fixtures, value, and xGI
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Position */}
        <div className="flex items-center gap-1">
          {positionFilters.map((f) => (
            <button
              key={String(f.key)}
              onClick={() => setPosFilter(f.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                posFilter === f.key
                  ? 'bg-fpl-green/20 text-fpl-green'
                  : 'bg-fpl-card text-fpl-muted hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Price range */}
        <div className="flex items-center gap-1">
          {priceRanges.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setPriceIdx(i)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                priceIdx === i
                  ? 'bg-fpl-green/20 text-fpl-green'
                  : 'bg-fpl-card text-fpl-muted hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Differential toggle */}
        <button
          onClick={() => setShowDifferentials((d) => !d)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            showDifferentials
              ? 'bg-fpl-pink/20 text-fpl-pink'
              : 'bg-fpl-card text-fpl-muted hover:text-foreground'
          }`}
        >
          Differentials (&lt;10%)
        </button>
      </div>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Recommendations</CardTitle>
            <Badge variant="green">{recommendations.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {recommendations.length > 0 ? (
            <TransferTable recommendations={recommendations} />
          ) : (
            <p className="py-4 text-center text-sm text-fpl-muted">
              No players match the current filters.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
