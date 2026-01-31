"use client";

import { memo, useCallback } from "react";
import type { EnrichedPlayer } from "@/lib/fpl/utils";
import { getPlayerDisplayName } from "@/lib/fpl/utils";
import { PositionBadge } from "@/components/ui/badge";
import { AskAiButton } from "@/components/chat";

interface PlayerCompareModalProps {
  players: EnrichedPlayer[];
  onClose: () => void;
}

interface StatRowProps {
  label: string;
  values: (string | number)[];
  highlight?: "higher" | "lower";
  format?: "decimal" | "percent" | "currency";
}

const StatRow = memo(function StatRow({
  label,
  values,
  highlight = "higher",
  format,
}: StatRowProps) {
  const numericValues = values.map((v) =>
    typeof v === "string" ? parseFloat(v) || 0 : v,
  );
  const maxVal = Math.max(...numericValues);
  const minVal = Math.min(...numericValues);
  const bestVal = highlight === "higher" ? maxVal : minVal;

  const formatValue = (v: string | number) => {
    const num = typeof v === "string" ? parseFloat(v) || 0 : v;
    if (format === "decimal") return num.toFixed(1);
    if (format === "percent") return `${num.toFixed(1)}%`;
    if (format === "currency") return `£${(num / 10).toFixed(1)}m`;
    return String(v);
  };

  return (
    <div className="grid grid-cols-3 gap-4 border-b border-fpl-border/50 py-2 text-sm last:border-0">
      <div className="text-fpl-muted">{label}</div>
      {values.map((value, i) => {
        const numValue =
          typeof value === "string" ? parseFloat(value) || 0 : value;
        const isBest = numValue === bestVal && values.length > 1;
        return (
          <div
            key={i}
            className={`text-center font-medium ${
              isBest ? "text-fpl-green" : "text-foreground"
            }`}
          >
            {formatValue(value)}
            {isBest && values.length > 1 && (
              <span className="ml-1 text-xs text-fpl-green">★</span>
            )}
          </div>
        );
      })}
    </div>
  );
});

export function PlayerCompareModal({
  players,
  onClose,
}: PlayerCompareModalProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (players.length < 2) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-fpl-border bg-fpl-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-fpl-border bg-fpl-purple p-4">
          <h2 className="text-lg font-bold">Player Comparison</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-fpl-muted transition-colors hover:bg-fpl-card-hover hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Player headers */}
        <div className="grid grid-cols-3 gap-4 border-b border-fpl-border bg-fpl-purple-light p-4">
          <div className="text-sm font-medium text-fpl-muted">Stat</div>
          {players.map((player) => (
            <div key={player.id} className="text-center">
              <div className="font-semibold">
                {getPlayerDisplayName(player)}
              </div>
              <div className="mt-1 flex items-center justify-center gap-2">
                <PositionBadge
                  position={player.element_type}
                  label={player.position_short}
                />
                <span className="text-xs text-fpl-muted">
                  {player.team_short_name}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fpl-muted">
            Value
          </h3>
          <StatRow
            label="Price"
            values={players.map((p) => p.now_cost)}
            highlight="lower"
            format="currency"
          />
          <StatRow
            label="Ownership"
            values={players.map((p) => parseFloat(p.selected_by_percent))}
            format="percent"
          />

          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-fpl-muted">
            Performance
          </h3>
          <StatRow
            label="Total Points"
            values={players.map((p) => p.total_points)}
          />
          <StatRow
            label="Form"
            values={players.map((p) => p.form)}
            format="decimal"
          />
          <StatRow
            label="Points/Match"
            values={players.map((p) => p.points_per_game)}
            format="decimal"
          />
          <StatRow label="Minutes" values={players.map((p) => p.minutes)} />
          <StatRow label="Starts" values={players.map((p) => p.starts)} />

          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-fpl-muted">
            Goals & Assists
          </h3>
          <StatRow label="Goals" values={players.map((p) => p.goals_scored)} />
          <StatRow label="Assists" values={players.map((p) => p.assists)} />
          <StatRow
            label="xG"
            values={players.map((p) => p.expected_goals)}
            format="decimal"
          />
          <StatRow
            label="xA"
            values={players.map((p) => p.expected_assists)}
            format="decimal"
          />
          <StatRow
            label="xGI"
            values={players.map((p) => p.expected_goal_involvements)}
            format="decimal"
          />

          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-fpl-muted">
            Creativity & Threat
          </h3>
          <StatRow
            label="ICT Index"
            values={players.map((p) => p.ict_index)}
            format="decimal"
          />
          <StatRow
            label="Influence"
            values={players.map((p) => p.influence)}
            format="decimal"
          />
          <StatRow
            label="Creativity"
            values={players.map((p) => p.creativity)}
            format="decimal"
          />
          <StatRow
            label="Threat"
            values={players.map((p) => p.threat)}
            format="decimal"
          />

          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-fpl-muted">
            Bonus & Clean Sheets
          </h3>
          <StatRow label="Bonus Points" values={players.map((p) => p.bonus)} />
          <StatRow label="BPS" values={players.map((p) => p.bps)} />
          <StatRow
            label="Clean Sheets"
            values={players.map((p) => p.clean_sheets)}
          />

          {/* Ask AI button */}
          <div className="mt-6 border-t border-fpl-border pt-4">
            <AskAiButton
              question={`Compare ${players.map((p) => getPlayerDisplayName(p)).join(" vs ")} in detail. Include recent form, upcoming fixtures, and which one is the better pick.`}
              label="Ask AI for detailed comparison"
              tooltip="Get AI analysis comparing these players"
              autoSubmit
              className="w-full justify-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
