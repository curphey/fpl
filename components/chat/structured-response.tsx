"use client";

import type { ToolCall } from "@/lib/chat/types";

/**
 * Detects if a tool result should be rendered as a structured response
 */
export function shouldRenderStructured(toolCall: ToolCall): boolean {
  if (!toolCall.result || toolCall.error) return false;

  const structuredTools = [
    "compare_players",
    "get_captain_recommendations",
    "get_transfer_recommendations",
    "get_fixtures",
    "get_price_changes",
    "get_my_squad",
    "search_players",
    "get_player_details",
    "get_differentials",
    "get_watchlist",
    "get_player_comparison_detailed",
  ];

  return structuredTools.includes(toolCall.name);
}

/**
 * Renders structured data responses in a rich format
 */
export function StructuredResponse({ toolCall }: { toolCall: ToolCall }) {
  if (!toolCall.result || toolCall.error) return null;

  const data = toolCall.result;

  switch (toolCall.name) {
    case "compare_players":
      return <PlayerComparison data={data as PlayerData[]} />;

    case "get_captain_recommendations":
      return <CaptainRecommendations data={data as CaptainRec[]} />;

    case "get_transfer_recommendations":
      return <TransferRecommendations data={data as TransferRec[]} />;

    case "get_fixtures":
      return <FixtureDisplay data={data} />;

    case "get_price_changes":
      return <PriceChangeAlerts data={data} />;

    case "get_my_squad":
      return <SquadDisplay data={data as SquadData} />;

    case "search_players":
      return <PlayerCards data={data as PlayerSearchResult[]} />;

    case "get_player_details":
      return <PlayerDetailCard data={data as PlayerDetail} />;

    case "get_differentials":
      return <DifferentialsDisplay data={data as DifferentialPlayer[]} />;

    case "get_watchlist":
      return <WatchlistDisplay data={data as WatchlistPlayer[]} />;

    case "get_player_comparison_detailed":
      return <DetailedComparison data={data as DetailedComparisonData[]} />;

    default:
      return null;
  }
}

// =============================================================================
// Types
// =============================================================================

interface PlayerData {
  id: number;
  name: string;
  team: string;
  position: string;
  price: string;
  totalPoints: number;
  form: number;
  ownership: string;
  xGI: number;
  pointsPerMillion: string;
}

interface CaptainRec {
  rank: number;
  player: { name: string; team: string; position: string };
  score: number;
  opponent: string;
  isHome: boolean;
  difficulty: number;
  reasoning: { form: number; fixture: number; xgi: number; setPieces: number };
}

interface TransferRec {
  rank: number;
  player: { name: string; team: string; position: string; price: string };
  score: number;
  upcomingDifficulty: number;
  reasoning: { form: number; fixture: number; value: number; xgi: number };
}

interface SquadData {
  manager: {
    name: string;
    teamName: string;
    overallPoints: number;
    overallRank: number;
  };
  teamValue: string;
  bank: string;
  squad: {
    name: string;
    team: string;
    position: string;
    price: string;
    points: number;
    form: string;
    isCaptain: boolean;
    isViceCaptain: boolean;
    isOnBench: boolean;
  }[];
}

interface PlayerSearchResult {
  id: number;
  name: string;
  team: string;
  position: string;
  price: string;
  totalPoints: number;
  form: string;
  ownership: string;
  xGI: string;
  news: string | null;
  chanceOfPlaying: number | null;
}

interface PlayerDetail {
  id: number;
  name: string;
  fullName: string;
  team: string;
  position: string;
  price: string;
  totalPoints: number;
  form: string;
  ownership: string;
  stats: {
    minutes: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    bonus: number;
    xG: string;
    xA: string;
    xGI: string;
  };
  news: string | null;
  chanceOfPlaying: number | null;
  recentHistory?: {
    gameweek: number;
    points: number;
    minutes: number;
    goals: number;
    assists: number;
    opponent: string;
    home: boolean;
  }[];
  upcomingFixtures?: {
    gameweek: number;
    opponent: string;
    home: boolean;
    difficulty: number;
  }[];
}

interface DifferentialPlayer {
  rank: number;
  player: { name: string; team: string; position: string; price: string };
  ownership: string;
  form: string;
  xGI: string;
  avgFixtureDifficulty: number;
  totalPoints: number;
}

interface WatchlistPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  price: string;
  totalPoints: number;
  form: string;
  ownership: string;
  news: string | null;
  chanceOfPlaying: number | null;
  upcomingFixtures: {
    gameweek: number;
    opponent: string;
    home: boolean;
    difficulty: number;
  }[];
  pricePrediction?: { direction: string; probability: string };
}

interface DetailedComparisonData {
  id: number;
  name: string;
  team: string;
  position: string;
  price: string;
  stats: {
    totalPoints: number;
    form: string;
    ownership: string;
    minutes: number;
    goals: number;
    assists: number;
    xGI: string;
    pointsPerGame: string;
    pointsPerMillion: string;
  };
  recentHistory?: {
    gameweek: number;
    points: number;
    opponent: string;
    home: boolean;
  }[];
  upcomingFixtures?: {
    gameweek: number;
    opponent: string;
    home: boolean;
    difficulty: number;
  }[];
}

// =============================================================================
// Components
// =============================================================================

function PlayerComparison({ data }: { data: PlayerData[] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-fpl-border/50">
      <table className="min-w-full text-xs">
        <thead className="bg-fpl-card-alt/50">
          <tr className="border-b border-fpl-border">
            <th className="px-3 py-2 text-left font-medium">Player</th>
            <th className="px-2 py-2 text-center font-medium">Price</th>
            <th className="px-2 py-2 text-center font-medium">Pts</th>
            <th className="px-2 py-2 text-center font-medium">Form</th>
            <th className="px-2 py-2 text-center font-medium">xGI</th>
            <th className="px-2 py-2 text-center font-medium">Pts/£m</th>
          </tr>
        </thead>
        <tbody>
          {data.map((player, idx) => (
            <tr
              key={player.id}
              className={`border-b border-fpl-border/30 ${idx === 0 ? "bg-fpl-green/10" : ""}`}
            >
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{player.name}</span>
                  <span className="text-fpl-muted">
                    {player.team} · {player.position}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2 text-center">{player.price}</td>
              <td className="px-2 py-2 text-center font-medium">
                {player.totalPoints}
              </td>
              <td className="px-2 py-2 text-center">
                <FormBadge value={player.form} />
              </td>
              <td className="px-2 py-2 text-center">
                {typeof player.xGI === "number"
                  ? player.xGI.toFixed(1)
                  : player.xGI}
              </td>
              <td className="px-2 py-2 text-center text-fpl-green">
                {player.pointsPerMillion}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CaptainRecommendations({ data }: { data: CaptainRec[] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-2">
      {data.map((rec) => (
        <div
          key={rec.rank}
          className={`flex items-center gap-3 rounded-lg border p-3 ${
            rec.rank === 1
              ? "border-yellow-500/50 bg-yellow-500/10"
              : "border-fpl-border/50 bg-black/5"
          }`}
        >
          <RankBadge rank={rec.rank} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{rec.player.name}</span>
              <span className="text-xs text-fpl-muted">
                {rec.player.team} · {rec.player.position}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="text-fpl-muted">
                {rec.isHome ? "vs" : "@"} {rec.opponent}
              </span>
              <FDRBadge difficulty={rec.difficulty} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-fpl-green">
              {rec.score.toFixed(1)}
            </div>
            <div className="text-xs text-fpl-muted">score</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TransferRecommendations({ data }: { data: TransferRec[] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-fpl-border/50">
      <table className="min-w-full text-xs">
        <thead className="bg-fpl-card-alt/50">
          <tr className="border-b border-fpl-border">
            <th className="w-8 px-2 py-2 text-center font-medium">#</th>
            <th className="px-3 py-2 text-left font-medium">Player</th>
            <th className="px-2 py-2 text-center font-medium">Price</th>
            <th className="px-2 py-2 text-center font-medium">FDR</th>
            <th className="px-2 py-2 text-center font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((rec) => (
            <tr key={rec.rank} className="border-b border-fpl-border/30">
              <td className="px-2 py-2 text-center">
                <RankBadge rank={rec.rank} size="sm" />
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{rec.player.name}</span>
                  <span className="text-fpl-muted">
                    {rec.player.team} · {rec.player.position}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2 text-center">{rec.player.price}</td>
              <td className="px-2 py-2 text-center">
                <FDRBadge difficulty={rec.upcomingDifficulty} />
              </td>
              <td className="px-2 py-2 text-center font-medium text-fpl-green">
                {rec.score.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FixtureDisplay({ data }: { data: unknown }) {
  // Handle team-specific fixtures
  if (
    data &&
    typeof data === "object" &&
    "team" in data &&
    "fixtures" in data
  ) {
    const teamData = data as {
      team: string;
      fixtures: {
        gameweek: number;
        opponent: string;
        isHome: boolean;
        difficulty: number;
      }[];
    };

    return (
      <div className="rounded-lg border border-fpl-border/50 p-3">
        <div className="mb-2 font-medium">{teamData.team} Fixtures</div>
        <div className="flex gap-1 overflow-x-auto">
          {teamData.fixtures.map((f) => (
            <div
              key={f.gameweek}
              className="flex flex-col items-center rounded p-2"
              style={{ backgroundColor: getFDRColor(f.difficulty) }}
            >
              <div className="text-xs font-medium text-white/80">
                GW{f.gameweek}
              </div>
              <div className="text-sm font-bold text-white">
                {f.isHome ? "" : "@"}
                {f.opponent}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Handle all fixtures list
  if (Array.isArray(data)) {
    const fixtures = data as {
      gameweek: number;
      homeTeam: string;
      awayTeam: string;
      homeDifficulty: number;
      awayDifficulty: number;
    }[];

    // Group by gameweek
    const byGameweek = fixtures.reduce(
      (acc, f) => {
        const gw = f.gameweek;
        if (!acc[gw]) acc[gw] = [];
        acc[gw].push(f);
        return acc;
      },
      {} as Record<number, typeof fixtures>,
    );

    return (
      <div className="space-y-3">
        {Object.entries(byGameweek)
          .slice(0, 3)
          .map(([gw, gfs]) => (
            <div key={gw}>
              <div className="mb-1 text-xs font-medium text-fpl-muted">
                Gameweek {gw}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {gfs.slice(0, 6).map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded bg-fpl-card-alt/50 px-2 py-1"
                  >
                    <span>{f.homeTeam}</span>
                    <span className="text-fpl-muted">vs</span>
                    <span>{f.awayTeam}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    );
  }

  return null;
}

function PriceChangeAlerts({ data }: { data: unknown }) {
  // Handle combined risers/fallers response
  if (
    data &&
    typeof data === "object" &&
    "risers" in data &&
    "fallers" in data
  ) {
    const priceData = data as {
      risers: PriceCandidate[];
      fallers: PriceCandidate[];
    };

    return (
      <div className="space-y-3">
        {priceData.risers.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-green-400">
              <span className="text-lg">↑</span> Likely to Rise
            </div>
            <div className="space-y-1">
              {priceData.risers.slice(0, 5).map((p, i) => (
                <PriceCandidateRow key={i} player={p} />
              ))}
            </div>
          </div>
        )}
        {priceData.fallers.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-red-400">
              <span className="text-lg">↓</span> Likely to Fall
            </div>
            <div className="space-y-1">
              {priceData.fallers.slice(0, 5).map((p, i) => (
                <PriceCandidateRow key={i} player={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Handle single direction array
  if (Array.isArray(data)) {
    return (
      <div className="space-y-1">
        {(data as PriceCandidate[]).slice(0, 8).map((p, i) => (
          <PriceCandidateRow key={i} player={p} />
        ))}
      </div>
    );
  }

  return null;
}

interface PriceCandidate {
  player: { name: string; team: string; position: string; price: string };
  direction: string;
  probability: number;
  netTransfers: number;
}

function PriceCandidateRow({ player }: { player: PriceCandidate }) {
  const isRise = player.direction === "rise";

  return (
    <div className="flex items-center gap-2 rounded bg-fpl-card-alt/30 px-2 py-1.5 text-xs">
      <span
        className={`text-sm font-bold ${isRise ? "text-green-400" : "text-red-400"}`}
      >
        {isRise ? "↑" : "↓"}
      </span>
      <span className="flex-1 font-medium">{player.player.name}</span>
      <span className="text-fpl-muted">
        {player.player.team} · {player.player.position}
      </span>
      <span className="text-fpl-muted">{player.player.price}</span>
      <span
        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
          isRise
            ? "bg-green-500/20 text-green-400"
            : "bg-red-500/20 text-red-400"
        }`}
      >
        {player.probability}%
      </span>
    </div>
  );
}

function SquadDisplay({ data }: { data: SquadData }) {
  if (!data || !data.squad) return null;

  const starters = data.squad.filter((p) => !p.isOnBench);
  const bench = data.squad.filter((p) => p.isOnBench);

  return (
    <div className="space-y-3">
      {/* Manager info */}
      <div className="rounded-lg border border-fpl-border/50 bg-fpl-card-alt/30 p-3">
        <div className="font-medium">{data.manager.teamName}</div>
        <div className="mt-1 flex gap-4 text-xs text-fpl-muted">
          <span>Rank: {data.manager.overallRank?.toLocaleString()}</span>
          <span>Points: {data.manager.overallPoints}</span>
          <span>Value: {data.teamValue}</span>
          <span>Bank: {data.bank}</span>
        </div>
      </div>

      {/* Starting XI */}
      <div>
        <div className="mb-2 text-xs font-medium text-fpl-muted">
          Starting XI
        </div>
        <div className="grid gap-1">
          {starters.map((p, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
                p.isCaptain
                  ? "bg-yellow-500/20 border border-yellow-500/30"
                  : "bg-fpl-card-alt/30"
              }`}
            >
              <PositionBadge position={p.position} />
              <span className="flex-1 font-medium">
                {p.name}
                {p.isCaptain && " (C)"}
                {p.isViceCaptain && " (VC)"}
              </span>
              <span className="text-fpl-muted">{p.team}</span>
              <span className="text-fpl-muted">{p.price}</span>
              <span className="font-medium">{p.points} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-fpl-muted">Bench</div>
          <div className="grid gap-1 opacity-60">
            {bench.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded bg-fpl-card-alt/20 px-2 py-1 text-xs"
              >
                <PositionBadge position={p.position} />
                <span className="flex-1">{p.name}</span>
                <span className="text-fpl-muted">{p.team}</span>
                <span className="text-fpl-muted">{p.price}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerCards({ data }: { data: PlayerSearchResult[] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="grid gap-2">
      {data.slice(0, 8).map((player) => (
        <div
          key={player.id}
          className="flex items-center gap-3 rounded-lg border border-fpl-border/50 bg-fpl-card-alt/30 p-2"
        >
          <PositionBadge position={player.position} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{player.name}</span>
              <span className="text-xs text-fpl-muted">{player.team}</span>
              {player.news && (
                <span className="text-xs text-yellow-400" title={player.news}>
                  ⚠️
                </span>
              )}
            </div>
            <div className="flex gap-3 text-xs text-fpl-muted">
              <span>{player.price}</span>
              <span>{player.totalPoints} pts</span>
              <span>Form: {player.form}</span>
              <span>{player.ownership}</span>
            </div>
          </div>
          {player.chanceOfPlaying !== null && player.chanceOfPlaying < 100 && (
            <ChanceOfPlayingBadge chance={player.chanceOfPlaying} />
          )}
        </div>
      ))}
    </div>
  );
}

function PlayerDetailCard({ data }: { data: PlayerDetail }) {
  if (!data) return null;

  return (
    <div className="space-y-3 rounded-lg border border-fpl-border/50 p-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{data.name}</span>
            <PositionBadge position={data.position} />
          </div>
          <div className="text-sm text-fpl-muted">
            {data.team} · {data.price} · {data.ownership}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-fpl-green">
            {data.totalPoints}
          </div>
          <div className="text-xs text-fpl-muted">total points</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <StatBox label="Goals" value={data.stats.goals} />
        <StatBox label="Assists" value={data.stats.assists} />
        <StatBox label="CS" value={data.stats.cleanSheets} />
        <StatBox label="Bonus" value={data.stats.bonus} />
      </div>

      {/* xG stats */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <StatBox label="xG" value={data.stats.xG} />
        <StatBox label="xA" value={data.stats.xA} />
        <StatBox label="xGI" value={data.stats.xGI} />
      </div>

      {/* News */}
      {data.news && (
        <div className="rounded bg-yellow-500/10 p-2 text-xs text-yellow-400">
          {data.news}
        </div>
      )}

      {/* Upcoming fixtures */}
      {data.upcomingFixtures && data.upcomingFixtures.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-fpl-muted">
            Upcoming Fixtures
          </div>
          <div className="flex gap-1">
            {data.upcomingFixtures.map((f) => (
              <div
                key={f.gameweek}
                className="flex flex-col items-center rounded p-1.5 text-xs"
                style={{ backgroundColor: getFDRColor(f.difficulty) }}
              >
                <span className="text-white/70">GW{f.gameweek}</span>
                <span className="font-medium text-white">
                  {f.home ? "" : "@"}
                  {f.opponent}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DifferentialsDisplay({ data }: { data: DifferentialPlayer[] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-2">
      {data.slice(0, 8).map((p) => (
        <div
          key={p.rank}
          className="flex items-center gap-3 rounded-lg border border-fpl-border/50 bg-fpl-card-alt/30 p-2"
        >
          <RankBadge rank={p.rank} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{p.player.name}</span>
              <span className="text-xs text-fpl-muted">
                {p.player.team} · {p.player.position}
              </span>
            </div>
            <div className="flex gap-3 text-xs text-fpl-muted">
              <span className="text-fpl-green">{p.ownership}</span>
              <span>Form: {p.form}</span>
              <span>xGI: {p.xGI}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm">{p.player.price}</div>
            <FDRBadge difficulty={p.avgFixtureDifficulty} />
          </div>
        </div>
      ))}
    </div>
  );
}

function WatchlistDisplay({ data }: { data: WatchlistPlayer[] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-2">
      {data.map((p) => (
        <div
          key={p.id}
          className="rounded-lg border border-fpl-border/50 bg-fpl-card-alt/30 p-3"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <PositionBadge position={p.position} />
                {p.news && (
                  <span className="text-yellow-400" title={p.news}>
                    ⚠️
                  </span>
                )}
              </div>
              <div className="text-xs text-fpl-muted">
                {p.team} · {p.price} · {p.ownership}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold">{p.totalPoints} pts</div>
              <div className="text-xs text-fpl-muted">Form: {p.form}</div>
            </div>
          </div>

          {/* Price prediction */}
          {p.pricePrediction && (
            <div
              className={`mt-2 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                p.pricePrediction.direction === "rise"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {p.pricePrediction.direction === "rise" ? "↑" : "↓"} Price{" "}
              {p.pricePrediction.direction} ({p.pricePrediction.probability})
            </div>
          )}

          {/* Fixtures */}
          {p.upcomingFixtures && p.upcomingFixtures.length > 0 && (
            <div className="mt-2 flex gap-1">
              {p.upcomingFixtures.map((f) => (
                <div
                  key={f.gameweek}
                  className="rounded px-2 py-1 text-xs"
                  style={{ backgroundColor: getFDRColor(f.difficulty) }}
                >
                  <span className="text-white">
                    {f.home ? "" : "@"}
                    {f.opponent}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DetailedComparison({ data }: { data: DetailedComparisonData[] }) {
  if (!data || data.length < 2) return null;

  return (
    <div className="space-y-4">
      {/* Stats comparison */}
      <div className="overflow-x-auto rounded-lg border border-fpl-border/50">
        <table className="min-w-full text-xs">
          <thead className="bg-fpl-card-alt/50">
            <tr className="border-b border-fpl-border">
              <th className="px-3 py-2 text-left font-medium">Stat</th>
              {data.map((p) => (
                <th key={p.id} className="px-3 py-2 text-center font-medium">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ComparisonRow
              label="Team"
              values={data.map((p) => `${p.team} (${p.position})`)}
            />
            <ComparisonRow label="Price" values={data.map((p) => p.price)} />
            <ComparisonRow
              label="Points"
              values={data.map((p) => p.stats.totalPoints)}
              highlight="max"
            />
            <ComparisonRow
              label="Form"
              values={data.map((p) => p.stats.form)}
            />
            <ComparisonRow
              label="Goals"
              values={data.map((p) => p.stats.goals)}
              highlight="max"
            />
            <ComparisonRow
              label="Assists"
              values={data.map((p) => p.stats.assists)}
              highlight="max"
            />
            <ComparisonRow
              label="xGI"
              values={data.map((p) => p.stats.xGI)}
              highlight="max"
            />
            <ComparisonRow
              label="Pts/Game"
              values={data.map((p) => p.stats.pointsPerGame)}
              highlight="max"
            />
            <ComparisonRow
              label="Pts/£m"
              values={data.map((p) => p.stats.pointsPerMillion)}
              highlight="max"
            />
          </tbody>
        </table>
      </div>

      {/* Fixtures comparison */}
      {data.every(
        (p) => p.upcomingFixtures && p.upcomingFixtures.length > 0,
      ) && (
        <div>
          <div className="mb-2 text-xs font-medium text-fpl-muted">
            Upcoming Fixtures
          </div>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}
          >
            {data.map((p) => (
              <div key={p.id} className="space-y-1">
                <div className="text-xs font-medium">{p.name}</div>
                <div className="flex gap-0.5">
                  {p.upcomingFixtures?.slice(0, 5).map((f) => (
                    <div
                      key={f.gameweek}
                      className="flex-1 rounded p-1 text-center text-xs"
                      style={{ backgroundColor: getFDRColor(f.difficulty) }}
                    >
                      <span className="text-white">
                        {f.home ? "" : "@"}
                        {f.opponent}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  values,
  highlight,
}: {
  label: string;
  values: (string | number)[];
  highlight?: "max" | "min";
}) {
  const numericValues = values.map((v) =>
    typeof v === "number" ? v : parseFloat(String(v)) || 0,
  );
  const maxIdx =
    highlight === "max"
      ? numericValues.indexOf(Math.max(...numericValues))
      : -1;
  const minIdx =
    highlight === "min"
      ? numericValues.indexOf(Math.min(...numericValues))
      : -1;

  return (
    <tr className="border-b border-fpl-border/30">
      <td className="px-3 py-1.5 text-fpl-muted">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-3 py-1.5 text-center ${
            i === maxIdx
              ? "font-medium text-fpl-green"
              : i === minIdx
                ? "font-medium text-red-400"
                : ""
          }`}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function RankBadge({
  rank,
  size = "md",
}: {
  rank: number;
  size?: "sm" | "md";
}) {
  const sizeClasses = size === "sm" ? "h-5 w-5 text-xs" : "h-8 w-8 text-sm";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${sizeClasses} ${
        rank === 1
          ? "bg-yellow-500 text-black"
          : rank === 2
            ? "bg-gray-300 text-black"
            : rank === 3
              ? "bg-amber-600 text-white"
              : "bg-fpl-card-alt text-fpl-text"
      }`}
    >
      {rank}
    </div>
  );
}

function FDRBadge({ difficulty }: { difficulty: number }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: getFDRColor(difficulty) }}
    >
      FDR {typeof difficulty === "number" ? difficulty.toFixed(1) : difficulty}
    </span>
  );
}

function FormBadge({ value }: { value: number | string }) {
  const numValue = typeof value === "number" ? value : parseFloat(value) || 0;

  return (
    <span
      className={`rounded px-1 py-0.5 text-xs ${
        numValue >= 6
          ? "bg-green-500/20 text-green-400"
          : numValue >= 4
            ? "bg-yellow-500/20 text-yellow-400"
            : "bg-red-500/20 text-red-400"
      }`}
    >
      {typeof value === "number" ? value.toFixed(1) : value}
    </span>
  );
}

function PositionBadge({ position }: { position: string }) {
  const colors: Record<string, string> = {
    GKP: "bg-yellow-500/20 text-yellow-400",
    DEF: "bg-blue-500/20 text-blue-400",
    MID: "bg-green-500/20 text-green-400",
    FWD: "bg-red-500/20 text-red-400",
  };

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[position] || "bg-gray-500/20 text-gray-400"}`}
    >
      {position}
    </span>
  );
}

function ChanceOfPlayingBadge({ chance }: { chance: number }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs ${
        chance >= 75
          ? "bg-yellow-500/20 text-yellow-400"
          : chance >= 50
            ? "bg-orange-500/20 text-orange-400"
            : "bg-red-500/20 text-red-400"
      }`}
    >
      {chance}%
    </span>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-fpl-card-alt/50 p-2">
      <div className="font-medium">{value}</div>
      <div className="text-fpl-muted">{label}</div>
    </div>
  );
}

function getFDRColor(difficulty: number): string {
  const d = Math.round(difficulty);
  switch (d) {
    case 1:
      return "#00ff87"; // Green
    case 2:
      return "#01fc7a"; // Light green
    case 3:
      return "#e7e7e7"; // Gray
    case 4:
      return "#ff1744"; // Red
    case 5:
      return "#7b0b23"; // Dark red
    default:
      return "#6b7280"; // Gray fallback
  }
}
