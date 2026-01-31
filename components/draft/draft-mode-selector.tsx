"use client";

import { useState, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DraftMode, DraftSettings } from "@/lib/fpl/draft-types";

interface DraftModeSelectorProps {
  onStartDraft: (settings: DraftSettings) => void;
  defaultSettings: DraftSettings;
}

export const DraftModeSelector = memo(function DraftModeSelector({
  onStartDraft,
  defaultSettings,
}: DraftModeSelectorProps) {
  const [mode, setMode] = useState<DraftMode>(defaultSettings.mode);
  const [leagueSize, setLeagueSize] = useState(defaultSettings.leagueSize);
  const [draftPosition, setDraftPosition] = useState(
    defaultSettings.userDraftPosition,
  );
  const [auctionBudget, setAuctionBudget] = useState(
    defaultSettings.auctionBudget ?? 200,
  );

  const handleSubmit = () => {
    onStartDraft({
      mode,
      leagueSize,
      userDraftPosition: draftPosition,
      auctionBudget: mode === "auction" ? auctionBudget : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Draft Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Toggle */}
        <div>
          <label className="block text-sm font-medium text-fpl-muted mb-2">
            Draft Mode
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("snake")}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === "snake"
                  ? "bg-fpl-purple text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <span className="block text-base mb-1">🐍 Snake Draft</span>
              <span className="block text-xs opacity-75">
                Traditional pick order that reverses each round
              </span>
            </button>
            <button
              onClick={() => setMode("auction")}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === "auction"
                  ? "bg-fpl-purple text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <span className="block text-base mb-1">💰 Auction Draft</span>
              <span className="block text-xs opacity-75">
                Bid on players with a set budget
              </span>
            </button>
          </div>
        </div>

        {/* League Size */}
        <div>
          <label className="block text-sm font-medium text-fpl-muted mb-2">
            League Size
          </label>
          <div className="flex gap-2 flex-wrap">
            {[4, 6, 8, 10, 12, 14, 16].map((size) => (
              <button
                key={size}
                onClick={() => {
                  setLeagueSize(size);
                  if (draftPosition > size) {
                    setDraftPosition(1);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  leagueSize === size
                    ? "bg-fpl-green text-black"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <p className="text-xs text-fpl-muted mt-1">
            Number of managers in your draft league
          </p>
        </div>

        {/* Draft Position (Snake only) */}
        {mode === "snake" && (
          <div>
            <label className="block text-sm font-medium text-fpl-muted mb-2">
              Your Draft Position
            </label>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: leagueSize }, (_, i) => i + 1).map(
                (pos) => (
                  <button
                    key={pos}
                    onClick={() => setDraftPosition(pos)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      draftPosition === pos
                        ? "bg-fpl-green text-black"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {pos}
                  </button>
                ),
              )}
            </div>
            <p className="text-xs text-fpl-muted mt-1">
              Position 1 picks first in odd rounds, last in even rounds
            </p>
          </div>
        )}

        {/* Auction Budget */}
        {mode === "auction" && (
          <div>
            <label className="block text-sm font-medium text-fpl-muted mb-2">
              Starting Budget
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="100"
                max="300"
                step="10"
                value={auctionBudget}
                onChange={(e) => setAuctionBudget(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-16 text-right font-medium text-fpl-green">
                {auctionBudget}
              </span>
            </div>
            <p className="text-xs text-fpl-muted mt-1">
              Standard FPL draft uses 200 budget
            </p>
          </div>
        )}

        {/* Draft Position Info for Snake */}
        {mode === "snake" && (
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">Your First 4 Picks</h4>
            <div className="flex gap-4 text-sm">
              {[1, 2, 3, 4].map((round) => {
                const isReverse = round % 2 === 0;
                const pick = isReverse
                  ? (round - 1) * leagueSize + (leagueSize - draftPosition + 1)
                  : (round - 1) * leagueSize + draftPosition;
                return (
                  <div key={round} className="text-center">
                    <div className="text-fpl-muted text-xs">Round {round}</div>
                    <div className="font-medium text-fpl-green">#{pick}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleSubmit}
          className="w-full py-3 px-4 bg-fpl-purple hover:bg-fpl-purple/80 text-white rounded-lg font-medium transition-colors"
        >
          Start {mode === "snake" ? "Snake" : "Auction"} Draft
        </button>
      </CardContent>
    </Card>
  );
});
