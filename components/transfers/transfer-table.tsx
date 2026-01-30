import { memo } from "react";
import type { TransferRecommendation } from "@/lib/fpl/transfer-model";
import { getPlayerDisplayName, getPlayerPrice } from "@/lib/fpl/utils";
import { PositionBadge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

const ScoreBar = memo(function ScoreBar({
  value,
  max = 10,
}: {
  value: number;
  max?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-fpl-purple-light">
        <div
          className="h-full rounded-full bg-fpl-green"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-fpl-muted">{value.toFixed(1)}</span>
    </div>
  );
});

export const TransferTable = memo(function TransferTable({
  recommendations,
}: {
  recommendations: TransferRecommendation[];
}) {
  const columns: Column<TransferRecommendation>[] = [
    {
      key: "rank",
      header: "#",
      className: "w-8",
      render: (_, i) => <span className="text-fpl-muted">{i + 1}</span>,
    },
    {
      key: "player",
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
      className: "w-28",
      render: (r) => <ScoreBar value={r.formScore} />,
    },
    {
      key: "fixtures",
      header: "Fixtures",
      className: "w-28",
      render: (r) => <ScoreBar value={r.fixtureScore} />,
    },
    {
      key: "score",
      header: "Score",
      className: "w-14 text-right",
      render: (r) => (
        <span className="font-semibold text-fpl-green">
          {r.score.toFixed(1)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={recommendations}
      keyExtractor={(r) => r.player.id}
    />
  );
});
