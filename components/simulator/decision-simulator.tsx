"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSimulation } from "@/lib/claude/simulator-hooks";
import type {
  SimulationAction,
  SimulationPlayer,
  SimulationLeagueContext,
} from "@/lib/claude/simulator-types";

interface DecisionSimulatorProps {
  squad: SimulationPlayer[];
  currentGameweek: number;
  leagueContext?: SimulationLeagueContext;
}

export function DecisionSimulator({
  squad,
  currentGameweek,
  leagueContext,
}: DecisionSimulatorProps) {
  const { simulate, response, isLoading, error, reset } = useSimulation();
  const [actionType, setActionType] =
    useState<SimulationAction["type"]>("captain_change");
  const [captainFrom, setCaptainFrom] = useState("");
  const [captainTo, setCaptainTo] = useState("");
  const [transferOut, setTransferOut] = useState("");
  const [transferIn, setTransferIn] = useState("");
  const [transferCost, setTransferCost] = useState(0);
  const [chipType, setChipType] = useState<
    "freehit" | "wildcard" | "benchboost" | "triplecaptain"
  >("benchboost");
  const [holdDescription, setHoldDescription] = useState("");

  const handleSimulate = async () => {
    let action: SimulationAction;

    switch (actionType) {
      case "captain_change":
        action = { type: "captain_change", from: captainFrom, to: captainTo };
        break;
      case "transfer":
        action = {
          type: "transfer",
          out: transferOut,
          in: transferIn,
          cost: transferCost,
        };
        break;
      case "chip":
        action = { type: "chip", chip: chipType, gameweek: currentGameweek };
        break;
      case "hold":
        action = {
          type: "hold",
          description: holdDescription || "Save transfer",
        };
        break;
      default:
        return;
    }

    await simulate({
      squad,
      action,
      leagueContext,
      currentGameweek,
    });
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "bg-green-500/20 text-green-400";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400";
      case "high":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          GW Decision Simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Action Type Selector */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-300">
            Action Type
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "captain_change", label: "Captain Change" },
              { value: "transfer", label: "Transfer" },
              { value: "chip", label: "Use Chip" },
              { value: "hold", label: "Hold" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setActionType(opt.value as SimulationAction["type"]);
                  reset();
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  actionType === opt.value
                    ? "bg-fpl-purple text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action-specific inputs */}
        {actionType === "captain_change" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Current Captain</label>
              <select
                value={captainFrom}
                onChange={(e) => setCaptainFrom(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="">Select player</option>
                {squad.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">New Captain</label>
              <select
                value={captainTo}
                onChange={(e) => setCaptainTo(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="">Select player</option>
                {squad.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} (xPts: {p.expectedPoints.toFixed(1)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {actionType === "transfer" && (
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Transfer Out</label>
              <select
                value={transferOut}
                onChange={(e) => setTransferOut(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="">Select player</option>
                {squad.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Transfer In</label>
              <input
                type="text"
                value={transferIn}
                onChange={(e) => setTransferIn(e.target.value)}
                placeholder="Player name"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Point Cost</label>
              <select
                value={transferCost}
                onChange={(e) => setTransferCost(Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                <option value={0}>Free</option>
                <option value={-4}>-4 pts</option>
                <option value={-8}>-8 pts</option>
                <option value={-12}>-12 pts</option>
              </select>
            </div>
          </div>
        )}

        {actionType === "chip" && (
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Chip to Use</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "benchboost", label: "Bench Boost", icon: "📈" },
                { value: "triplecaptain", label: "Triple Captain", icon: "👑" },
                { value: "freehit", label: "Free Hit", icon: "🎯" },
                { value: "wildcard", label: "Wildcard", icon: "🃏" },
              ].map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => setChipType(chip.value as typeof chipType)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    chipType === chip.value
                      ? "bg-fpl-green text-gray-900"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  <span>{chip.icon}</span>
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {actionType === "hold" && (
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Reason for Holding</label>
            <input
              type="text"
              value={holdDescription}
              onChange={(e) => setHoldDescription(e.target.value)}
              placeholder="e.g., Save transfer for DGW"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
        )}

        {/* Simulate Button */}
        <button
          onClick={handleSimulate}
          disabled={isLoading}
          className="w-full bg-fpl-purple hover:bg-fpl-purple/80 disabled:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="animate-spin">⚙️</span>
              Analyzing with Claude AI...
            </>
          ) : (
            <>
              <span>🧠</span>
              Simulate Decision
            </>
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {response && (
          <div className="space-y-4 pt-4 border-t border-gray-700">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 uppercase">
                  Expected Rank Change
                </p>
                <p
                  className={`text-2xl font-bold ${response.result.expectedRankChange > 0 ? "text-green-400" : response.result.expectedRankChange < 0 ? "text-red-400" : "text-gray-400"}`}
                >
                  {response.result.expectedRankChange > 0 ? "+" : ""}
                  {response.result.expectedRankChange.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 uppercase">
                  Win Probability
                </p>
                <p className="text-2xl font-bold text-fpl-green">
                  {(response.result.winProbability * 100).toFixed(0)}%
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 uppercase">Risk Level</p>
                <Badge className={getRiskColor(response.result.riskLevel)}>
                  {response.result.riskLevel.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Confidence Interval */}
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Confidence Interval</p>
              <div className="flex items-center gap-2">
                <span className="text-red-400">
                  {response.result.confidenceInterval.low.toLocaleString()}
                </span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                    style={{ width: "100%" }}
                  />
                </div>
                <span className="text-green-400">
                  +{response.result.confidenceInterval.high.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Reasoning */}
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Analysis</p>
              <p className="text-white">{response.result.reasoning}</p>
            </div>

            {/* Key Factors */}
            {response.result.keyFactors.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Key Factors</p>
                <ul className="space-y-1">
                  {response.result.keyFactors.map((factor, i) => (
                    <li key={i} className="text-white flex items-start gap-2">
                      <span className="text-fpl-green">•</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Alternatives */}
            {response.result.alternatives &&
              response.result.alternatives.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">
                    Alternative Actions
                  </p>
                  <div className="space-y-2">
                    {response.result.alternatives.map((alt, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-gray-700 rounded"
                      >
                        <span className="text-white">{alt.action}</span>
                        <span
                          className={
                            alt.expectedValue >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {alt.expectedValue >= 0 ? "+" : ""}
                          {alt.expectedValue}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Processing Time */}
            <p className="text-xs text-gray-500 text-right">
              Processed in {(response.processingTime / 1000).toFixed(1)}s
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
