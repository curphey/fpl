"use client";

import { memo, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PickSuggestionCard } from "./pick-suggestion-card";
import { DraftBoard } from "./draft-board";
import { PositionBadge } from "@/components/ui/badge";
import {
  getSnakeDraftSuggestions,
  getAvailablePlayers,
  makeDraftPick,
  isUserTurn,
  getManagerForPick,
} from "@/lib/fpl/draft-model";
import type { DraftState, DraftPlayer } from "@/lib/fpl/draft-types";

interface SnakeDraftSimulatorProps {
  players: DraftPlayer[];
  state: DraftState;
  onStateChange: (state: DraftState) => void;
}

export const SnakeDraftSimulator = memo(function SnakeDraftSimulator({
  players,
  state,
  onStateChange,
}: SnakeDraftSimulatorProps) {
  const userTurn = isUserTurn(state);
  const { round, managerPosition } = getManagerForPick(
    state.currentPick,
    state.totalManagers,
  );

  const availablePlayers = useMemo(
    () => getAvailablePlayers(players, state.draftedPlayers),
    [players, state.draftedPlayers],
  );

  const suggestions = useMemo(
    () => getSnakeDraftSuggestions(availablePlayers, state, 5),
    [availablePlayers, state],
  );

  // Count roster positions filled
  const rosterCounts = useMemo(() => {
    const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const slot of state.userRoster) {
      if (slot.player) {
        counts[slot.position]++;
      }
    }
    return counts;
  }, [state.userRoster]);

  const handleSelectPlayer = useCallback(
    (playerId: number) => {
      const player = players.find((p) => p.id === playerId);
      if (!player) return;

      const newState = makeDraftPick(state, player);
      onStateChange(newState);
    },
    [players, state, onStateChange],
  );

  // Simulate other managers' picks (skip to user's turn)
  const handleSkipToMyTurn = useCallback(() => {
    let currentState = state;

    while (!isUserTurn(currentState) && !currentState.isComplete) {
      // Pick a random available player for the AI
      const available = getAvailablePlayers(
        players,
        currentState.draftedPlayers,
      );
      if (available.length === 0) break;

      // AI picks from top available by ADP
      const aiPick = available[0];
      currentState = makeDraftPick(currentState, aiPick);
    }

    onStateChange(currentState);
  }, [players, state, onStateChange]);

  if (state.isComplete) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xl font-bold text-fpl-green mb-2">
            Draft Complete!
          </p>
          <p className="text-fpl-muted">Your roster has been filled.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Pick Info */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-fpl-muted">Current Pick</p>
              <p className="text-2xl font-bold">
                Round {round}, Pick #{state.currentPick}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-fpl-muted">On the Clock</p>
              <p
                className={`text-lg font-medium ${userTurn ? "text-fpl-green" : "text-fpl-muted"}`}
              >
                {userTurn ? "Your Turn!" : `Manager ${managerPosition}`}
              </p>
            </div>
          </div>

          {!userTurn && (
            <button
              onClick={handleSkipToMyTurn}
              className="mt-4 w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Simulate AI Picks (Skip to My Turn)
            </button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Suggestions */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-fpl-muted">
            Top Picks Available
          </h3>
          {suggestions.map((suggestion) => (
            <PickSuggestionCard
              key={suggestion.player.id}
              suggestion={suggestion}
              onSelect={handleSelectPlayer}
              disabled={!userTurn}
            />
          ))}
        </div>

        {/* Roster & Board */}
        <div className="space-y-4">
          {/* Roster Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your Roster</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {(["GK", "DEF", "MID", "FWD"] as const).map((pos) => {
                  const required = pos === "GK" ? 2 : pos === "FWD" ? 3 : 5;
                  const filled = rosterCounts[pos];
                  return (
                    <div
                      key={pos}
                      className={`p-2 rounded-lg text-center ${
                        filled >= required
                          ? "bg-fpl-green/20"
                          : filled > 0
                            ? "bg-fpl-purple/20"
                            : "bg-gray-800"
                      }`}
                    >
                      <PositionBadge
                        position={
                          pos === "GK"
                            ? 1
                            : pos === "DEF"
                              ? 2
                              : pos === "MID"
                                ? 3
                                : 4
                        }
                        label={pos}
                      />
                      <p className="mt-1 text-sm font-medium">
                        {filled}/{required}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Roster List */}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {state.userRoster
                  .filter((slot) => slot.player)
                  .map((slot, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm py-1 px-2 bg-gray-800/50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <PositionBadge
                          position={slot.player!.positionId}
                          label={slot.player!.position}
                        />
                        <span>{slot.player!.name}</span>
                      </div>
                      <span className="text-fpl-muted text-xs">
                        ADP {slot.player!.estimatedADP}
                      </span>
                    </div>
                  ))}
                {state.userRoster.filter((slot) => !slot.player).length > 0 && (
                  <p className="text-xs text-fpl-muted text-center py-2">
                    {state.userRoster.filter((slot) => !slot.player).length}{" "}
                    slots remaining
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Draft Board */}
          <DraftBoard state={state} />
        </div>
      </div>
    </div>
  );
});
