"use client";

import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PositionBadge } from "@/components/ui/badge";
import { analyzeKeeperOptions } from "@/lib/fpl/draft-model";
import type {
  DraftPlayer,
  KeeperAnalysis,
  KeeperRecommendation,
} from "@/lib/fpl/draft-types";

interface KeeperAnalysisSectionProps {
  players: DraftPlayer[];
}

const RECOMMENDATION_CONFIG: Record<
  KeeperRecommendation,
  {
    label: string;
    variant: "green" | "default" | "pink" | "danger";
    description: string;
  }
> = {
  "must-keep": {
    label: "Must Keep",
    variant: "green",
    description: "Cornerstone player, top tier value",
  },
  keep: {
    label: "Keep",
    variant: "default",
    description: "Strong asset worth retaining",
  },
  consider: {
    label: "Consider",
    variant: "pink",
    description: "Weigh against alternatives",
  },
  drop: {
    label: "Drop",
    variant: "danger",
    description: "Better options likely available",
  },
};

const ScoreBar = memo(function ScoreBar({
  label,
  value,
  maxValue = 25,
}: {
  label: string;
  value: number;
  maxValue?: number;
}) {
  const pct = Math.min((value / maxValue) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-fpl-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-fpl-green"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-medium">
        {value.toFixed(1)}
      </span>
    </div>
  );
});

const KeeperCard = memo(function KeeperCard({
  analysis,
  isSelected,
  onSelect,
}: {
  analysis: KeeperAnalysis;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { player, keeperScore, recommendation, reasoning, factors } = analysis;
  const config = RECOMMENDATION_CONFIG[recommendation];

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-4 transition-all ${
        isSelected
          ? "border-fpl-purple bg-fpl-purple/10"
          : "border-fpl-border bg-fpl-card hover:bg-fpl-card-hover"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              keeperScore >= 75
                ? "bg-fpl-green/20 text-fpl-green"
                : keeperScore >= 55
                  ? "bg-blue-500/20 text-blue-400"
                  : keeperScore >= 35
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-red-500/20 text-red-400"
            }`}
          >
            <span className="text-sm font-bold">{keeperScore}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{player.name}</span>
              <PositionBadge
                position={player.positionId}
                label={player.position}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-fpl-muted mt-0.5">
              <span>{player.team}</span>
              <span>|</span>
              <span>ADP: {player.estimatedADP}</span>
              <span>|</span>
              <span>{player.totalPoints} pts</span>
            </div>
          </div>
        </div>
        <Badge variant={config.variant}>{config.label}</Badge>
      </div>

      {isSelected && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-sm text-fpl-muted mb-4">{reasoning}</p>

          <div className="space-y-2">
            <ScoreBar label="Consistency" value={factors.consistency} />
            <ScoreBar label="Upside" value={factors.upside} />
            <ScoreBar label="Position Value" value={factors.positionValue} />
            <ScoreBar label="Trajectory" value={factors.trajectory} />
          </div>
        </div>
      )}
    </button>
  );
});

export const KeeperAnalysisSection = memo(function KeeperAnalysisSection({
  players,
}: KeeperAnalysisSectionProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<Set<number>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRecommendation, setFilterRecommendation] = useState<
    KeeperRecommendation | "ALL"
  >("ALL");

  // Analyze all players
  const analyses = useMemo(() => analyzeKeeperOptions(players), [players]);

  // Filter analyses
  const filtered = useMemo(() => {
    let result = analyses;

    if (filterRecommendation !== "ALL") {
      result = result.filter((a) => a.recommendation === filterRecommendation);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.player.name.toLowerCase().includes(query) ||
          a.player.team.toLowerCase().includes(query),
      );
    }

    return result;
  }, [analyses, filterRecommendation, searchQuery]);

  const handleToggleSelect = (playerId: number) => {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  // Get selected analyses for comparison
  const selectedAnalyses = useMemo(
    () => analyses.filter((a) => selectedPlayers.has(a.player.id)),
    [analyses, selectedPlayers],
  );

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-fpl-muted">
            Analyze players for keeper league value. Select players to compare
            their keeper scores and decide who to retain between seasons.
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search players or teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
              />
            </div>

            {/* Recommendation Filter */}
            <div className="flex gap-1">
              {(["ALL", "must-keep", "keep", "consider", "drop"] as const).map(
                (rec) => (
                  <button
                    key={rec}
                    onClick={() => setFilterRecommendation(rec)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      filterRecommendation === rec
                        ? "bg-fpl-purple text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {rec === "ALL" ? "All" : RECOMMENDATION_CONFIG[rec].label}
                  </button>
                ),
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Player List */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-fpl-muted">
            Players ({filtered.length})
          </h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {filtered.slice(0, 50).map((analysis) => (
              <KeeperCard
                key={analysis.player.id}
                analysis={analysis}
                isSelected={selectedPlayers.has(analysis.player.id)}
                onSelect={() => handleToggleSelect(analysis.player.id)}
              />
            ))}
            {filtered.length > 50 && (
              <p className="text-xs text-fpl-muted text-center py-2">
                Showing top 50 players. Use search to find specific players.
              </p>
            )}
          </div>
        </div>

        {/* Comparison Panel */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-fpl-muted">
            Comparison ({selectedAnalyses.length} selected)
          </h3>

          {selectedAnalyses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-fpl-muted">
                  Click on players to select them for comparison
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-4">
                {/* Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="px-2 py-2 text-left text-xs font-medium text-fpl-muted">
                          Player
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-fpl-muted">
                          Score
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-fpl-muted">
                          Rec
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-fpl-muted">
                          Cons
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-fpl-muted">
                          Up
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-fpl-muted">
                          Pos
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-fpl-muted">
                          Traj
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAnalyses.map((analysis) => {
                        const config =
                          RECOMMENDATION_CONFIG[analysis.recommendation];
                        return (
                          <tr
                            key={analysis.player.id}
                            className="border-b border-gray-800/50"
                          >
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <PositionBadge
                                  position={analysis.player.positionId}
                                  label={analysis.player.position}
                                />
                                <span className="font-medium">
                                  {analysis.player.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <span
                                className={`font-bold ${
                                  analysis.keeperScore >= 75
                                    ? "text-fpl-green"
                                    : analysis.keeperScore >= 55
                                      ? "text-blue-400"
                                      : analysis.keeperScore >= 35
                                        ? "text-yellow-400"
                                        : "text-red-400"
                                }`}
                              >
                                {analysis.keeperScore}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Badge variant={config.variant}>
                                {config.label}
                              </Badge>
                            </td>
                            <td className="px-2 py-2 text-center text-fpl-muted">
                              {analysis.factors.consistency.toFixed(1)}
                            </td>
                            <td className="px-2 py-2 text-center text-fpl-muted">
                              {analysis.factors.upside.toFixed(1)}
                            </td>
                            <td className="px-2 py-2 text-center text-fpl-muted">
                              {analysis.factors.positionValue.toFixed(1)}
                            </td>
                            <td className="px-2 py-2 text-center text-fpl-muted">
                              {analysis.factors.trajectory.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Clear Button */}
                <button
                  onClick={() => setSelectedPlayers(new Set())}
                  className="mt-4 w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Clear Selection
                </button>
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Keeper Score Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {(
                  Object.entries(RECOMMENDATION_CONFIG) as [
                    KeeperRecommendation,
                    (typeof RECOMMENDATION_CONFIG)[KeeperRecommendation],
                  ][]
                ).map(([rec, config]) => (
                  <div key={rec} className="flex items-center justify-between">
                    <Badge variant={config.variant}>{config.label}</Badge>
                    <span className="text-fpl-muted text-xs">
                      {config.description}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-800">
                <h4 className="text-xs font-medium mb-2">Score Factors</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-fpl-muted">
                  <div>
                    <span className="font-medium text-white">Consistency</span>:
                    Season-long production
                  </div>
                  <div>
                    <span className="font-medium text-white">Upside</span>:
                    Ceiling potential
                  </div>
                  <div>
                    <span className="font-medium text-white">Position</span>:
                    Positional scarcity
                  </div>
                  <div>
                    <span className="font-medium text-white">Trajectory</span>:
                    Form vs avg
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
});
