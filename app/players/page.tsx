'use client';

import { useState, useMemo } from 'react';
import { useBootstrapStatic, useFixtures } from '@/lib/fpl/hooks/use-fpl';
import { getNextGameweek, getCurrentGameweek, enrichPlayers, getPlayerDisplayName, getPlayerPrice } from '@/lib/fpl/utils';
import { predictPoints, type PointsPrediction } from '@/lib/fpl/points-model';
import type { PlayerPosition } from '@/lib/fpl/types';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge, PositionBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';

type PosFilter = 'all' | PlayerPosition;

const confidenceColors = {
  high: 'text-fpl-green',
  medium: 'text-yellow-400',
  low: 'text-fpl-muted',
};

export default function PlayersPage() {
  const { data: bootstrap, isLoading: bsLoading, error: bsError, refetch: bsRefetch } = useBootstrapStatic();
  const { data: fixtures, isLoading: fxLoading, error: fxError, refetch: fxRefetch } = useFixtures();

  const [posFilter, setPosFilter] = useState<PosFilter>('all');
  const [search, setSearch] = useState('');

  const nextGw = bootstrap ? getNextGameweek(bootstrap.events) : undefined;
  const currentGw = bootstrap ? getCurrentGameweek(bootstrap.events) : undefined;
  const targetGw = nextGw ?? currentGw;

  const predictions = useMemo(() => {
    if (!bootstrap || !fixtures || !targetGw) return [];
    const enriched = enrichPlayers(bootstrap);
    let preds = predictPoints(enriched, fixtures, targetGw.id);

    if (posFilter !== 'all') {
      preds = preds.filter((p) => p.player.element_type === posFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      preds = preds.filter(
        (p) =>
          p.player.web_name.toLowerCase().includes(q) ||
          p.player.first_name.toLowerCase().includes(q) ||
          p.player.second_name.toLowerCase().includes(q) ||
          p.player.team_short_name.toLowerCase().includes(q),
      );
    }
    return preds.slice(0, 50);
  }, [bootstrap, fixtures, targetGw, posFilter, search]);

  const columns: Column<PointsPrediction>[] = [
    {
      key: 'rank',
      header: '#',
      className: 'w-8',
      render: (_, i) => <span className="text-fpl-muted">{i + 1}</span>,
    },
    {
      key: 'name',
      header: 'Player',
      render: (r) => (
        <div>
          <span className="font-medium">{getPlayerDisplayName(r.player)}</span>
          <span className="ml-2 text-xs text-fpl-muted">{r.player.team_short_name}</span>
        </div>
      ),
    },
    {
      key: 'pos',
      header: 'Pos',
      className: 'w-12',
      render: (r) => <PositionBadge position={r.player.element_type} label={r.player.position_short} />,
    },
    {
      key: 'price',
      header: 'Price',
      className: 'w-16 text-right',
      render: (r) => <span className="text-fpl-muted">{getPlayerPrice(r.player)}</span>,
    },
    {
      key: 'form',
      header: 'Form',
      className: 'w-12 text-right',
      render: (r) => <span className="text-fpl-muted">{r.player.form}</span>,
    },
    {
      key: 'pts',
      header: 'Pts',
      className: 'w-12 text-right',
      render: (r) => <span>{r.player.total_points}</span>,
    },
    {
      key: 'xPts',
      header: 'xPts',
      className: 'w-14 text-right',
      render: (r) => (
        <span className="font-bold text-fpl-green">{r.predictedPoints}</span>
      ),
    },
    {
      key: 'conf',
      header: 'Conf',
      className: 'w-14 text-center',
      render: (r) => (
        <span className={`text-xs font-medium capitalize ${confidenceColors[r.confidence]}`}>
          {r.confidence}
        </span>
      ),
    },
  ];

  const isLoading = bsLoading || fxLoading;
  const error = bsError || fxError;

  if (isLoading && !bootstrap) return <DashboardSkeleton />;
  if (error) {
    return (
      <ErrorState message={error.message} onRetry={() => { bsRefetch(); fxRefetch(); }} />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Player Predictions</h1>
        <p className="text-sm text-fpl-muted">
          {targetGw ? `${targetGw.name} predicted points` : 'Predicted points'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          {([
            { key: 'all' as PosFilter, label: 'All' },
            { key: 1 as PosFilter, label: 'GK' },
            { key: 2 as PosFilter, label: 'DEF' },
            { key: 3 as PosFilter, label: 'MID' },
            { key: 4 as PosFilter, label: 'FWD' },
          ]).map((f) => (
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
        <input
          type="text"
          placeholder="Search player or team..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-fpl-border bg-fpl-card px-3 py-1.5 text-sm text-foreground placeholder:text-fpl-muted"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Predictions</CardTitle>
            <Badge variant="green">{predictions.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {predictions.length > 0 ? (
            <DataTable columns={columns} data={predictions} keyExtractor={(r) => r.player.id} />
          ) : (
            <p className="py-4 text-center text-sm text-fpl-muted">No players match filters.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
