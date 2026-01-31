"use client";

import { memo } from "react";
import { Badge, PositionBadge } from "@/components/ui/badge";
import type { DraftPickSuggestion } from "@/lib/fpl/draft-types";

interface PickSuggestionCardProps {
  suggestion: DraftPickSuggestion;
  onSelect: (playerId: number) => void;
  disabled?: boolean;
}

export const PickSuggestionCard = memo(function PickSuggestionCard({
  suggestion,
  onSelect,
  disabled = false,
}: PickSuggestionCardProps) {
  const {
    player,
    rank,
    reasoning,
    positionalNeed,
    valueScore,
    isValue,
    isReach,
  } = suggestion;

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4 transition-colors hover:bg-fpl-card-hover">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fpl-purple-light text-sm font-bold text-fpl-green">
            {rank}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{player.name}</span>
              <PositionBadge
                position={player.positionId}
                label={player.position}
              />
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-fpl-muted">
              <span>{player.teamShort}</span>
              <span>|</span>
              <span>ADP: {player.estimatedADP}</span>
              <span>|</span>
              <span>{player.totalPoints} pts</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-fpl-green">{valueScore}</p>
          <div className="flex gap-1 justify-end mt-1">
            {isValue && <Badge variant="green">Value</Badge>}
            {isReach && <Badge variant="danger">Reach</Badge>}
            {positionalNeed === "critical" && (
              <Badge variant="pink">Need</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <p className="mt-2 text-sm text-fpl-muted">{reasoning}</p>

      {/* Stats Row */}
      <div className="mt-3 flex items-center gap-4 text-xs">
        <div>
          <span className="text-fpl-muted">Form: </span>
          <span className="font-medium">{player.form.toFixed(1)}</span>
        </div>
        <div>
          <span className="text-fpl-muted">xGI: </span>
          <span className="font-medium">{player.xgi.toFixed(1)}</span>
        </div>
        <div>
          <span className="text-fpl-muted">Own: </span>
          <span className="font-medium">{player.ownership.toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-fpl-muted">Tier: </span>
          <span className="font-medium capitalize">{player.adpTier}</span>
        </div>
      </div>

      {/* Select Button */}
      <button
        onClick={() => onSelect(player.id)}
        disabled={disabled}
        className={`mt-3 w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
          disabled
            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
            : "bg-fpl-purple hover:bg-fpl-purple/80 text-white"
        }`}
      >
        {disabled ? "Not Your Turn" : "Select Player"}
      </button>
    </div>
  );
});
