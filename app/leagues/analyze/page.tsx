"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useManagerContext } from "@/lib/fpl/manager-context";
import {
  useLeagueAnalysis,
  type RivalCount,
} from "@/lib/fpl/hooks/use-league-analysis";
import { ConnectPrompt } from "@/components/leagues/connect-prompt";
import { LeagueStandingsSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { AnalyzerHeader } from "@/components/league-analyzer/analyzer-header";
import { AnalyzerStats } from "@/components/league-analyzer/analyzer-stats";
import {
  AnalyzerTabs,
  type AnalyzerTab,
} from "@/components/league-analyzer/analyzer-tabs";
import { EffectiveOwnershipTable } from "@/components/league-analyzer/effective-ownership-table";
import { DifferentialsView } from "@/components/league-analyzer/differentials-view";
import { RivalComparisonView } from "@/components/league-analyzer/rival-comparison";
import { SwingScenariosTable } from "@/components/league-analyzer/swing-scenarios";
import { RivalChipsSection } from "@/components/leagues/rival-chips";

export default function AnalyzePage() {
  return (
    <Suspense fallback={<LeagueStandingsSkeleton />}>
      <AnalyzeContent />
    </Suspense>
  );
}

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const leagueId = Number(searchParams.get("league")) || null;
  const { manager } = useManagerContext();

  const [rivalCount, setRivalCount] = useState<RivalCount>(10);
  const [activeTab, setActiveTab] = useState<AnalyzerTab>("eo");

  const {
    isInitialLoading,
    isRivalPicksLoading,
    isChipsLoading,
    error,
    refetch,
    rivalPicksProgress,
    leagueName,
    analysis,
    chipAnalysis,
  } = useLeagueAnalysis(leagueId, rivalCount);

  // Guard: no manager connected
  if (!manager && !isInitialLoading) {
    return <ConnectPrompt />;
  }

  // Guard: no league specified
  if (!leagueId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-bold">No League Selected</h2>
          <p className="mt-1 text-sm text-fpl-muted">
            Go to the Leagues page and click &quot;Analyze&quot; on a league.
          </p>
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return <LeagueStandingsSkeleton />;
  }

  if (error) {
    return (
      <ErrorState message={error.message} context="league" onRetry={refetch} />
    );
  }

  return (
    <div className="space-y-6">
      <AnalyzerHeader
        leagueName={leagueName ?? "League"}
        userRank={analysis?.result.userRank ?? null}
        rivalCount={rivalCount}
        onRivalCountChange={setRivalCount}
        isLoading={isRivalPicksLoading}
        progress={rivalPicksProgress}
      />

      {analysis && (
        <>
          <AnalyzerStats
            userRank={analysis.result.userRank}
            uniquePlayers={analysis.result.uniquePlayerCount}
            eoCoverage={analysis.result.eoCoverage}
            gapToLeader={analysis.result.gapToLeader}
          />

          <AnalyzerTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "eo" && (
            <EffectiveOwnershipTable
              data={analysis.result.effectiveOwnership}
            />
          )}

          {activeTab === "differentials" && (
            <DifferentialsView
              attack={analysis.result.yourDifferentials}
              cover={analysis.result.theirDifferentials}
            />
          )}

          {activeTab === "rival" && (
            <RivalComparisonView
              userPicks={analysis.userPicks}
              rivals={analysis.rivals}
              playerMap={analysis.playerMap}
              teamMap={analysis.teamMap}
            />
          )}

          {activeTab === "swing" && (
            <SwingScenariosTable data={analysis.result.swingScenarios} />
          )}

          {activeTab === "chips" && chipAnalysis && (
            <RivalChipsSection analysis={chipAnalysis} />
          )}

          {activeTab === "chips" && !chipAnalysis && !isChipsLoading && (
            <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center text-sm text-fpl-muted">
              Loading rival chip data...
            </div>
          )}
        </>
      )}

      {!analysis && !isRivalPicksLoading && (
        <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center text-sm text-fpl-muted">
          Waiting for data to load...
        </div>
      )}
    </div>
  );
}
