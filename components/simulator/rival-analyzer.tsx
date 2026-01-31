"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRivalAnalysis } from "@/lib/claude/simulator-hooks";
import type {
  RivalProfile,
  SimulationPlayer,
  FixtureContext,
} from "@/lib/claude/simulator-types";

interface RivalAnalyzerProps {
  rival: RivalProfile;
  yourSquad: SimulationPlayer[];
  upcomingFixtures: FixtureContext[];
  currentGameweek: number;
}

export function RivalAnalyzer({
  rival,
  yourSquad,
  upcomingFixtures,
  currentGameweek,
}: RivalAnalyzerProps) {
  const { analyze, response, isLoading, error } = useRivalAnalysis();

  const handleAnalyze = async () => {
    await analyze({
      rival,
      yourSquad,
      upcomingFixtures,
      currentGameweek,
    });
  };

  const getPlayStyleColor = (style: string) => {
    switch (style) {
      case "aggressive":
        return "bg-red-500/20 text-red-400";
      case "differential":
        return "bg-purple-500/20 text-purple-400";
      case "template":
        return "bg-blue-500/20 text-blue-400";
      case "conservative":
        return "bg-gray-500/20 text-gray-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return "text-green-400";
    if (confidence >= 0.4) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔍</span>
            Rival Gameplan Analyzer
          </div>
          <Badge
            className={
              rival.pointsGap > 0
                ? "bg-red-500/20 text-red-400"
                : "bg-green-500/20 text-green-400"
            }
          >
            {rival.pointsGap > 0
              ? `${rival.pointsGap} pts behind`
              : `${Math.abs(rival.pointsGap)} pts ahead`}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rival Info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">{rival.name}</h3>
              <p className="text-sm text-gray-400">
                Rank #{rival.rank.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Chips Used</p>
              <div className="flex gap-1 mt-1">
                {rival.chipsUsed.length > 0 ? (
                  rival.chipsUsed.map((c, i) => (
                    <Badge
                      key={i}
                      className="bg-gray-700 text-gray-300 text-xs"
                    >
                      {c.chip} (GW{c.gameweek})
                    </Badge>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">None</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="w-full bg-fpl-purple hover:bg-fpl-purple/80 disabled:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="animate-spin">⚙️</span>
              Analyzing Rival Strategy...
            </>
          ) : (
            <>
              <span>🧠</span>
              Predict Rival Moves
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
            {/* Play Style */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Playing Style</span>
              <Badge
                className={getPlayStyleColor(response.prediction.playStyle)}
              >
                {response.prediction.playStyle.charAt(0).toUpperCase() +
                  response.prediction.playStyle.slice(1)}
              </Badge>
            </div>

            {/* Predicted Captain */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-400">
                  Predicted Captain (GW{currentGameweek})
                </h4>
                <span
                  className={`text-sm ${getConfidenceColor(response.prediction.predictedCaptain.confidence)}`}
                >
                  {(
                    response.prediction.predictedCaptain.confidence * 100
                  ).toFixed(0)}
                  % confident
                </span>
              </div>
              <p className="text-xl font-bold text-white mb-1">
                👑 {response.prediction.predictedCaptain.player}
              </p>
              <p className="text-sm text-gray-400">
                {response.prediction.predictedCaptain.reasoning}
              </p>
            </div>

            {/* Predicted Chip */}
            {response.prediction.predictedChip && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-400">
                    Predicted Chip Usage
                  </h4>
                  <span
                    className={`text-sm ${getConfidenceColor(response.prediction.predictedChip.confidence)}`}
                  >
                    {(
                      response.prediction.predictedChip.confidence * 100
                    ).toFixed(0)}
                    % confident
                  </span>
                </div>
                <p className="text-xl font-bold text-fpl-green mb-1">
                  🎯 {response.prediction.predictedChip.chip} in GW
                  {response.prediction.predictedChip.gameweek}
                </p>
                <p className="text-sm text-gray-400">
                  {response.prediction.predictedChip.reasoning}
                </p>
              </div>
            )}

            {/* Predicted Transfers */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-2">
                Likely Transfers
              </h4>
              {response.prediction.predictedTransfers.likely.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-2">
                  {response.prediction.predictedTransfers.likely.map(
                    (player, i) => (
                      <Badge key={i} className="bg-fpl-green/20 text-fpl-green">
                        + {player}
                      </Badge>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm mb-2">
                  No transfers predicted
                </p>
              )}
              <p className="text-sm text-gray-400">
                {response.prediction.predictedTransfers.reasoning}
              </p>
            </div>

            {/* Weaknesses */}
            {response.prediction.weaknesses.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Weaknesses to Exploit
                </h4>
                <ul className="space-y-1">
                  {response.prediction.weaknesses.map((weakness, i) => (
                    <li key={i} className="text-white flex items-start gap-2">
                      <span className="text-red-400">⚠</span>
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Counter Strategy */}
            {response.prediction.counterStrategy.length > 0 && (
              <div className="bg-gradient-to-r from-fpl-purple/20 to-fpl-green/20 rounded-lg p-4 border border-fpl-purple/30">
                <h4 className="text-sm font-medium text-fpl-green mb-2">
                  Counter Strategy
                </h4>
                <ul className="space-y-2">
                  {response.prediction.counterStrategy.map((strategy, i) => (
                    <li key={i} className="text-white flex items-start gap-2">
                      <span className="text-fpl-green font-bold">{i + 1}.</span>
                      {strategy}
                    </li>
                  ))}
                </ul>
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
