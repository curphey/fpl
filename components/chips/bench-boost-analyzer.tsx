"use client";

import { memo, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  useBootstrapStatic,
  useFixtures,
  useManagerHistory,
  useManagerPicks,
} from "@/lib/fpl/hooks/use-fpl";
import { useManagerContext } from "@/lib/fpl/manager-context";
import { getCurrentGameweek, enrichPlayers } from "@/lib/fpl/utils";
import {
  analyzeBenchBoost,
  getFDRColorClass,
  getFDRBgClass,
  type BenchBoostRecommendation,
  type BenchPerformanceHistory,
} from "@/lib/fpl/bench-boost-model";

const RecommendationCard = memo(function RecommendationCard({
  rec,
  rank,
}: {
  rec: BenchBoostRecommendation;
  rank: number;
}) {
  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              rank === 1
                ? "bg-fpl-green/20 text-fpl-green"
                : "bg-fpl-purple-light text-fpl-muted"
            }`}
          >
            {rank}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Gameweek {rec.gameweek}</span>
              {rec.isDGW && (
                <Badge variant="green" className="text-[10px]">
                  DGW
                </Badge>
              )}
              <Badge
                variant={
                  rec.confidence === "high"
                    ? "green"
                    : rec.confidence === "medium"
                      ? "default"
                      : "pink"
                }
              >
                {rec.confidence}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-fpl-muted">
              Avg FDR:{" "}
              <span className={getFDRColorClass(rec.avgBenchFDR)}>
                {rec.avgBenchFDR}
              </span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-fpl-green">{rec.score}</p>
          <p className="text-xs text-fpl-muted">Score</p>
        </div>
      </div>
      {rec.reasons.length > 0 && (
        <div className="mt-3 space-y-1">
          {rec.reasons.map((reason, i) => (
            <p key={i} className="text-xs text-fpl-muted">
              • {reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
});

const HistoryRow = memo(function HistoryRow({
  item,
  isHighlight,
}: {
  item: BenchPerformanceHistory;
  isHighlight: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 border-b border-fpl-border last:border-0 ${
        isHighlight ? "bg-fpl-green/5" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">GW{item.gameweek}</span>
        {item.benchBoostUsed && (
          <Badge variant="green" className="text-[10px]">
            BB Used
          </Badge>
        )}
        {item.missedOpportunity && (
          <Badge variant="pink" className="text-[10px]">
            Missed
          </Badge>
        )}
      </div>
      <span
        className={`text-sm font-semibold ${
          item.pointsOnBench >= 15
            ? "text-fpl-green"
            : item.pointsOnBench >= 8
              ? "text-foreground"
              : "text-fpl-muted"
        }`}
      >
        {item.pointsOnBench} pts
      </span>
    </div>
  );
});

export function BenchBoostAnalyzer() {
  const { data: bootstrap, isLoading: bsLoading } = useBootstrapStatic();
  const { data: fixtures, isLoading: fxLoading } = useFixtures();
  const { managerId } = useManagerContext();
  const { data: managerHistory } = useManagerHistory(managerId);

  const currentGW = bootstrap
    ? (getCurrentGameweek(bootstrap.events)?.id ?? 1)
    : 1;

  const { data: picks } = useManagerPicks(managerId, currentGW);

  const benchPlayers = useMemo(() => {
    if (!bootstrap || !picks) return [];
    const enriched = enrichPlayers(bootstrap);
    // Bench is positions 12-15
    const benchPicks = picks.picks.filter((p) => p.position >= 12);
    return benchPicks
      .map((p) => enriched.find((e) => e.id === p.element))
      .filter(Boolean) as typeof enriched;
  }, [bootstrap, picks]);

  const analysis = useMemo(() => {
    if (!bootstrap || !fixtures) return null;
    return analyzeBenchBoost(
      managerHistory ?? null,
      fixtures,
      bootstrap.events,
      bootstrap.teams,
      benchPlayers,
      currentGW,
    );
  }, [bootstrap, fixtures, managerHistory, benchPlayers, currentGW]);

  const isLoading = bsLoading || fxLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="h-4 w-20 bg-fpl-purple-light rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-fpl-purple-light rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-fpl-muted">Unable to load bench boost analysis</p>
        </CardContent>
      </Card>
    );
  }

  const topRecommendations = analysis.recommendations.slice(0, 3);
  const sortedHistory = [...analysis.history].sort(
    (a, b) => b.pointsOnBench - a.pointsOnBench,
  );
  const topHistoryWeeks = sortedHistory.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Bench Points"
          value={analysis.totalBenchPoints}
          subvalue="Points left on bench"
        />
        <StatCard
          label="Avg Per GW"
          value={analysis.avgBenchPoints}
          subvalue="Bench points average"
        />
        <StatCard
          label="Best Week"
          value={analysis.bestHistoricalGW?.pointsOnBench ?? 0}
          subvalue={
            analysis.bestHistoricalGW
              ? `GW${analysis.bestHistoricalGW.gameweek}`
              : "N/A"
          }
        />
        <StatCard
          label="Chip Status"
          value={analysis.benchBoostUsed ? "Used" : "Available"}
          subvalue={
            analysis.benchBoostGW
              ? `Used in GW${analysis.benchBoostGW}`
              : "Ready to deploy"
          }
        />
      </div>

      {/* Recommendations */}
      {!analysis.benchBoostUsed && topRecommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bench Boost Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {topRecommendations.map((rec, i) => (
                <RecommendationCard key={rec.gameweek} rec={rec} rank={i + 1} />
              ))}
            </div>
            {analysis.recommendations.some((r) => r.isDGW) && (
              <p className="mt-4 text-xs text-fpl-muted">
                💡 Double Gameweeks (DGW) are historically the best time to use
                Bench Boost due to extra fixtures.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Bench */}
      {benchPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Bench</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {benchPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-lg bg-fpl-purple-light p-3"
                >
                  <div>
                    <p className="font-medium">{player.web_name}</p>
                    <p className="text-xs text-fpl-muted">
                      {player.team_short_name} • {player.position_short}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-fpl-green">
                      {player.form}
                    </p>
                    <p className="text-xs text-fpl-muted">form</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Performance */}
      {analysis.history.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Best Bench Weeks</CardTitle>
              {analysis.missedOpportunityScore > 0 && (
                <Badge variant="pink">
                  {analysis.missedOpportunityScore} pts missed
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {topHistoryWeeks.map((item) => (
                <HistoryRow
                  key={item.gameweek}
                  item={item}
                  isHighlight={
                    item.gameweek === analysis.bestHistoricalGW?.gameweek
                  }
                />
              ))}
            </div>
            {!managerId && (
              <p className="mt-4 text-xs text-fpl-muted text-center">
                Connect your FPL account to see your bench history
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
