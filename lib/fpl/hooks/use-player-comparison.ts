"use client";

import { useState, useCallback } from "react";
import type { EnrichedPlayer } from "@/lib/fpl/utils";

const MAX_COMPARE = 2;

export interface UsePlayerComparisonResult {
  /** Currently selected players for comparison */
  selectedPlayers: EnrichedPlayer[];
  /** IDs of selected players for quick lookup */
  selectedIds: Set<number>;
  /** Toggle a player's selection */
  togglePlayer: (player: EnrichedPlayer) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Check if a player is selected */
  isSelected: (playerId: number) => boolean;
  /** Whether comparison is available (2 players selected) */
  canCompare: boolean;
  /** Whether more players can be added */
  canAddMore: boolean;
}

/**
 * Hook for managing player comparison selection.
 * Limits selection to MAX_COMPARE players.
 */
export function usePlayerComparison(): UsePlayerComparisonResult {
  const [selectedPlayers, setSelectedPlayers] = useState<EnrichedPlayer[]>([]);

  const selectedIds = new Set(selectedPlayers.map((p) => p.id));

  const togglePlayer = useCallback((player: EnrichedPlayer) => {
    setSelectedPlayers((current) => {
      const isCurrentlySelected = current.some((p) => p.id === player.id);
      if (isCurrentlySelected) {
        return current.filter((p) => p.id !== player.id);
      }
      if (current.length >= MAX_COMPARE) {
        // Replace oldest selection
        return [...current.slice(1), player];
      }
      return [...current, player];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPlayers([]);
  }, []);

  const isSelected = useCallback(
    (playerId: number) => selectedIds.has(playerId),
    [selectedIds],
  );

  return {
    selectedPlayers,
    selectedIds,
    togglePlayer,
    clearSelection,
    isSelected,
    canCompare: selectedPlayers.length === MAX_COMPARE,
    canAddMore: selectedPlayers.length < MAX_COMPARE,
  };
}
