"use client";

import type {
  PlayerComparisonData,
  CaptainRecommendationData,
  TransferRecommendationData,
} from "@/lib/chat/types";

/**
 * Renders structured data responses in a rich format
 */
export function StructuredResponse({
  type,
  data,
}: {
  type: "comparison" | "captain" | "transfer";
  data: unknown;
}) {
  switch (type) {
    case "comparison":
      return <PlayerComparison data={data as PlayerComparisonData} />;
    case "captain":
      return (
        <CaptainRecommendations data={data as CaptainRecommendationData} />
      );
    case "transfer":
      return (
        <TransferRecommendations data={data as TransferRecommendationData} />
      );
    default:
      return null;
  }
}

function PlayerComparison({ data }: { data: PlayerComparisonData }) {
  if (!data.players || data.players.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-fpl-border">
            <th className="px-2 py-1 text-left font-medium">Player</th>
            <th className="px-2 py-1 text-center font-medium">Price</th>
            <th className="px-2 py-1 text-center font-medium">Pts</th>
            <th className="px-2 py-1 text-center font-medium">Form</th>
            <th className="px-2 py-1 text-center font-medium">xGI</th>
            <th className="px-2 py-1 text-center font-medium">Pts/£m</th>
          </tr>
        </thead>
        <tbody>
          {data.players.map((player) => (
            <tr key={player.id} className="border-b border-fpl-border/50">
              <td className="px-2 py-1">
                <div>
                  <span className="font-medium">{player.name}</span>
                  <span className="ml-1 text-fpl-muted">
                    ({player.team} {player.position})
                  </span>
                </div>
              </td>
              <td className="px-2 py-1 text-center">{player.price}</td>
              <td className="px-2 py-1 text-center">{player.totalPoints}</td>
              <td className="px-2 py-1 text-center">{player.form}</td>
              <td className="px-2 py-1 text-center">{player.xGI.toFixed(1)}</td>
              <td className="px-2 py-1 text-center">
                {player.pointsPerMillion}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CaptainRecommendations({ data }: { data: CaptainRecommendationData }) {
  if (!data.recommendations || data.recommendations.length === 0) return null;

  return (
    <div className="space-y-2">
      {data.recommendations.map((rec) => (
        <div
          key={rec.rank}
          className="flex items-center gap-3 rounded-lg border border-fpl-border/50 bg-black/5 p-2"
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              rec.rank === 1
                ? "bg-yellow-500 text-black"
                : rec.rank === 2
                  ? "bg-gray-300 text-black"
                  : rec.rank === 3
                    ? "bg-amber-600 text-white"
                    : "bg-fpl-card-alt text-fpl-text"
            }`}
          >
            {rec.rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{rec.player.name}</span>
              <span className="text-xs text-fpl-muted">
                {rec.player.team} · {rec.player.position}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-fpl-muted">
              <span>
                {rec.isHome ? "vs" : "@"} {rec.opponent}
              </span>
              <span
                className={`rounded px-1 ${
                  rec.difficulty <= 2
                    ? "bg-green-500/20 text-green-400"
                    : rec.difficulty >= 4
                      ? "bg-red-500/20 text-red-400"
                      : "bg-gray-500/20 text-gray-400"
                }`}
              >
                FDR {rec.difficulty}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-fpl-green">
              {rec.score.toFixed(1)}
            </div>
            <div className="text-xs text-fpl-muted">score</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TransferRecommendations({
  data,
}: {
  data: TransferRecommendationData;
}) {
  if (!data.recommendations || data.recommendations.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-fpl-border">
            <th className="px-2 py-1 text-left font-medium">#</th>
            <th className="px-2 py-1 text-left font-medium">Player</th>
            <th className="px-2 py-1 text-center font-medium">Price</th>
            <th className="px-2 py-1 text-center font-medium">FDR</th>
            <th className="px-2 py-1 text-center font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {data.recommendations.map((rec) => (
            <tr key={rec.rank} className="border-b border-fpl-border/50">
              <td className="px-2 py-1 font-medium">{rec.rank}</td>
              <td className="px-2 py-1">
                <div>
                  <span className="font-medium">{rec.player.name}</span>
                  <span className="ml-1 text-fpl-muted">
                    ({rec.player.team} {rec.player.position})
                  </span>
                </div>
              </td>
              <td className="px-2 py-1 text-center">{rec.player.price}</td>
              <td className="px-2 py-1 text-center">
                <span
                  className={`rounded px-1 ${
                    rec.upcomingDifficulty <= 2.5
                      ? "bg-green-500/20 text-green-400"
                      : rec.upcomingDifficulty >= 3.5
                        ? "bg-red-500/20 text-red-400"
                        : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {rec.upcomingDifficulty.toFixed(1)}
                </span>
              </td>
              <td className="px-2 py-1 text-center font-medium text-fpl-green">
                {rec.score.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
