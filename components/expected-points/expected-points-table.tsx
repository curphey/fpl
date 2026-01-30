import { memo } from "react";
import type { EnrichedPlayer } from "@/lib/fpl/utils";
import { getPlayerDisplayName, getPlayerPrice } from "@/lib/fpl/utils";
import { PositionBadge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

export interface ExpectedPointsPlayer extends EnrichedPlayer {
  ep_next_value: number;
  differential_score: number;
}

const OwnershipBar = memo(function OwnershipBar({ value }: { value: number }) {
  const pct = Math.min(value, 100);
  const color =
    value < 10 ? "bg-fpl-pink" : value < 25 ? "bg-fpl-cyan" : "bg-fpl-purple";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-fpl-purple-light">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-fpl-muted">{value.toFixed(1)}%</span>
    </div>
  );
});

const DifferentialBadge = memo(function DifferentialBadge({
  score,
}: {
  score: number;
}) {
  // High differential score = high EP, low ownership
  if (score >= 2) {
    return (
      <span className="rounded bg-fpl-pink/20 px-1.5 py-0.5 text-[10px] font-medium text-fpl-pink">
        HOT
      </span>
    );
  }
  if (score >= 1) {
    return (
      <span className="rounded bg-fpl-cyan/20 px-1.5 py-0.5 text-[10px] font-medium text-fpl-cyan">
        DIFF
      </span>
    );
  }
  return null;
});

export function ExpectedPointsTable({
  players,
  showDifferentialBadge = true,
}: {
  players: ExpectedPointsPlayer[];
  showDifferentialBadge?: boolean;
}) {
  const columns: Column<ExpectedPointsPlayer>[] = [
    {
      key: "rank",
      header: "#",
      className: "w-8",
      render: (_, i) => <span className="text-fpl-muted">{i + 1}</span>,
    },
    {
      key: "player",
      header: "Player",
      render: (p) => (
        <div className="flex items-center gap-2">
          <div>
            <span className="font-medium">{getPlayerDisplayName(p)}</span>
            <span className="ml-2 text-xs text-fpl-muted">
              {p.team_short_name}
            </span>
          </div>
          {showDifferentialBadge && (
            <DifferentialBadge score={p.differential_score} />
          )}
        </div>
      ),
    },
    {
      key: "pos",
      header: "Pos",
      className: "w-12",
      render: (p) => (
        <PositionBadge position={p.element_type} label={p.position_short} />
      ),
    },
    {
      key: "price",
      header: "Price",
      className: "w-16 text-right",
      render: (p) => (
        <span className="text-fpl-muted">{getPlayerPrice(p)}</span>
      ),
    },
    {
      key: "ep_next",
      header: "xPts",
      className: "w-16 text-right",
      render: (p) => (
        <span className="font-semibold text-fpl-green">
          {p.ep_next_value.toFixed(1)}
        </span>
      ),
    },
    {
      key: "form",
      header: "Form",
      className: "w-14 text-right",
      render: (p) => <span className="text-fpl-muted">{p.form}</span>,
    },
    {
      key: "ownership",
      header: "Owned",
      className: "w-28",
      render: (p) => <OwnershipBar value={p.ownership_value} />,
    },
    {
      key: "points",
      header: "Pts",
      className: "w-12 text-right",
      render: (p) => <span className="text-fpl-muted">{p.total_points}</span>,
    },
  ];

  return (
    <DataTable columns={columns} data={players} keyExtractor={(p) => p.id} />
  );
}
