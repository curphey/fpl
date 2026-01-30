import { memo } from "react";
import type { CaptainPick } from "@/lib/fpl/captain-model";
import { getPlayerDisplayName, getPlayerPrice } from "@/lib/fpl/utils";
import { PositionBadge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { getFDRColorClass } from "@/lib/fpl/fixture-planner";

const MiniBar = memo(function MiniBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const pct = Math.min((value / 10) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-xs text-fpl-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fpl-purple-light">
        <div
          className="h-full rounded-full bg-fpl-green"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-7 text-right text-xs text-fpl-muted">
        {value.toFixed(1)}
      </span>
    </div>
  );
});

export const CaptainCard = memo(function CaptainCard({
  pick,
  rank,
}: {
  pick: CaptainPick;
  rank: number;
}) {
  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4 transition-colors hover:bg-fpl-card-hover">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fpl-purple-light text-sm font-bold text-fpl-green">
            {rank}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {getPlayerDisplayName(pick.player)}
              </span>
              <PositionBadge
                position={pick.player.element_type}
                label={pick.player.position_short}
              />
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-fpl-muted">
              <span>{pick.player.team_short_name}</span>
              <span>|</span>
              <span>{getPlayerPrice(pick.player)}</span>
              <span>|</span>
              <span>{pick.player.selected_by_percent}% owned</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-fpl-green">
            {pick.score.toFixed(1)}
          </p>
          <Badge variant={pick.category === "safe" ? "green" : "pink"}>
            {pick.category === "safe" ? "Safe" : "Differential"}
          </Badge>
        </div>
      </div>

      {/* Fixture info */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ${getFDRColorClass(pick.difficulty)}`}
        >
          {pick.opponentShortName} ({pick.isHome ? "H" : "A"})
        </span>
      </div>

      {/* Score breakdown */}
      <div className="mt-3 space-y-1">
        <MiniBar value={pick.formScore} label="Form" />
        <MiniBar value={pick.fixtureScore} label="Fixture" />
        <MiniBar value={pick.xgiScore} label="xGI" />
        <MiniBar value={pick.setPieceScore} label="Set pcs" />
      </div>
    </div>
  );
});
