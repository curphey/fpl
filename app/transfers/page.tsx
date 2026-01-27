'use client';

import { useState, useMemo } from 'react';
import { useBootstrapStatic, useFixtures } from '@/lib/fpl/hooks/use-fpl';
import { getNextGameweek, getCurrentGameweek, enrichPlayers } from '@/lib/fpl/utils';
import { scoreTransferTargets } from '@/lib/fpl/transfer-model';
import { predictPriceChanges } from '@/lib/fpl/price-model';
import type { PlayerPosition } from '@/lib/fpl/types';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TransferTable } from '@/components/transfers/transfer-table';
import { PriceChangesTable } from '@/components/transfers/price-changes';

type Tab = 'recommendations' | 'prices';
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

  const [tab, setTab] = useState<Tab>('recommendations');
  const [posFilter, setPosFilter] = useState<PositionFilter>('all');
  const [priceIdx, setPriceIdx] = useState(0);
  const [showDifferentials, setShowDifferentials] = useState(false);

  const nextGw = bootstrap ? getNextGameweek(bootstrap.events) : undefined;
  const currentGw = bootstrap ? getCurrentGameweek(bootstrap.events) : undefined;
  const nextGwId = nextGw?.id ?? currentGw?.id ?? 1;

  const enriched = useMemo(() => {
    if (!bootstrap) return [];
    return enrichPlayers(bootstrap);
  }, [bootstrap]);

  const recommendations = useMemo(() => {
    if (!enriched.length || !fixtures) return [];

    let players = enriched;

    if (posFilter !== 'all') {
      players = players.filter((p) => p.element_type === posFilter);
    }

    const range = priceRanges[priceIdx];
    players = players.filter((p) => {
      const price = p.now_cost / 10;
      return price >= range.min && price <= range.max;
    });

    if (showDifferentials) {
      players = players.filter((p) => parseFloat(p.selected_by_percent) < 10);
    }

    return scoreTransferTargets(players, fixtures, nextGwId).slice(0, 25);
  }, [enriched, fixtures, posFilter, priceIdx, showDifferentials, nextGwId]);

  const priceChanges = useMemo(() => {
    if (!enriched.length) return { risers: [], fallers: [] };
    return predictPriceChanges(enriched);
  }, [enriched]);

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
      <div>
        <h1 className="text-xl font-bold">Transfer Hub</h1>
        <p className="text-sm text-fpl-muted">
          Transfer targets and price change predictions
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-fpl-border">
        {([
          { key: 'recommendations' as Tab, label: 'Recommendations' },
          { key: 'prices' as Tab, label: 'Price Changes' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-fpl-green text-fpl-green'
                : 'border-transparent text-fpl-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'recommendations' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
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
        </>
      )}

      {tab === 'prices' && (
        <Card>
          <CardHeader>
            <CardTitle>Predicted Price Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceChangesTable
              risers={priceChanges.risers}
              fallers={priceChanges.fallers}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
