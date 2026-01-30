"use client";

import { useState, useMemo, useCallback } from "react";
import { useBootstrapStatic, useFixtures } from "@/lib/fpl/hooks/use-fpl";
import {
  getNextGameweek,
  getCurrentGameweek,
  enrichPlayers,
  getPlayerDisplayName,
  getPlayerPrice,
} from "@/lib/fpl/utils";
import { predictPoints, type PointsPrediction } from "@/lib/fpl/points-model";
import {
  getTopSetPieceAssets,
  getSetPieceTakersByTeam,
} from "@/lib/fpl/set-piece-tracker";
import { usePlayerComparison } from "@/lib/fpl/hooks/use-player-comparison";
import type { PlayerPosition } from "@/lib/fpl/types";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, PositionBadge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SetPieceTakersSection } from "@/components/players/set-piece-takers";
import { PlayerCompareModal } from "@/components/players/player-compare-modal";
import { CompareButton } from "@/components/players/compare-button";

type Tab = "predictions" | "set-pieces";
type PosFilter = "all" | PlayerPosition;

const confidenceColors = {
  high: "text-fpl-green",
  medium: "text-yellow-400",
  low: "text-fpl-muted",
};

export default function PlayersPage() {
  const {
    data: bootstrap,
    isLoading: bsLoading,
    error: bsError,
    refetch: bsRefetch,
  } = useBootstrapStatic();
  const {
    data: fixtures,
    isLoading: fxLoading,
    error: fxError,
    refetch: fxRefetch,
  } = useFixtures();

  const [tab, setTab] = useState<Tab>("predictions");
  const [posFilter, setPosFilter] = useState<PosFilter>("all");
  const [search, setSearch] = useState("");
  const [showCompareModal, setShowCompareModal] = useState(false);

  const {
    selectedPlayers,
    togglePlayer,
    clearSelection,
    isSelected,
    canCompare,
  } = usePlayerComparison();

  const handleCompare = useCallback(() => {
    setShowCompareModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowCompareModal(false);
  }, []);

  const nextGw = bootstrap ? getNextGameweek(bootstrap.events) : undefined;
  const currentGw = bootstrap
    ? getCurrentGameweek(bootstrap.events)
    : undefined;
  const targetGw = nextGw ?? currentGw;

  const enriched = useMemo(() => {
    if (!bootstrap) return [];
    return enrichPlayers(bootstrap);
  }, [bootstrap]);

  const predictions = useMemo(() => {
    if (!enriched.length || !fixtures || !targetGw) return [];
    let preds = predictPoints(enriched, fixtures, targetGw.id);

    if (posFilter !== "all") {
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
  }, [enriched, fixtures, targetGw, posFilter, search]);

  // Set-piece data
  const topSetPieceAssets = useMemo(() => {
    if (!enriched.length) return [];
    return getTopSetPieceAssets(enriched, 20);
  }, [enriched]);

  const teamSetPieces = useMemo(() => {
    if (!enriched.length) return [];
    return getSetPieceTakersByTeam(enriched);
  }, [enriched]);

  const columns: Column<PointsPrediction>[] = [
    {
      key: "compare",
      header: "",
      className: "w-8",
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlayer(r.player);
          }}
          className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
            isSelected(r.player.id)
              ? "border-fpl-green bg-fpl-green text-fpl-purple"
              : "border-fpl-border hover:border-fpl-green"
          }`}
          aria-label={
            isSelected(r.player.id)
              ? "Deselect player"
              : "Select player for comparison"
          }
        >
          {isSelected(r.player.id) && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
      ),
    },
    {
      key: "rank",
      header: "#",
      className: "w-8",
      render: (_, i) => <span className="text-fpl-muted">{i + 1}</span>,
    },
    {
      key: "name",
      header: "Player",
      render: (r) => (
        <div>
          <span className="font-medium">{getPlayerDisplayName(r.player)}</span>
          <span className="ml-2 text-xs text-fpl-muted">
            {r.player.team_short_name}
          </span>
        </div>
      ),
    },
    {
      key: "pos",
      header: "Pos",
      className: "w-12",
      render: (r) => (
        <PositionBadge
          position={r.player.element_type}
          label={r.player.position_short}
        />
      ),
    },
    {
      key: "price",
      header: "Price",
      className: "w-16 text-right",
      render: (r) => (
        <span className="text-fpl-muted">{getPlayerPrice(r.player)}</span>
      ),
    },
    {
      key: "form",
      header: "Form",
      className: "w-12 text-right",
      render: (r) => <span className="text-fpl-muted">{r.player.form}</span>,
    },
    {
      key: "pts",
      header: "Pts",
      className: "w-12 text-right",
      render: (r) => <span>{r.player.total_points}</span>,
    },
    {
      key: "xPts",
      header: "xPts",
      className: "w-14 text-right",
      render: (r) => (
        <span className="font-bold text-fpl-green">{r.predictedPoints}</span>
      ),
    },
    {
      key: "conf",
      header: "Conf",
      className: "w-14 text-center",
      render: (r) => (
        <span
          className={`text-xs font-medium capitalize ${confidenceColors[r.confidence]}`}
        >
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
      <ErrorState
        message={error.message}
        onRetry={() => {
          bsRefetch();
          fxRefetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Players</h1>
        <p className="text-sm text-fpl-muted">
          {targetGw
            ? `${targetGw.name} predictions and set-piece takers`
            : "Player analysis"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-fpl-border">
        {[
          { key: "predictions" as Tab, label: "Predictions" },
          { key: "set-pieces" as Tab, label: "Set-Piece Takers" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-fpl-green text-fpl-green"
                : "border-transparent text-fpl-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "predictions" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1">
              {[
                { key: "all" as PosFilter, label: "All" },
                { key: 1 as PosFilter, label: "GK" },
                { key: 2 as PosFilter, label: "DEF" },
                { key: 3 as PosFilter, label: "MID" },
                { key: 4 as PosFilter, label: "FWD" },
              ].map((f) => (
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
                <DataTable
                  columns={columns}
                  data={predictions}
                  keyExtractor={(r) => r.player.id}
                />
              ) : (
                <p className="py-4 text-center text-sm text-fpl-muted">
                  No players match filters.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === "set-pieces" && (
        <Card>
          <CardHeader>
            <CardTitle>Set-Piece Takers</CardTitle>
            <p className="text-xs text-fpl-muted">
              Track penalty, corner, and free kick takers across all teams
            </p>
          </CardHeader>
          <CardContent>
            <SetPieceTakersSection
              topAssets={topSetPieceAssets}
              teamSetPieces={teamSetPieces}
            />
          </CardContent>
        </Card>
      )}

      {/* Compare Button */}
      <CompareButton
        selectedPlayers={selectedPlayers}
        canCompare={canCompare}
        onCompare={handleCompare}
        onClear={clearSelection}
      />

      {/* Compare Modal */}
      {showCompareModal && canCompare && (
        <PlayerCompareModal
          players={selectedPlayers}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
