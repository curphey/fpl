'use client';

import { useMemo, useState } from 'react';
import { useManagerContext } from '@/lib/fpl/manager-context';
import { useBootstrapStatic, useManagerPicks, useLiveGameweek } from '@/lib/fpl/hooks/use-fpl';
import { buildPlayerMap, buildTeamMap } from '@/lib/fpl/utils';
import { ConnectPrompt } from '@/components/leagues/connect-prompt';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { TeamHeader } from '@/components/team/team-header';
import { PitchView } from '@/components/team/pitch-view';
import { GameweekSummary } from '@/components/team/gameweek-summary';
import { GameweekNav } from '@/components/team/gameweek-nav';

export default function TeamPage() {
  const { managerId, manager } = useManagerContext();

  const [selectedGw, setSelectedGw] = useState(manager?.current_event ?? 0);
  const [trackedManagerId, setTrackedManagerId] = useState(manager?.id);

  // Reset to current GW when manager changes (derived state during render)
  if (manager && manager.id !== trackedManagerId) {
    setTrackedManagerId(manager.id);
    setSelectedGw(manager.current_event);
  }

  const {
    data: bootstrap,
    isLoading: bsLoading,
    error: bsError,
    refetch: bsRefetch,
  } = useBootstrapStatic();

  const gwId = selectedGw;

  const {
    data: picksData,
    isLoading: picksLoading,
    error: picksError,
    refetch: picksRefetch,
  } = useManagerPicks(managerId, gwId);

  const {
    data: liveData,
    isLoading: liveLoading,
    error: liveError,
    refetch: liveRefetch,
  } = useLiveGameweek(gwId);

  const playerMap = useMemo(
    () => (bootstrap ? buildPlayerMap(bootstrap.elements) : new Map()),
    [bootstrap],
  );

  const teamMap = useMemo(
    () => (bootstrap ? buildTeamMap(bootstrap.teams) : new Map()),
    [bootstrap],
  );

  const livePointsMap = useMemo(() => {
    if (!liveData) return null;
    const map = new Map<number, number>();
    for (const el of liveData.elements) {
      map.set(el.id, el.stats.total_points);
    }
    return map;
  }, [liveData]);

  const gameweekName = useMemo(() => {
    if (!bootstrap || !gwId) return '';
    const gw = bootstrap.events.find((e) => e.id === gwId);
    return gw?.name ?? `Gameweek ${gwId}`;
  }, [bootstrap, gwId]);

  const hasPrev = !!manager && selectedGw > manager.started_event;
  const hasNext = !!manager && selectedGw < manager.current_event;

  // Guard: require manager connection
  if (!manager) {
    return <ConnectPrompt />;
  }

  const isLoading = bsLoading || picksLoading || liveLoading;
  const error = bsError || picksError || liveError;

  if (isLoading && !picksData) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={() => {
          bsRefetch();
          picksRefetch();
          liveRefetch();
        }}
      />
    );
  }

  if (!picksData) {
    return (
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center">
        <h1 className="text-xl font-bold">My Team</h1>
        <p className="mt-2 text-sm text-fpl-muted">
          No picks data available for this gameweek.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TeamHeader manager={manager} entryHistory={picksData.entry_history} />

      <GameweekNav
        gameweekName={gameweekName}
        onPrev={() => setSelectedGw((gw) => gw - 1)}
        onNext={() => setSelectedGw((gw) => gw + 1)}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />

      <GameweekSummary
        entryHistory={picksData.entry_history}
        activeChip={picksData.active_chip}
      />

      <PitchView
        picks={picksData.picks}
        playerMap={playerMap}
        teamMap={teamMap}
        livePointsMap={livePointsMap}
        autoSubs={picksData.automatic_subs}
      />
    </div>
  );
}
