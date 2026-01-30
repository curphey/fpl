"use client";

import { memo } from "react";
import type { EnrichedPlayer } from "@/lib/fpl/utils";
import { getPlayerDisplayName } from "@/lib/fpl/utils";

interface CompareButtonProps {
  selectedPlayers: EnrichedPlayer[];
  canCompare: boolean;
  onCompare: () => void;
  onClear: () => void;
}

export const CompareButton = memo(function CompareButton({
  selectedPlayers,
  canCompare,
  onCompare,
  onClear,
}: CompareButtonProps) {
  if (selectedPlayers.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 transform">
      <div className="flex items-center gap-2 rounded-full border border-fpl-border bg-fpl-purple px-4 py-2 shadow-lg">
        <div className="flex items-center gap-1">
          {selectedPlayers.map((p, i) => (
            <span key={p.id} className="flex items-center">
              {i > 0 && <span className="mx-1 text-fpl-muted">vs</span>}
              <span className="rounded bg-fpl-purple-light px-2 py-0.5 text-sm font-medium">
                {getPlayerDisplayName(p)}
              </span>
            </span>
          ))}
        </div>

        {canCompare ? (
          <button
            onClick={onCompare}
            className="ml-2 rounded-full bg-fpl-green px-4 py-1.5 text-sm font-semibold text-fpl-purple transition-colors hover:bg-fpl-green/90"
          >
            Compare
          </button>
        ) : (
          <span className="ml-2 text-xs text-fpl-muted">Select 1 more</span>
        )}

        <button
          onClick={onClear}
          className="ml-1 rounded-full p-1 text-fpl-muted transition-colors hover:text-foreground"
          aria-label="Clear selection"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
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
    </div>
  );
});
