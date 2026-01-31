"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useInjuryPrediction } from "@/lib/claude/simulator-hooks";
import type { InjuredPlayer } from "@/lib/claude/simulator-types";

interface InjuryPredictorProps {
  player: InjuredPlayer;
  currentGameweek: number;
  hasPlayer?: boolean;
  replacementOptions?: string[];
}

export function InjuryPredictor({
  player,
  currentGameweek,
  hasPlayer = false,
  replacementOptions = [],
}: InjuryPredictorProps) {
  const { predict, response, isLoading, error } = useInjuryPrediction();

  const handlePredict = async () => {
    await predict({
      player,
      currentGameweek,
      squadContext: {
        hasPlayer,
        replacementOptions,
      },
    });
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "bg-green-500/20 text-green-400";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400";
      case "low":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case "hold":
        return { bg: "bg-blue-500/20", text: "text-blue-400", icon: "⏳" };
      case "sell":
        return { bg: "bg-red-500/20", text: "text-red-400", icon: "📉" };
      case "buy":
        return { bg: "bg-green-500/20", text: "text-green-400", icon: "📈" };
      case "wait_and_see":
        return { bg: "bg-yellow-500/20", text: "text-yellow-400", icon: "👀" };
      default:
        return { bg: "bg-gray-500/20", text: "text-gray-400", icon: "❓" };
    }
  };

  const recStyle = response
    ? getRecommendationStyle(response.prediction.recommendation)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-xl">🏥</span>
          Injury Return Predictor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Player Info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {player.name}
              </h3>
              <p className="text-sm text-gray-400">
                {player.team} • {player.position} • £{player.price}m
              </p>
            </div>
            {player.chanceOfPlaying !== null && (
              <Badge
                className={
                  player.chanceOfPlaying >= 75
                    ? "bg-green-500/20 text-green-400"
                    : player.chanceOfPlaying >= 25
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                }
              >
                {player.chanceOfPlaying}% chance
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-red-400">🩹</span>
              <div>
                <p className="text-sm font-medium text-gray-300">
                  Injury: {player.injuryType}
                </p>
                <p className="text-sm text-gray-400">{player.news}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <p className="text-xs text-gray-500">Form (pre-injury)</p>
                <p className="text-white font-medium">
                  {player.formBeforeInjury.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">xPts/Game</p>
                <p className="text-white font-medium">
                  {player.expectedPointsPerGame.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">News Added</p>
                <p className="text-white font-medium text-sm">
                  {player.newsAdded || "Unknown"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Predict Button */}
        <button
          onClick={handlePredict}
          disabled={isLoading}
          className="w-full bg-fpl-purple hover:bg-fpl-purple/80 disabled:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="animate-spin">⚙️</span>
              Analyzing Injury Data...
            </>
          ) : (
            <>
              <span>🧠</span>
              Predict Return Timeline
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
        {response && recStyle && (
          <div className="space-y-4 pt-4 border-t border-gray-700">
            {/* Main Prediction */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 uppercase mb-1">
                  Estimated Return
                </p>
                <p className="text-3xl font-bold text-fpl-green">
                  GW{response.prediction.estimatedReturnGW}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Range: GW{response.prediction.returnRange.earliest} - GW
                  {response.prediction.returnRange.latest}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 uppercase mb-1">
                  Recommendation
                </p>
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${recStyle.bg}`}
                >
                  <span>{recStyle.icon}</span>
                  <span className={`font-bold uppercase ${recStyle.text}`}>
                    {response.prediction.recommendation.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Confidence & xPts */}
            <div className="flex items-center justify-between bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Confidence:</span>
                <Badge
                  className={getConfidenceColor(response.prediction.confidence)}
                >
                  {response.prediction.confidence.toUpperCase()}
                </Badge>
              </div>
              <div className="text-right">
                <span className="text-gray-400">xPts on Return:</span>
                <span className="ml-2 text-white font-medium">
                  {response.prediction.expectedPointsOnReturn.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Historical Precedent */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-2">
                Historical Precedent
              </h4>
              <p className="text-white">
                {response.prediction.historicalPrecedent}
              </p>
            </div>

            {/* Reasoning */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-2">
                Analysis
              </h4>
              <p className="text-white">{response.prediction.reasoning}</p>
            </div>

            {/* Risks */}
            {response.prediction.risks.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Risks
                </h4>
                <ul className="space-y-1">
                  {response.prediction.risks.map((risk, i) => (
                    <li key={i} className="text-white flex items-start gap-2">
                      <span className="text-red-400">⚠</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Monitoring Indicators */}
            {response.prediction.monitoringIndicators.length > 0 && (
              <div className="bg-gradient-to-r from-fpl-purple/20 to-blue-500/20 rounded-lg p-4 border border-fpl-purple/30">
                <h4 className="text-sm font-medium text-fpl-green mb-2">
                  What to Watch
                </h4>
                <ul className="space-y-1">
                  {response.prediction.monitoringIndicators.map(
                    (indicator, i) => (
                      <li key={i} className="text-white flex items-start gap-2">
                        <span className="text-blue-400">👁</span>
                        {indicator}
                      </li>
                    ),
                  )}
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
