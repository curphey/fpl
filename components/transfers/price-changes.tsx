"use client";

import { useState, useMemo } from "react";
import type { PriceChangeCandidate } from "@/lib/fpl/price-model";
import { calculateTransferTiming } from "@/lib/fpl/price-model";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PositionBadge, Badge } from "@/components/ui/badge";
import { getPlayerDisplayName, getPlayerPrice } from "@/lib/fpl/utils";
import { PriceSparkline } from "./price-sparkline";
import { PriceHistoryModal } from "./price-history-modal";
import { usePlayerSummary } from "@/lib/fpl/hooks/use-fpl";
import type { EnrichedPlayer } from "@/lib/fpl/utils";

function ActionBadge({ candidate }: { candidate: PriceChangeCandidate }) {
  const advice = calculateTransferTiming(candidate);

  const badgeVariant =
    advice.recommendation === "buy_now"
      ? "green"
      : advice.recommendation === "wait"
        ? "pink"
        : "default";

  const label =
    advice.recommendation === "buy_now"
      ? "Buy Now"
      : advice.recommendation === "wait"
        ? "Wait"
        : "Monitor";

  return (
    <Badge variant={badgeVariant} className="text-[10px]">
      {label}
    </Badge>
  );
}

function SparklineCell({
  player,
  onClick,
}: {
  player: EnrichedPlayer;
  onClick: () => void;
}) {
  const { data: summary } = usePlayerSummary(player.id);

  const history = useMemo(() => {
    if (!summary?.history) return [];
    // Take last 10 gameweeks
    return summary.history.slice(-10).map((h) => ({
      gw: h.round,
      price: h.value / 10,
    }));
  }, [summary]);

  return (
    <button
      onClick={onClick}
      className="hover:opacity-80"
      title="View price history"
    >
      <PriceSparkline history={history} width={60} height={20} />
    </button>
  );
}

export function PriceChangesTable({
  risers,
  fallers,
}: {
  risers: PriceChangeCandidate[];
  fallers: PriceChangeCandidate[];
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<EnrichedPlayer | null>(
    null,
  );

  const riserColumns: Column<PriceChangeCandidate>[] = [
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
      key: "trend",
      header: "Trend",
      className: "w-16",
      render: (r) => (
        <SparklineCell
          player={r.player}
          onClick={() => setSelectedPlayer(r.player)}
        />
      ),
    },
    {
      key: "net",
      header: "Net Transfers",
      className: "w-24 text-right",
      render: (r) => (
        <span
          className={r.netTransfers > 0 ? "text-fpl-green" : "text-fpl-danger"}
        >
          {r.netTransfers > 0 ? "+" : ""}
          {r.netTransfers.toLocaleString()}
        </span>
      ),
    },
    {
      key: "prob",
      header: "Likelihood",
      className: "w-24",
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-fpl-border">
            <div
              className={`h-1.5 rounded-full ${r.direction === "rise" ? "bg-fpl-green" : "bg-fpl-danger"}`}
              style={{ width: `${r.probability * 100}%` }}
            />
          </div>
          <span className="text-xs text-fpl-muted">
            {Math.round(r.probability * 100)}%
          </span>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      className: "w-20",
      render: (r) => <ActionBadge candidate={r} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Risers */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-fpl-green">
          Likely Price Rises ({risers.length})
        </h3>
        {risers.length > 0 ? (
          <DataTable
            columns={riserColumns}
            data={risers}
            keyExtractor={(r) => r.player.id}
          />
        ) : (
          <p className="py-3 text-center text-xs text-fpl-muted">
            No likely risers detected
          </p>
        )}
      </div>

      {/* Fallers */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-fpl-danger">
          Likely Price Falls ({fallers.length})
        </h3>
        {fallers.length > 0 ? (
          <DataTable
            columns={riserColumns}
            data={fallers}
            keyExtractor={(r) => r.player.id}
          />
        ) : (
          <p className="py-3 text-center text-xs text-fpl-muted">
            No likely fallers detected
          </p>
        )}
      </div>

      {/* Price History Modal */}
      {selectedPlayer && (
        <PriceHistoryModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
