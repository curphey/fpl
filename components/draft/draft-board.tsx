"use client";

import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { initializeDraftBoard, markUserPicks } from "@/lib/fpl/draft-model";
import type { DraftState } from "@/lib/fpl/draft-types";

interface DraftBoardProps {
  state: DraftState;
}

export const DraftBoard = memo(function DraftBoard({ state }: DraftBoardProps) {
  const board = useMemo(() => {
    const base = initializeDraftBoard(state.totalManagers);
    return markUserPicks(base, state.userPosition);
  }, [state.totalManagers, state.userPosition]);

  // Get drafted player for a cell based on pick number
  const getDraftedPlayer = (pickNumber: number): DraftPlayer | null => {
    if (pickNumber >= state.currentPick) return null;
    // In a real implementation, we'd track which player was picked at each spot
    // For now, this is a simplified version that only shows user picks
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Draft Board</span>
          <span className="text-sm font-normal text-fpl-muted">
            Pick {state.currentPick} of {state.totalManagers * 15}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-fpl-muted sticky left-0 bg-fpl-card z-10">
                  Rd
                </th>
                {Array.from({ length: state.totalManagers }, (_, i) => (
                  <th
                    key={i}
                    className={`px-2 py-1 text-center min-w-[60px] ${
                      i + 1 === state.userPosition
                        ? "text-fpl-green font-bold"
                        : "text-fpl-muted"
                    }`}
                  >
                    {i + 1 === state.userPosition ? "You" : `M${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.cells.map((round, roundIndex) => (
                <tr key={roundIndex}>
                  <td className="px-2 py-1 text-fpl-muted sticky left-0 bg-fpl-card z-10">
                    <div className="flex items-center gap-1">
                      <span>{roundIndex + 1}</span>
                      <span className="text-[10px]">
                        {board.snakeDirections[roundIndex] ? "→" : "←"}
                      </span>
                    </div>
                  </td>
                  {round.map((cell) => {
                    const isCurrentPick = cell.pickNumber === state.currentPick;
                    const isPast = cell.pickNumber < state.currentPick;
                    const player = getDraftedPlayer(cell.pickNumber);

                    return (
                      <td
                        key={cell.pickNumber}
                        className={`px-1 py-1 text-center border border-gray-800 ${
                          isCurrentPick
                            ? "bg-fpl-purple/30 ring-1 ring-fpl-purple"
                            : cell.isUserPick
                              ? isPast
                                ? "bg-fpl-green/20"
                                : "bg-fpl-green/10"
                              : isPast
                                ? "bg-gray-800/50"
                                : "bg-gray-900/50"
                        }`}
                      >
                        {player ? (
                          <div className="truncate text-[10px]">
                            {player.name}
                          </div>
                        ) : (
                          <div className="text-[10px] text-fpl-muted">
                            {cell.pickNumber}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-fpl-green/10 border border-fpl-green/30 rounded" />
            <span className="text-fpl-muted">Your picks</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-fpl-purple/30 border border-fpl-purple rounded" />
            <span className="text-fpl-muted">Current pick</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-800/50 border border-gray-700 rounded" />
            <span className="text-fpl-muted">Completed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
