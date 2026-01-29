"use client";

import type { ChipTimingAnalysis } from "@/lib/fpl/chip-model";
import { Badge } from "@/components/ui/badge";

const chipIcons: Record<string, string> = {
  wildcard: "WC",
  freehit: "FH",
  "3xc": "TC",
  bboost: "BB",
};

function scoreColor(score: number): string {
  if (score >= 60) return "bg-fpl-green";
  if (score >= 40) return "bg-yellow-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-fpl-muted";
}

function recommendationBadge(rec: "play_now" | "wait" | "neutral") {
  if (rec === "play_now") {
    return <Badge variant="green">Play Now</Badge>;
  }
  if (rec === "wait") {
    return <Badge variant="pink">Wait</Badge>;
  }
  return <Badge variant="default">Flexible</Badge>;
}

export function ChipTimingGrid({
  analyses,
}: {
  analyses: ChipTimingAnalysis[];
}) {
  if (analyses.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-fpl-muted">
        No chip timing data available
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {analyses.map((analysis) => (
        <div
          key={analysis.chip}
          className="rounded-lg border border-fpl-border bg-fpl-card p-4"
        >
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-fpl-purple-light text-sm font-bold text-fpl-green">
                {chipIcons[analysis.chip] ?? "?"}
              </span>
              <div>
                <h3 className="font-semibold">{analysis.label}</h3>
                <p className="text-sm text-fpl-muted">{analysis.summary}</p>
              </div>
            </div>
            {recommendationBadge(analysis.recommendation)}
          </div>

          {/* GW Score Timeline */}
          <div className="mb-3 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {analysis.gwScores.map((gwScore, idx) => {
                const isBest = gwScore.gw === analysis.bestGw;
                const isCurrent = idx === 0;

                return (
                  <div
                    key={gwScore.gw}
                    className={`flex flex-col items-center rounded-lg p-2 ${
                      isBest ? "ring-2 ring-fpl-green" : ""
                    } ${isCurrent ? "bg-fpl-purple-light" : "bg-fpl-border/30"}`}
                    title={gwScore.reasoning}
                  >
                    <span className="text-xs text-fpl-muted">
                      GW{gwScore.gw}
                    </span>
                    <div
                      className={`mt-1 flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white ${scoreColor(gwScore.score)}`}
                    >
                      {gwScore.score}
                    </div>
                    {isBest && (
                      <span className="mt-1 text-[10px] font-medium text-fpl-green">
                        Best
                      </span>
                    )}
                    {isCurrent && !isBest && (
                      <span className="mt-1 text-[10px] text-fpl-muted">
                        Now
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Best GW reasoning */}
          {analysis.bestGw && (
            <div className="rounded-md bg-fpl-purple-light px-3 py-2">
              <p className="text-xs">
                <span className="font-medium text-fpl-green">
                  Best: GW{analysis.bestGw}
                </span>
                <span className="mx-2 text-fpl-muted">•</span>
                <span className="text-fpl-muted">
                  {
                    analysis.gwScores.find((s) => s.gw === analysis.bestGw)
                      ?.reasoning
                  }
                </span>
              </p>
            </div>
          )}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-fpl-muted">
        <span>Score Legend:</span>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-fpl-green" />
          <span>60+ Excellent</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-yellow-500" />
          <span>40-59 Good</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-orange-500" />
          <span>25-39 Fair</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-fpl-muted" />
          <span>&lt;25 Poor</span>
        </div>
      </div>
    </div>
  );
}
