"use client";

import { useMemo, useState } from "react";
import { useManagerContext } from "@/lib/fpl/manager-context";
import {
  useBootstrapStatic,
  useFixtures,
  useManagerPicks,
  usePendingPicks,
  useLiveGameweek,
  useManagerHistory,
} from "@/lib/fpl/hooks/use-fpl";
import { buildPlayerMap, buildTeamMap, enrichPlayers } from "@/lib/fpl/utils";
import { predictPoints } from "@/lib/fpl/points-model";
import { calculateSquadValue, buildValueHistory } from "@/lib/fpl/squad-value";
import { ConnectPrompt } from "@/components/leagues/connect-prompt";
import { PitchSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { TeamHeader } from "@/components/team/team-header";
import { PitchView } from "@/components/team/pitch-view";
import { GameweekSummary } from "@/components/team/gameweek-summary";
import { GameweekNav } from "@/components/team/gameweek-nav";
import { SquadValueCard } from "@/components/team/squad-value";
import { AskAiButton } from "@/components/chat";

export default function TeamPage() {
  const { managerId, manager } = useManagerContext();

  const [selectedGw, setSelectedGw] = useState(manager?.current_event ?? 0);
  const [trackedManagerId, setTrackedManagerId] = useState(manager?.id);
  const [showValue, setShowValue] = useState(false);

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

  const nextGwId = bootstrap?.events.find((e) => e.is_next)?.id;
  const isPendingView = nextGwId !== undefined && selectedGw === nextGwId;

  const gwId = selectedGw;

  const {
    data: picksData,
    isLoading: picksLoading,
    error: picksError,
    refetch: picksRefetch,
  } = useManagerPicks(
    managerId,
    isPendingView ? (manager?.current_event ?? 0) : gwId,
  );

  const {
    data: liveData,
    isLoading: liveLoading,
    error: liveError,
    refetch: liveRefetch,
  } = useLiveGameweek(gwId);

  const { data: historyData } = useManagerHistory(managerId);
  const { data: fixturesData } = useFixtures();

  const {
    data: pendingPicksData,
    isLoading: pendingPicksLoading,
    error: pendingPicksError,
  } = usePendingPicks(isPendingView ? managerId : null);

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

  // Predicted points for the next GW — same model as GW Planner for consistency.
  // Captain's points are doubled. Round: 0.6+ rounds up, 0.5 and below rounds down.
  const predictedPointsMap = useMemo(() => {
    if (!isPendingView || !bootstrap || !fixturesData || !nextGwId) return null;
    const enriched = enrichPlayers(bootstrap);
    const predictions = predictPoints(enriched, fixturesData, nextGwId);
    const map = new Map<number, number>();
    for (const pred of predictions) {
      if (pred.predictedPoints > 0)
        map.set(pred.player.id, Math.floor(pred.predictedPoints + 0.4));
    }
    // Double the captain's predicted points (pending picks take priority)
    const activePicks = pendingPicksData?.picks ?? picksData?.picks;
    const captainPick = activePicks?.find((p) => p.is_captain);
    if (captainPick) {
      const pts = map.get(captainPick.element);
      if (pts !== undefined) map.set(captainPick.element, pts * 2);
    }
    return map;
  }, [
    isPendingView,
    bootstrap,
    fixturesData,
    nextGwId,
    pendingPicksData,
    picksData,
  ]);

  // Predicted total score for the pending GW — sum starters' predicted pts (captain already doubled)
  const predictedTeamScore = useMemo(() => {
    if (!predictedPointsMap) return null;
    const starters = (pendingPicksData?.picks ?? picksData?.picks)?.filter(
      (p) => p.position <= 11,
    );
    if (!starters) return null;
    return starters.reduce(
      (sum, p) => sum + (predictedPointsMap.get(p.element) ?? 0),
      0,
    );
  }, [predictedPointsMap, pendingPicksData, picksData]);

  const gameweekName = useMemo(() => {
    if (!bootstrap || !gwId) return "";
    if (isPendingView && nextGwId) return `GW${nextGwId} Pending`;
    const gw = bootstrap.events.find((e) => e.id === gwId);
    return gw?.name ?? `Gameweek ${gwId}`;
  }, [bootstrap, gwId, isPendingView, nextGwId]);

  // Squad value calculation
  const squadValueSummary = useMemo(() => {
    if (!picksData?.picks || !bootstrap || !picksData.entry_history)
      return null;
    return calculateSquadValue(
      picksData.picks,
      bootstrap.elements,
      bootstrap.teams,
      picksData.entry_history,
    );
  }, [picksData, bootstrap]);

  const historyCurrentData = historyData?.current;
  const valueHistory = useMemo(() => {
    if (!historyCurrentData) return [];
    return buildValueHistory(historyCurrentData);
  }, [historyCurrentData]);

  const hasPrev = !!manager && selectedGw > manager.started_event;
  const hasNext = !!manager && selectedGw < (nextGwId ?? manager.current_event);

  // Guard: require manager connection
  if (!manager) {
    return <ConnectPrompt />;
  }

  const isLoading =
    bsLoading || (isPendingView ? picksLoading : picksLoading || liveLoading);
  const error = bsError || (isPendingView ? null : picksError || liveError);

  if (isLoading && !picksData) {
    return <PitchSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message}
        context="manager"
        onRetry={() => {
          bsRefetch();
          picksRefetch();
          liveRefetch();
        }}
      />
    );
  }

  if (isPendingView) {
    const isAuthError =
      pendingPicksError !== null && pendingPicksError.message.includes("401");

    const isNonAuthError = pendingPicksError !== null && !isAuthError;

    // Use authenticated pending picks if available; fall back to current GW picks on auth error
    const activePicks =
      pendingPicksData?.picks ?? (isAuthError ? picksData?.picks : null);

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <TeamHeader manager={manager} entryHistory={null} />
        </div>
        <GameweekNav
          gameweekName={gameweekName}
          onPrev={() => setSelectedGw((gw) => gw - 1)}
          onNext={() => setSelectedGw((gw) => gw + 1)}
          hasPrev={hasPrev}
          hasNext={hasNext}
        />
        {predictedTeamScore !== null && (
          <div className="flex items-center gap-2 rounded-lg border border-fpl-border bg-fpl-card px-4 py-3">
            <span className="text-sm text-fpl-muted">Predicted Score</span>
            <span className="ml-auto text-2xl font-bold text-fpl-green">
              {predictedTeamScore}
            </span>
          </div>
        )}
        {isNonAuthError ? (
          <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center">
            <p className="text-sm text-fpl-muted">
              Unable to load pending squad. Please try again.
            </p>
          </div>
        ) : activePicks ? (
          <>
            {isAuthError && (
              <p className="text-center text-xs text-fpl-muted">
                Showing current squad · Connect your FPL account in Settings to
                see pending transfers.
              </p>
            )}
            <PitchView
              picks={activePicks}
              playerMap={playerMap}
              teamMap={teamMap}
              livePointsMap={predictedPointsMap}
              autoSubs={[]}
            />
          </>
        ) : isAuthError ? (
          <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center">
            <p className="text-sm text-fpl-muted">
              Connect your FPL account in Settings to see pending transfers.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center">
            <p className="mt-2 text-sm text-fpl-muted">
              No pending squad data available.
            </p>
          </div>
        )}
      </div>
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
      <div className="flex items-start justify-between">
        <TeamHeader manager={manager} entryHistory={picksData.entry_history} />
        <AskAiButton
          question="Analyze my team and suggest improvements"
          label="Analyze my team"
          tooltip="Get AI analysis of your current squad"
          autoSubmit
        />
      </div>

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

      {/* Toggle between Pitch and Value view */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowValue(false)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !showValue
              ? "bg-fpl-green/20 text-fpl-green"
              : "bg-fpl-card text-fpl-muted hover:text-foreground"
          }`}
        >
          Pitch View
        </button>
        <button
          onClick={() => setShowValue(true)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            showValue
              ? "bg-fpl-green/20 text-fpl-green"
              : "bg-fpl-card text-fpl-muted hover:text-foreground"
          }`}
        >
          Squad Value
        </button>
      </div>

      {!showValue ? (
        <PitchView
          picks={picksData.picks}
          playerMap={playerMap}
          teamMap={teamMap}
          livePointsMap={livePointsMap}
          autoSubs={picksData.automatic_subs}
        />
      ) : (
        squadValueSummary && (
          <SquadValueCard summary={squadValueSummary} history={valueHistory} />
        )
      )}
    </div>
  );
}
