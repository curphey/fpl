"use client";

import type {
  ChipHistoryAnalysis,
  ChipPerformance,
} from "@/lib/fpl/chip-history";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function VerdictBadge({ verdict }: { verdict: ChipPerformance["verdict"] }) {
  const variants: Record<
    ChipPerformance["verdict"],
    { variant: "green" | "default" | "destructive"; label: string }
  > = {
    excellent: { variant: "green", label: "Excellent" },
    good: { variant: "green", label: "Good" },
    average: { variant: "default", label: "Average" },
    poor: { variant: "destructive", label: "Poor" },
  };
  const v = variants[verdict];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

function ChipPerformanceCard({
  performance,
}: {
  performance: ChipPerformance;
}) {
  const {
    chipLabel,
    gwPlayed,
    pointsScored,
    pointsGained,
    verdict,
    reasoning,
    benchPointsThatGw,
    chipName,
  } = performance;

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{chipLabel}</span>
            <VerdictBadge verdict={verdict} />
          </div>
          <span className="text-sm text-fpl-muted">GW{gwPlayed}</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{pointsScored}</div>
          <div className="text-xs text-fpl-muted">points</div>
        </div>
      </div>

      <div className="mt-3 text-sm text-foreground/80">{reasoning}</div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <div>
          <span className="text-fpl-muted">vs your avg: </span>
          <span
            className={pointsGained >= 0 ? "text-fpl-green" : "text-fpl-danger"}
          >
            {pointsGained >= 0 ? "+" : ""}
            {pointsGained}
          </span>
        </div>
        {chipName === "bboost" && (
          <div>
            <span className="text-fpl-muted">Bench pts: </span>
            <span>{benchPointsThatGw}</span>
          </div>
        )}
        {performance.pointsAboveAvg !== null && (
          <div>
            <span className="text-fpl-muted">vs league: </span>
            <span
              className={
                performance.pointsAboveAvg >= 0
                  ? "text-fpl-green"
                  : "text-fpl-danger"
              }
            >
              {performance.pointsAboveAvg >= 0 ? "+" : ""}
              {performance.pointsAboveAvg}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChipHistorySection({
  analysis,
}: {
  analysis: ChipHistoryAnalysis;
}) {
  const {
    usedChips,
    unusedChips,
    totalChipROI,
    bestChip,
    worstChip,
    missedOpportunities,
    summary,
  } = analysis;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Chip Performance Summary</CardTitle>
          <p className="text-xs text-fpl-muted">{summary}</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Total ROI */}
            <div className="rounded-lg border border-fpl-border bg-fpl-purple-light p-4 text-center">
              <div
                className={`text-3xl font-bold ${totalChipROI >= 0 ? "text-fpl-green" : "text-fpl-danger"}`}
              >
                {totalChipROI >= 0 ? "+" : ""}
                {totalChipROI}
              </div>
              <div className="text-xs text-fpl-muted">
                Total pts above average
              </div>
            </div>

            {/* Best Chip */}
            {bestChip && (
              <div className="rounded-lg border border-fpl-green/30 bg-fpl-green/5 p-4 text-center">
                <div className="text-sm font-medium text-fpl-green">
                  Best Chip
                </div>
                <div className="mt-1 text-lg font-bold">
                  {bestChip.chipLabel}
                </div>
                <div className="text-xs text-fpl-muted">
                  GW{bestChip.gwPlayed} • +{bestChip.pointsGained} pts
                </div>
              </div>
            )}

            {/* Worst Chip */}
            {worstChip && worstChip !== bestChip && (
              <div className="rounded-lg border border-fpl-danger/30 bg-fpl-danger/5 p-4 text-center">
                <div className="text-sm font-medium text-fpl-danger">
                  Needs Improvement
                </div>
                <div className="mt-1 text-lg font-bold">
                  {worstChip.chipLabel}
                </div>
                <div className="text-xs text-fpl-muted">
                  GW{worstChip.gwPlayed} • {worstChip.pointsGained} pts
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Used Chips Detail */}
      {usedChips.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Chip History</CardTitle>
              <Badge variant="default">{usedChips.length} used</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {usedChips.map((perf) => (
                <ChipPerformanceCard key={perf.chipName} performance={perf} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unused Chips */}
      {unusedChips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Chips Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unusedChips.map((chip) => (
                <div
                  key={chip}
                  className="rounded-lg border border-fpl-border bg-fpl-purple-light px-4 py-2"
                >
                  <span className="text-sm font-medium">
                    {chip === "wildcard"
                      ? "Wildcard"
                      : chip === "freehit"
                        ? "Free Hit"
                        : chip === "3xc"
                          ? "Triple Captain"
                          : "Bench Boost"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missed Opportunities */}
      {missedOpportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hindsight Analysis</CardTitle>
            <p className="text-xs text-fpl-muted">
              Potential chip opportunities you may have missed (for learning,
              not criticism!)
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {missedOpportunities.map((opp) => (
                <div
                  key={`${opp.chipName}-${opp.gwNumber}`}
                  className="flex items-center justify-between rounded-lg border border-fpl-border bg-fpl-card p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{opp.chipLabel}</span>
                      <Badge variant="default">GW{opp.gwNumber}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-fpl-muted">
                      {opp.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-yellow-400">
                      +{opp.potentialPoints}
                    </div>
                    <div className="text-xs text-fpl-muted">potential</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
