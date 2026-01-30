#!/usr/bin/env node
/**
 * FPL Insights MCP Server
 *
 * Provides Claude with tools to query Fantasy Premier League data.
 * Run with: npx tsx mcp-server/index.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const FPL_API_BASE = "https://fantasy.premierleague.com/api";

// Default headers for FPL API requests
const DEFAULT_HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (compatible; FPL-MCP-Server/1.0)",
  Accept: "application/json",
};

// In-memory cache with TTL
const cache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttlMs: number = 300_000) {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

async function fetchFPL<T>(endpoint: string): Promise<T> {
  const cached = getCached<T>(endpoint);
  if (cached) return cached;

  const url = `${FPL_API_BASE}${endpoint}`;
  const response = await fetch(url, { headers: DEFAULT_HEADERS });

  if (!response.ok) {
    throw new Error(`FPL API error: ${response.status} ${response.statusText}`);
  }

  const data: T = await response.json();
  setCache(endpoint, data);
  return data;
}

// Create server instance
const server = new Server(
  {
    name: "fpl-insights",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_players",
      description:
        "Search for FPL players by name, team, or position. Returns player stats, price, form, and ownership data.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Player name to search for (partial match supported)",
          },
          team: {
            type: "string",
            description: "Filter by team name (e.g., 'Arsenal', 'Liverpool')",
          },
          position: {
            type: "string",
            enum: ["GKP", "DEF", "MID", "FWD"],
            description: "Filter by position",
          },
          min_price: {
            type: "number",
            description: "Minimum price in millions (e.g., 5.0)",
          },
          max_price: {
            type: "number",
            description: "Maximum price in millions (e.g., 10.0)",
          },
          sort_by: {
            type: "string",
            enum: ["total_points", "form", "price", "ownership", "xgi"],
            description: "Sort results by this metric (default: total_points)",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 10)",
          },
        },
      },
    },
    {
      name: "get_player_details",
      description:
        "Get detailed information about a specific player including season history, upcoming fixtures, and past gameweek performance.",
      inputSchema: {
        type: "object",
        properties: {
          player_id: {
            type: "number",
            description: "The FPL player ID",
          },
          player_name: {
            type: "string",
            description: "Player name to look up (if ID not known)",
          },
        },
        oneOf: [{ required: ["player_id"] }, { required: ["player_name"] }],
      },
    },
    {
      name: "get_fixtures",
      description:
        "Get upcoming fixtures for teams. Useful for planning transfers and captain picks.",
      inputSchema: {
        type: "object",
        properties: {
          team: {
            type: "string",
            description: "Team name to get fixtures for",
          },
          gameweeks: {
            type: "number",
            description: "Number of upcoming gameweeks to include (default: 5)",
          },
        },
      },
    },
    {
      name: "get_gameweek_info",
      description:
        "Get information about current or specific gameweek including deadline, status, and chip availability.",
      inputSchema: {
        type: "object",
        properties: {
          gameweek: {
            type: "number",
            description: "Specific gameweek number (default: current gameweek)",
          },
        },
      },
    },
    {
      name: "get_team_analysis",
      description:
        "Analyze a FPL manager's team. Get squad details, value, suggested transfers, and captain recommendations.",
      inputSchema: {
        type: "object",
        properties: {
          manager_id: {
            type: "number",
            description: "The FPL manager/team ID",
          },
        },
        required: ["manager_id"],
      },
    },
    {
      name: "get_league_standings",
      description:
        "Get standings for a mini-league including ranks, points, and recent form.",
      inputSchema: {
        type: "object",
        properties: {
          league_id: {
            type: "number",
            description: "The FPL league ID",
          },
          page: {
            type: "number",
            description: "Page number for pagination (default: 1)",
          },
        },
        required: ["league_id"],
      },
    },
    {
      name: "get_price_changes",
      description:
        "Get players likely to rise or fall in price based on transfer activity.",
      inputSchema: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["rise", "fall", "both"],
            description: "Filter by price change direction (default: both)",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 20)",
          },
        },
      },
    },
    {
      name: "compare_players",
      description:
        "Compare two or more players side by side on key FPL metrics.",
      inputSchema: {
        type: "object",
        properties: {
          player_ids: {
            type: "array",
            items: { type: "number" },
            description: "Array of player IDs to compare",
          },
          player_names: {
            type: "array",
            items: { type: "string" },
            description: "Array of player names to compare (if IDs not known)",
          },
        },
      },
    },
  ],
}));

// Define resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "fpl://teams",
      name: "Premier League Teams",
      description: "List of all Premier League teams with basic info",
      mimeType: "application/json",
    },
    {
      uri: "fpl://gameweeks",
      name: "Gameweek Schedule",
      description: "All gameweeks with deadlines and status",
      mimeType: "application/json",
    },
    {
      uri: "fpl://top-players",
      name: "Top Players by Points",
      description: "Current top 50 players ranked by total points",
      mimeType: "application/json",
    },
  ],
}));

// Handle resource reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  interface BootstrapStatic {
    teams: Array<{
      id: number;
      name: string;
      short_name: string;
      strength: number;
      strength_attack_home: number;
      strength_attack_away: number;
      strength_defence_home: number;
      strength_defence_away: number;
    }>;
    events: Array<{
      id: number;
      name: string;
      deadline_time: string;
      is_current: boolean;
      is_next: boolean;
      finished: boolean;
      average_entry_score: number;
      highest_score: number;
      chip_plays: Array<{ chip_name: string; num_played: number }>;
    }>;
    elements: Array<{
      id: number;
      web_name: string;
      team: number;
      element_type: number;
      total_points: number;
      now_cost: number;
      form: string;
      selected_by_percent: string;
    }>;
    element_types: Array<{
      id: number;
      singular_name_short: string;
    }>;
  }

  if (uri === "fpl://teams") {
    const data = await fetchFPL<BootstrapStatic>("/bootstrap-static/");
    const teams = data.teams.map((t) => ({
      id: t.id,
      name: t.name,
      short_name: t.short_name,
      strength: t.strength,
      attack_strength: {
        home: t.strength_attack_home,
        away: t.strength_attack_away,
      },
      defence_strength: {
        home: t.strength_defence_home,
        away: t.strength_defence_away,
      },
    }));
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(teams, null, 2),
        },
      ],
    };
  }

  if (uri === "fpl://gameweeks") {
    const data = await fetchFPL<BootstrapStatic>("/bootstrap-static/");
    const gameweeks = data.events.map((e) => ({
      id: e.id,
      name: e.name,
      deadline: e.deadline_time,
      is_current: e.is_current,
      is_next: e.is_next,
      finished: e.finished,
      average_score: e.average_entry_score,
      highest_score: e.highest_score,
      chip_usage: e.chip_plays,
    }));
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(gameweeks, null, 2),
        },
      ],
    };
  }

  if (uri === "fpl://top-players") {
    const data = await fetchFPL<BootstrapStatic>("/bootstrap-static/");
    const positionMap = Object.fromEntries(
      data.element_types.map((p) => [p.id, p.singular_name_short]),
    );
    const teamMap = Object.fromEntries(data.teams.map((t) => [t.id, t.name]));

    const topPlayers = data.elements
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 50)
      .map((p) => ({
        id: p.id,
        name: p.web_name,
        team: teamMap[p.team],
        position: positionMap[p.element_type],
        total_points: p.total_points,
        price: (p.now_cost / 10).toFixed(1),
        form: p.form,
        ownership: `${p.selected_by_percent}%`,
      }));
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(topPlayers, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  interface BootstrapStatic {
    elements: Array<{
      id: number;
      web_name: string;
      first_name: string;
      second_name: string;
      team: number;
      element_type: number;
      now_cost: number;
      total_points: number;
      form: string;
      selected_by_percent: string;
      transfers_in_event: number;
      transfers_out_event: number;
      cost_change_event: number;
      expected_goals: string;
      expected_assists: string;
      expected_goal_involvements: string;
      minutes: number;
      goals_scored: number;
      assists: number;
      clean_sheets: number;
      bonus: number;
      news: string;
      chance_of_playing_next_round: number | null;
    }>;
    teams: Array<{
      id: number;
      name: string;
      short_name: string;
    }>;
    events: Array<{
      id: number;
      name: string;
      deadline_time: string;
      is_current: boolean;
      is_next: boolean;
      finished: boolean;
      average_entry_score: number;
      highest_score: number;
    }>;
    element_types: Array<{
      id: number;
      singular_name_short: string;
    }>;
  }

  interface Fixture {
    id: number;
    event: number;
    team_h: number;
    team_a: number;
    team_h_difficulty: number;
    team_a_difficulty: number;
    kickoff_time: string;
    finished: boolean;
  }

  interface ElementSummary {
    history: Array<{
      round: number;
      total_points: number;
      minutes: number;
      goals_scored: number;
      assists: number;
      bonus: number;
      opponent_team: number;
      was_home: boolean;
    }>;
    fixtures: Array<{
      event: number;
      is_home: boolean;
      difficulty: number;
      team_h: number;
      team_a: number;
    }>;
  }

  interface ManagerEntry {
    id: number;
    player_first_name: string;
    player_last_name: string;
    name: string;
    summary_overall_points: number;
    summary_overall_rank: number;
    summary_event_points: number;
    current_event: number;
  }

  interface ManagerPicks {
    picks: Array<{
      element: number;
      is_captain: boolean;
      is_vice_captain: boolean;
      multiplier: number;
    }>;
    entry_history: {
      event: number;
      points: number;
      total_points: number;
      rank: number;
      overall_rank: number;
      bank: number;
      value: number;
      event_transfers: number;
    };
  }

  interface LeagueStandings {
    league: {
      id: number;
      name: string;
    };
    standings: {
      results: Array<{
        id: number;
        entry: number;
        entry_name: string;
        player_name: string;
        rank: number;
        last_rank: number;
        total: number;
        event_total: number;
      }>;
    };
  }

  try {
    switch (name) {
      case "search_players": {
        const data = await fetchFPL<BootstrapStatic>("/bootstrap-static/");
        const positionMap = Object.fromEntries(
          data.element_types.map((p) => [p.id, p.singular_name_short]),
        );
        const positionIdMap: Record<string, number> = {
          GKP: 1,
          DEF: 2,
          MID: 3,
          FWD: 4,
        };
        const teamMap = Object.fromEntries(
          data.teams.map((t) => [t.id, t.name]),
        );
        const teamIdMap = Object.fromEntries(
          data.teams.map((t) => [t.name.toLowerCase(), t.id]),
        );

        let players = data.elements;

        // Apply filters
        if (args?.query) {
          const query = (args.query as string).toLowerCase();
          players = players.filter(
            (p) =>
              p.web_name.toLowerCase().includes(query) ||
              p.first_name.toLowerCase().includes(query) ||
              p.second_name.toLowerCase().includes(query),
          );
        }

        if (args?.team) {
          const teamId = teamIdMap[(args.team as string).toLowerCase()];
          if (teamId) {
            players = players.filter((p) => p.team === teamId);
          }
        }

        if (args?.position) {
          const posId = positionIdMap[args.position as string];
          if (posId) {
            players = players.filter((p) => p.element_type === posId);
          }
        }

        if (args?.min_price) {
          const minPrice = (args.min_price as number) * 10;
          players = players.filter((p) => p.now_cost >= minPrice);
        }

        if (args?.max_price) {
          const maxPrice = (args.max_price as number) * 10;
          players = players.filter((p) => p.now_cost <= maxPrice);
        }

        // Sort
        const sortBy = (args?.sort_by as string) || "total_points";
        players.sort((a, b) => {
          switch (sortBy) {
            case "form":
              return parseFloat(b.form) - parseFloat(a.form);
            case "price":
              return b.now_cost - a.now_cost;
            case "ownership":
              return (
                parseFloat(b.selected_by_percent) -
                parseFloat(a.selected_by_percent)
              );
            case "xgi":
              return (
                parseFloat(b.expected_goal_involvements) -
                parseFloat(a.expected_goal_involvements)
              );
            default:
              return b.total_points - a.total_points;
          }
        });

        // Limit
        const limit = (args?.limit as number) || 10;
        players = players.slice(0, limit);

        const results = players.map((p) => ({
          id: p.id,
          name: p.web_name,
          full_name: `${p.first_name} ${p.second_name}`,
          team: teamMap[p.team],
          position: positionMap[p.element_type],
          price: `£${(p.now_cost / 10).toFixed(1)}m`,
          total_points: p.total_points,
          form: p.form,
          ownership: `${p.selected_by_percent}%`,
          xGI: p.expected_goal_involvements,
          minutes: p.minutes,
          goals: p.goals_scored,
          assists: p.assists,
          clean_sheets: p.clean_sheets,
          bonus: p.bonus,
          news: p.news || null,
          chance_of_playing: p.chance_of_playing_next_round,
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "get_player_details": {
        const data = await fetchFPL<BootstrapStatic>("/bootstrap-static/");

        let playerId = args?.player_id as number | undefined;

        if (!playerId && args?.player_name) {
          const query = (args.player_name as string).toLowerCase();
          const player = data.elements.find(
            (p) =>
              p.web_name.toLowerCase() === query ||
              `${p.first_name} ${p.second_name}`.toLowerCase() === query,
          );
          if (player) playerId = player.id;
        }

        if (!playerId) {
          return {
            content: [{ type: "text", text: "Player not found" }],
          };
        }

        const player = data.elements.find((p) => p.id === playerId);
        if (!player) {
          return {
            content: [{ type: "text", text: "Player not found" }],
          };
        }

        const summary = await fetchFPL<ElementSummary>(
          `/element-summary/${playerId}/`,
        );
        const teamMap = Object.fromEntries(
          data.teams.map((t) => [t.id, t.name]),
        );
        const positionMap = Object.fromEntries(
          data.element_types.map((p) => [p.id, p.singular_name_short]),
        );

        const result = {
          id: player.id,
          name: player.web_name,
          full_name: `${player.first_name} ${player.second_name}`,
          team: teamMap[player.team],
          position: positionMap[player.element_type],
          price: `£${(player.now_cost / 10).toFixed(1)}m`,
          total_points: player.total_points,
          form: player.form,
          ownership: `${player.selected_by_percent}%`,
          stats: {
            minutes: player.minutes,
            goals: player.goals_scored,
            assists: player.assists,
            clean_sheets: player.clean_sheets,
            bonus: player.bonus,
            xG: player.expected_goals,
            xA: player.expected_assists,
            xGI: player.expected_goal_involvements,
          },
          news: player.news || null,
          chance_of_playing: player.chance_of_playing_next_round,
          recent_history: summary.history.slice(-5).map((h) => ({
            gameweek: h.round,
            points: h.total_points,
            minutes: h.minutes,
            goals: h.goals_scored,
            assists: h.assists,
            bonus: h.bonus,
            opponent: teamMap[h.opponent_team],
            home: h.was_home,
          })),
          upcoming_fixtures: summary.fixtures.slice(0, 5).map((f) => ({
            gameweek: f.event,
            opponent: teamMap[f.is_home ? f.team_a : f.team_h],
            home: f.is_home,
            difficulty: f.difficulty,
          })),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "get_fixtures": {
        const data = await fetchFPL<BootstrapStatic>("/bootstrap-static/");
        const fixtures = await fetchFPL<Fixture[]>("/fixtures/");

        const teamMap = Object.fromEntries(
          data.teams.map((t) => [t.id, t.name]),
        );
        const teamIdMap = Object.fromEntries(
          data.teams.map((t) => [t.name.toLowerCase(), t.id]),
        );

        const currentGW =
          data.events.find((e) => e.is_current)?.id ||
          data.events.find((e) => e.is_next)?.id ||
          1;
        const gameweeks = (args?.gameweeks as number) || 5;

        let teamId: number | null = null;
        if (args?.team) {
          teamId = teamIdMap[(args.team as string).toLowerCase()] || null;
        }

        const upcoming = fixtures
          .filter(
            (f) =>
              !f.finished &&
              f.event >= currentGW &&
              f.event < currentGW + gameweeks,
          )
          .filter((f) => !teamId || f.team_h === teamId || f.team_a === teamId)
          .map((f) => ({
            gameweek: f.event,
            home_team: teamMap[f.team_h],
            away_team: teamMap[f.team_a],
            kickoff: f.kickoff_time,
            home_difficulty: f.team_h_difficulty,
            away_difficulty: f.team_a_difficulty,
          }));

        return {
          content: [{ type: "text", text: JSON.stringify(upcoming, null, 2) }],
        };
      }

      case "get_gameweek_info": {
        const data = await fetchFPL<BootstrapStatic>("/bootstrap-static/");

        let gw: (typeof data.events)[0] | undefined;
        if (args?.gameweek) {
          gw = data.events.find((e) => e.id === args.gameweek);
        } else {
          gw =
            data.events.find((e) => e.is_current) ||
            data.events.find((e) => e.is_next);
        }

        if (!gw) {
          return {
            content: [{ type: "text", text: "Gameweek not found" }],
          };
        }

        const result = {
          id: gw.id,
          name: gw.name,
          deadline: gw.deadline_time,
          is_current: gw.is_current,
          is_next: gw.is_next,
          finished: gw.finished,
          average_score: gw.average_entry_score,
          highest_score: gw.highest_score,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "get_team_analysis": {
        if (!args?.manager_id) {
          return {
            content: [{ type: "text", text: "Manager ID is required" }],
          };
        }

        const managerId = args.manager_id as number;
        const data = await fetchFPL<BootstrapStatic>("/bootstrap-static/");
        const manager = await fetchFPL<ManagerEntry>(`/entry/${managerId}/`);

        const currentGW =
          data.events.find((e) => e.is_current)?.id || manager.current_event;
        const picks = await fetchFPL<ManagerPicks>(
          `/entry/${managerId}/event/${currentGW}/picks/`,
        );

        const teamMap = Object.fromEntries(
          data.teams.map((t) => [t.id, t.name]),
        );
        const positionMap = Object.fromEntries(
          data.element_types.map((p) => [p.id, p.singular_name_short]),
        );

        const squad = picks.picks.map((pick) => {
          const player = data.elements.find((p) => p.id === pick.element);
          return {
            id: pick.element,
            name: player?.web_name,
            team: player ? teamMap[player.team] : "Unknown",
            position: player ? positionMap[player.element_type] : "Unknown",
            price: player
              ? `£${(player.now_cost / 10).toFixed(1)}m`
              : "Unknown",
            points: player?.total_points,
            form: player?.form,
            is_captain: pick.is_captain,
            is_vice_captain: pick.is_vice_captain,
            multiplier: pick.multiplier,
          };
        });

        const result = {
          manager: {
            id: manager.id,
            name: `${manager.player_first_name} ${manager.player_last_name}`,
            team_name: manager.name,
            overall_points: manager.summary_overall_points,
            overall_rank: manager.summary_overall_rank,
            gameweek_points: manager.summary_event_points,
          },
          current_gameweek: currentGW,
          team_value: `£${(picks.entry_history.value / 10).toFixed(1)}m`,
          bank: `£${(picks.entry_history.bank / 10).toFixed(1)}m`,
          transfers_this_gw: picks.entry_history.event_transfers,
          squad,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "get_league_standings": {
        if (!args?.league_id) {
          return {
            content: [{ type: "text", text: "League ID is required" }],
          };
        }

        const leagueId = args.league_id as number;
        const page = (args?.page as number) || 1;

        const standings = await fetchFPL<LeagueStandings>(
          `/leagues-classic/${leagueId}/standings/?page_standings=${page}`,
        );

        const result = {
          league: {
            id: standings.league.id,
            name: standings.league.name,
          },
          standings: standings.standings.results.map((r) => ({
            rank: r.rank,
            previous_rank: r.last_rank,
            rank_change: r.last_rank - r.rank,
            team_name: r.entry_name,
            manager_name: r.player_name,
            total_points: r.total,
            gameweek_points: r.event_total,
          })),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "get_price_changes": {
        const data = await fetchFPL<BootstrapStatic>("/bootstrap-static/");
        const teamMap = Object.fromEntries(
          data.teams.map((t) => [t.id, t.name]),
        );
        const positionMap = Object.fromEntries(
          data.element_types.map((p) => [p.id, p.singular_name_short]),
        );

        const direction = (args?.direction as string) || "both";
        const limit = (args?.limit as number) || 20;

        // Sort by net transfers (transfers in - transfers out)
        const players = data.elements
          .map((p) => ({
            id: p.id,
            name: p.web_name,
            team: teamMap[p.team],
            position: positionMap[p.element_type],
            price: `£${(p.now_cost / 10).toFixed(1)}m`,
            transfers_in: p.transfers_in_event,
            transfers_out: p.transfers_out_event,
            net_transfers: p.transfers_in_event - p.transfers_out_event,
            price_change_event: p.cost_change_event / 10,
            ownership: `${p.selected_by_percent}%`,
          }))
          .filter((p) => {
            if (direction === "rise") return p.net_transfers > 0;
            if (direction === "fall") return p.net_transfers < 0;
            return true;
          })
          .sort((a, b) => {
            if (direction === "fall") {
              return a.net_transfers - b.net_transfers;
            }
            return b.net_transfers - a.net_transfers;
          })
          .slice(0, limit);

        return {
          content: [{ type: "text", text: JSON.stringify(players, null, 2) }],
        };
      }

      case "compare_players": {
        const data = await fetchFPL<BootstrapStatic>("/bootstrap-static/");
        const teamMap = Object.fromEntries(
          data.teams.map((t) => [t.id, t.name]),
        );
        const positionMap = Object.fromEntries(
          data.element_types.map((p) => [p.id, p.singular_name_short]),
        );

        let playerIds = (args?.player_ids as number[]) || [];

        if (!playerIds.length && args?.player_names) {
          const names = args.player_names as string[];
          playerIds = names
            .map((name) => {
              const query = name.toLowerCase();
              const player = data.elements.find(
                (p) =>
                  p.web_name.toLowerCase() === query ||
                  p.web_name.toLowerCase().includes(query),
              );
              return player?.id;
            })
            .filter((id): id is number => id !== undefined);
        }

        if (playerIds.length < 2) {
          return {
            content: [
              {
                type: "text",
                text: "Please provide at least 2 players to compare",
              },
            ],
          };
        }

        const comparison = playerIds
          .map((id) => {
            const p = data.elements.find((el) => el.id === id);
            if (!p) return null;
            return {
              id: p.id,
              name: p.web_name,
              team: teamMap[p.team],
              position: positionMap[p.element_type],
              price: `£${(p.now_cost / 10).toFixed(1)}m`,
              total_points: p.total_points,
              form: parseFloat(p.form),
              ownership: `${p.selected_by_percent}%`,
              minutes: p.minutes,
              goals: p.goals_scored,
              assists: p.assists,
              clean_sheets: p.clean_sheets,
              bonus: p.bonus,
              xG: parseFloat(p.expected_goals),
              xA: parseFloat(p.expected_assists),
              xGI: parseFloat(p.expected_goal_involvements),
              points_per_game:
                p.minutes > 0
                  ? (p.total_points / (p.minutes / 90)).toFixed(1)
                  : "0",
              points_per_million: (p.total_points / (p.now_cost / 10)).toFixed(
                1,
              ),
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);

        return {
          content: [
            { type: "text", text: JSON.stringify(comparison, null, 2) },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FPL Insights MCP Server running on stdio");
}

main().catch(console.error);
