"use client";

import { useState, useMemo } from "react";
import { useBootstrapStatic } from "@/lib/fpl/hooks/use-fpl";
import {
  enrichPlayers,
  getNextGameweek,
  getCurrentGameweek,
} from "@/lib/fpl/utils";
import type { PlayerPosition } from "@/lib/fpl/types";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  ExpectedPointsTable,
  type ExpectedPointsPlayer,
} from "@/components/expected-points/expected-points-table";

type PositionFilter = "all" | PlayerPosition;
type SortBy = "ep_next" | "differential" | "form" | "ownership";

const positionFilters: { key: PositionFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: 1, label: "GK" },
  { key: 2, label: "DEF" },
  { key: 3, label: "MID" },
  { key: 4, label: "FWD" },
];

const priceRanges = [
  { label: "All prices", min: 0, max: 20 },
  { label: "Budget (<6.0)", min: 0, max: 5.9 },
  { label: "Mid (6.0-9.0)", min: 6.0, max: 9.0 },
  { label: "Premium (>9.0)", min: 9.1, max: 20 },
];

const sortOptions: { key: SortBy; label: string }[] = [
  { key: "ep_next", label: "Expected Pts" },
  { key: "differential", label: "Differential" },
  { key: "form", label: "Form" },
  { key: "ownership", label: "Ownership" },
];

export default function ExpectedPointsPage() {
  const { data: bootstrap, isLoading, error, refetch } = useBootstrapStatic();

  const [posFilter, setPosFilter] = useState<PositionFilter>("all");
  const [priceIdx, setPriceIdx] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("ep_next");
  const [showDifferentialsOnly, setShowDifferentialsOnly] = useState(false);

  const nextGw = bootstrap ? getNextGameweek(bootstrap.events) : undefined;
  const currentGw = bootstrap
    ? getCurrentGameweek(bootstrap.events)
    : undefined;
  const gwLabel = nextGw?.name || currentGw?.name || "Gameweek";

  const enriched = useMemo(() => {
    if (!bootstrap) return [];
    return enrichPlayers(bootstrap);
  }, [bootstrap]);

  const processedPlayers = useMemo(() => {
    if (!enriched.length) return [];

    // Add expected points value and differential score
    const withEP: ExpectedPointsPlayer[] = enriched
      .map((p) => {
        const ep_next_value = parseFloat(p.ep_next || "0") || 0;
        const ownership = p.ownership_value || 0.1; // Avoid division by zero

        // Differential score: high EP, low ownership is good
        // Formula: (ep_next * 10) / (ownership + 5)
        // The +5 prevents extreme values for very low ownership
        const differential_score = (ep_next_value * 10) / (ownership + 5);

        return {
          ...p,
          ep_next_value,
          differential_score,
        };
      })
      .filter((p) => p.ep_next_value > 0); // Only show players with expected points

    return withEP;
  }, [enriched]);

  const filteredPlayers = useMemo(() => {
    let players = processedPlayers;

    // Position filter
    if (posFilter !== "all") {
      players = players.filter((p) => p.element_type === posFilter);
    }

    // Price filter
    const range = priceRanges[priceIdx];
    players = players.filter((p) => {
      const price = p.now_cost / 10;
      return price >= range.min && price <= range.max;
    });

    // Differentials only (<10% ownership)
    if (showDifferentialsOnly) {
      players = players.filter((p) => p.ownership_value < 10);
    }

    // Sort
    players = [...players].sort((a, b) => {
      switch (sortBy) {
        case "ep_next":
          return b.ep_next_value - a.ep_next_value;
        case "differential":
          return b.differential_score - a.differential_score;
        case "form":
          return b.form_value - a.form_value;
        case "ownership":
          return b.ownership_value - a.ownership_value;
        default:
          return b.ep_next_value - a.ep_next_value;
      }
    });

    return players.slice(0, 50);
  }, [processedPlayers, posFilter, priceIdx, sortBy, showDifferentialsOnly]);

  // Stats for the header
  const stats = useMemo(() => {
    if (!processedPlayers.length) return null;

    const topPlayer = [...processedPlayers].sort(
      (a, b) => b.ep_next_value - a.ep_next_value,
    )[0];

    const topDifferential = [...processedPlayers]
      .filter((p) => p.ownership_value < 15)
      .sort((a, b) => b.differential_score - a.differential_score)[0];

    const avgEP =
      processedPlayers.reduce((sum, p) => sum + p.ep_next_value, 0) /
      processedPlayers.length;

    return {
      topPlayer,
      topDifferential,
      avgEP,
    };
  }, [processedPlayers]);

  if (isLoading && !bootstrap) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Expected Points</h1>
        <p className="text-sm text-fpl-muted">
          Players ranked by predicted points for {gwLabel}
        </p>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Top Pick"
            value={stats.topPlayer.web_name}
            subvalue={`${stats.topPlayer.ep_next_value.toFixed(1)} xPts • ${stats.topPlayer.ownership_value.toFixed(1)}% owned`}
          />
          <StatCard
            label="Top Differential"
            value={stats.topDifferential?.web_name || "-"}
            subvalue={
              stats.topDifferential
                ? `${stats.topDifferential.ep_next_value.toFixed(1)} xPts • ${stats.topDifferential.ownership_value.toFixed(1)}% owned`
                : "No differentials"
            }
          />
          <StatCard
            label="Avg Expected Pts"
            value={stats.avgEP.toFixed(2)}
            subvalue="Across all players"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          {positionFilters.map((f) => (
            <button
              key={String(f.key)}
              onClick={() => setPosFilter(f.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                posFilter === f.key
                  ? "bg-fpl-green/20 text-fpl-green"
                  : "bg-fpl-card text-fpl-muted hover:text-foreground"
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
                  ? "bg-fpl-green/20 text-fpl-green"
                  : "bg-fpl-card text-fpl-muted hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowDifferentialsOnly((d) => !d)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            showDifferentialsOnly
              ? "bg-fpl-pink/20 text-fpl-pink"
              : "bg-fpl-card text-fpl-muted hover:text-foreground"
          }`}
        >
          Differentials only (&lt;10%)
        </button>
      </div>

      {/* Sort Options */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-fpl-muted">Sort by:</span>
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              sortBy === opt.key
                ? "bg-fpl-cyan/20 text-fpl-cyan"
                : "bg-fpl-card text-fpl-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Expected Points Leaderboard</CardTitle>
            <Badge variant="green">{filteredPlayers.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPlayers.length > 0 ? (
            <ExpectedPointsTable
              players={filteredPlayers}
              showDifferentialBadge={sortBy !== "differential"}
            />
          ) : (
            <p className="py-4 text-center text-sm text-fpl-muted">
              No players match the current filters.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Explainer */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="mb-2 text-sm font-semibold">
            Understanding Expected Points
          </h3>
          <div className="space-y-2 text-xs text-fpl-muted">
            <p>
              <strong className="text-foreground">
                xPts (Expected Points)
              </strong>{" "}
              - The FPL predicted points for the next gameweek based on
              fixtures, form, and historical performance.
            </p>
            <p>
              <strong className="text-fpl-pink">HOT</strong> - High expected
              points with low ownership. Great differential potential.
            </p>
            <p>
              <strong className="text-fpl-cyan">DIFF</strong> - Good expected
              points below 10% ownership. Could be a smart punt.
            </p>
            <p>
              <strong className="text-foreground">Differential Score</strong> -
              Calculated as (xPts × 10) / (Ownership + 5). Higher = better value
              differential.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
