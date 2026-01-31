"use client";

import { memo, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PositionBadge } from "@/components/ui/badge";
import {
  getAuctionBidSuggestion,
  getAuctionValueTargets,
  getAvailablePlayers,
  makeDraftPick,
} from "@/lib/fpl/draft-model";
import type {
  DraftState,
  DraftPlayer,
  AuctionBidSuggestion,
} from "@/lib/fpl/draft-types";

interface AuctionDraftSimulatorProps {
  players: DraftPlayer[];
  state: DraftState;
  onStateChange: (state: DraftState) => void;
}

export const AuctionDraftSimulator = memo(function AuctionDraftSimulator({
  players,
  state,
  onStateChange,
}: AuctionDraftSimulatorProps) {
  const [nominatedPlayer, setNominatedPlayer] = useState<DraftPlayer | null>(
    null,
  );
  const [bidAmount, setBidAmount] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const budget = state.budgetRemaining ?? 200;
  const initialBudget = state.initialBudget ?? 200;
  const budgetPercent = (budget / initialBudget) * 100;

  const availablePlayers = useMemo(
    () => getAvailablePlayers(players, state.draftedPlayers),
    [players, state.draftedPlayers],
  );

  const valueTargets = useMemo(
    () => getAuctionValueTargets(availablePlayers, state, 5),
    [availablePlayers, state],
  );

  const bidSuggestion = useMemo<AuctionBidSuggestion | null>(() => {
    if (!nominatedPlayer) return null;
    return getAuctionBidSuggestion(nominatedPlayer, state, availablePlayers);
  }, [nominatedPlayer, state, availablePlayers]);

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return availablePlayers.slice(0, 20);
    const query = searchQuery.toLowerCase();
    return availablePlayers
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.team.toLowerCase().includes(query),
      )
      .slice(0, 20);
  }, [availablePlayers, searchQuery]);

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

  const handleNominate = useCallback((player: DraftPlayer) => {
    setNominatedPlayer(player);
    setBidAmount(1);
  }, []);

  const handleWinBid = useCallback(() => {
    if (!nominatedPlayer) return;

    const newState = makeDraftPick(state, nominatedPlayer, bidAmount);
    onStateChange(newState);
    setNominatedPlayer(null);
    setBidAmount(1);
    setSearchQuery("");
  }, [nominatedPlayer, bidAmount, state, onStateChange]);

  const handleSkip = useCallback(() => {
    // Skip this nomination (another manager wins)
    if (!nominatedPlayer) return;

    // Just mark as drafted by another manager
    const newDrafted = new Set(state.draftedPlayers);
    newDrafted.add(nominatedPlayer.id);

    onStateChange({
      ...state,
      draftedPlayers: newDrafted,
      currentPick: state.currentPick + 1,
    });

    setNominatedPlayer(null);
    setBidAmount(1);
    setSearchQuery("");
  }, [nominatedPlayer, state, onStateChange]);

  if (state.isComplete) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xl font-bold text-fpl-green mb-2">
            Auction Complete!
          </p>
          <p className="text-fpl-muted">Your roster has been filled.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Budget Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-fpl-muted">Budget Remaining</span>
            <span className="text-2xl font-bold text-fpl-green">{budget}</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                budgetPercent > 50
                  ? "bg-fpl-green"
                  : budgetPercent > 25
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-fpl-muted mt-1">
            <span>0</span>
            <span>{initialBudget}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Nomination & Bidding */}
        <div className="space-y-4">
          {/* Current Nomination */}
          {nominatedPlayer ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Current Nomination
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        {nominatedPlayer.name}
                      </span>
                      <PositionBadge
                        position={nominatedPlayer.positionId}
                        label={nominatedPlayer.position}
                      />
                    </div>
                    <p className="text-sm text-fpl-muted">
                      {nominatedPlayer.team} | ADP:{" "}
                      {nominatedPlayer.estimatedADP}
                    </p>
                  </div>
                  <Badge
                    variant={
                      nominatedPlayer.adpTier === "elite" ? "green" : "default"
                    }
                  >
                    {nominatedPlayer.adpTier}
                  </Badge>
                </div>

                {/* Bid Suggestion */}
                {bidSuggestion && (
                  <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-fpl-muted">Suggested Bids</span>
                      <span
                        className={
                          bidSuggestion.shouldPursue
                            ? "text-fpl-green"
                            : "text-fpl-muted"
                        }
                      >
                        {bidSuggestion.shouldPursue
                          ? "Worth pursuing"
                          : "Low priority"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-fpl-muted">Min</p>
                        <p className="font-medium">{bidSuggestion.minBid}</p>
                      </div>
                      <div>
                        <p className="text-xs text-fpl-muted">Recommended</p>
                        <p className="font-medium text-fpl-green">
                          {bidSuggestion.recommendedBid}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-fpl-muted">Max</p>
                        <p className="font-medium">{bidSuggestion.maxBid}</p>
                      </div>
                    </div>
                    <p className="text-xs text-fpl-muted mt-2">
                      {bidSuggestion.reasoning}
                    </p>
                  </div>
                )}

                {/* Bid Input */}
                <div className="mb-4">
                  <label className="block text-sm text-fpl-muted mb-2">
                    Your Bid
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={budget}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(Number(e.target.value))}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min={1}
                      max={budget}
                      value={bidAmount}
                      onChange={(e) =>
                        setBidAmount(
                          Math.min(budget, Math.max(1, Number(e.target.value))),
                        )
                      }
                      className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-center"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleWinBid}
                    disabled={bidAmount > budget}
                    className="flex-1 py-2 px-4 bg-fpl-green hover:bg-fpl-green/80 text-black rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Win for {bidAmount}
                  </button>
                  <button
                    onClick={handleSkip}
                    className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nominate a Player</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm mb-3"
                />

                {/* Player List */}
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {filteredPlayers.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handleNominate(player)}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <PositionBadge
                          position={player.positionId}
                          label={player.position}
                        />
                        <span className="font-medium">{player.name}</span>
                        <span className="text-xs text-fpl-muted">
                          {player.teamShort}
                        </span>
                      </div>
                      <span className="text-xs text-fpl-muted">
                        ADP {player.estimatedADP}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Value Targets */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Value Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-fpl-muted mb-2">
                Players to nominate for potential value
              </p>
              <div className="space-y-1">
                {valueTargets.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handleNominate(player)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <PositionBadge
                        position={player.positionId}
                        label={player.position}
                      />
                      <span>{player.name}</span>
                    </div>
                    <Badge variant="green">+{player.valueVsADP}</Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Roster */}
        <div className="space-y-4">
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

              {/* Roster List with Prices */}
              <div className="space-y-1 max-h-64 overflow-y-auto">
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

          {/* Spending Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Spending Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-fpl-muted">Players Won</span>
                  <span>{state.userRoster.filter((s) => s.player).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fpl-muted">Budget Spent</span>
                  <span>{initialBudget - budget}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fpl-muted">Budget Remaining</span>
                  <span className="text-fpl-green font-medium">{budget}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fpl-muted">Slots Remaining</span>
                  <span>
                    {state.userRoster.filter((s) => !s.player).length}
                  </span>
                </div>
                {state.userRoster.filter((s) => !s.player).length > 0 && (
                  <div className="flex justify-between pt-2 border-t border-gray-700">
                    <span className="text-fpl-muted">Avg Per Slot</span>
                    <span className="font-medium">
                      {(
                        budget /
                        state.userRoster.filter((s) => !s.player).length
                      ).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
});
