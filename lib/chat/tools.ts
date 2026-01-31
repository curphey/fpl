/**
 * Tool definitions for Claude chat assistant
 * Following the MCP server pattern from mcp-server/index.ts
 */

import type { ChatTool } from "./types";

export const chatTools: ChatTool[] = [
  {
    name: "get_my_squad",
    description:
      "Get the user's current FPL squad including all 15 players, captain/vice-captain, and bench. Requires a manager ID to be connected.",
    input_schema: {
      type: "object",
      properties: {
        gameweek: {
          type: "number",
          description:
            "Specific gameweek to get picks for. Defaults to current gameweek.",
        },
      },
    },
  },
  {
    name: "search_players",
    description:
      "Search for FPL players by name, team, or position. Returns player stats, price, form, and ownership data. Use this to find players matching specific criteria.",
    input_schema: {
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
    input_schema: {
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
    },
  },
  {
    name: "compare_players",
    description:
      "Compare two or more players side by side on key FPL metrics including points, form, value, xGI, and fixtures.",
    input_schema: {
      type: "object",
      properties: {
        player_names: {
          type: "array",
          items: { type: "string" },
          description: "Array of player names to compare",
        },
      },
      required: ["player_names"],
    },
  },
  {
    name: "get_fixtures",
    description:
      "Get upcoming fixtures for teams with fixture difficulty ratings. Useful for planning transfers and captain picks.",
    input_schema: {
      type: "object",
      properties: {
        team: {
          type: "string",
          description:
            "Team name to get fixtures for (e.g., 'Arsenal'). If omitted, returns all fixtures.",
        },
        gameweeks: {
          type: "number",
          description: "Number of upcoming gameweeks to include (default: 5)",
        },
      },
    },
  },
  {
    name: "get_captain_recommendations",
    description:
      "Get ranked captain recommendations based on form, fixtures, xGI, and set piece involvement. Can filter to show only players in the user's squad.",
    input_schema: {
      type: "object",
      properties: {
        squad_only: {
          type: "boolean",
          description:
            "If true, only recommend captains from the user's squad (requires manager ID)",
        },
        limit: {
          type: "number",
          description: "Maximum number of recommendations (default: 5)",
        },
      },
    },
  },
  {
    name: "get_transfer_recommendations",
    description:
      "Get ranked transfer-in recommendations based on form, fixtures, value, and xGI. Optionally filter by position or price.",
    input_schema: {
      type: "object",
      properties: {
        position: {
          type: "string",
          enum: ["GKP", "DEF", "MID", "FWD"],
          description: "Filter recommendations by position",
        },
        max_price: {
          type: "number",
          description: "Maximum price in millions",
        },
        limit: {
          type: "number",
          description: "Maximum number of recommendations (default: 10)",
        },
      },
    },
  },
  {
    name: "get_price_changes",
    description:
      "Get players most likely to rise or fall in price based on transfer activity.",
    input_schema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["rise", "fall", "both"],
          description: "Filter by price change direction (default: both)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 10)",
        },
      },
    },
  },
  {
    name: "get_chip_advice",
    description:
      "Get chip strategy recommendations including optimal timing for Wildcard, Free Hit, Bench Boost, and Triple Captain.",
    input_schema: {
      type: "object",
      properties: {
        chip: {
          type: "string",
          enum: ["wildcard", "freehit", "bboost", "3xc"],
          description: "Specific chip to analyze (default: all available)",
        },
      },
    },
  },
  {
    name: "get_gameweek_info",
    description:
      "Get information about current or specific gameweek including deadline, status, and average scores.",
    input_schema: {
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
    name: "get_league_analysis",
    description:
      "Analyze a mini-league including rival picks, effective ownership, gaps to leader, and differentials. Requires manager ID to be connected.",
    input_schema: {
      type: "object",
      properties: {
        league_id: {
          type: "number",
          description: "The mini-league ID to analyze",
        },
        rival_count: {
          type: "number",
          description:
            "Number of closest rivals to analyze (default: 5, max: 10)",
        },
      },
      required: ["league_id"],
    },
  },
  {
    name: "get_differentials",
    description:
      "Find low-ownership players with high upside potential. Returns players with ownership below a threshold who have good form and fixtures.",
    input_schema: {
      type: "object",
      properties: {
        max_ownership: {
          type: "number",
          description: "Maximum ownership percentage (default: 10)",
        },
        position: {
          type: "string",
          enum: ["GKP", "DEF", "MID", "FWD"],
          description: "Filter by position",
        },
        min_form: {
          type: "number",
          description: "Minimum form rating (default: 4.0)",
        },
        max_price: {
          type: "number",
          description: "Maximum price in millions",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 10)",
        },
      },
    },
  },
  {
    name: "get_team_templates",
    description:
      "Get suggested team templates for different FPL strategies. Returns optimized squads based on value, premium-heavy, balanced, or differential approaches.",
    input_schema: {
      type: "object",
      properties: {
        strategy: {
          type: "string",
          enum: ["value", "premium", "balanced", "differential"],
          description:
            "Team building strategy (default: balanced). 'value' focuses on price/points ratio, 'premium' loads up on expensive players, 'balanced' mixes both, 'differential' focuses on low-ownership picks.",
        },
        budget: {
          type: "number",
          description: "Total budget in millions (default: 100)",
        },
        formation: {
          type: "string",
          enum: ["3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-3-2", "5-4-1"],
          description: "Preferred formation (default: 3-4-3)",
        },
      },
    },
  },
  {
    name: "get_player_comparison_detailed",
    description:
      "Deep dive comparison of players including historical data, season history, form trends, and fixture analysis. More comprehensive than compare_players.",
    input_schema: {
      type: "object",
      properties: {
        player_names: {
          type: "array",
          items: { type: "string" },
          description: "Array of player names to compare (2-4 players)",
        },
        include_history: {
          type: "boolean",
          description:
            "Include last 5 gameweeks performance breakdown (default: true)",
        },
        include_fixtures: {
          type: "boolean",
          description: "Include next 5 fixtures analysis (default: true)",
        },
      },
      required: ["player_names"],
    },
  },
  {
    name: "get_watchlist",
    description:
      "Get detailed stats for a list of specific players the user is tracking. Useful for monitoring potential transfers or keeping an eye on form changes.",
    input_schema: {
      type: "object",
      properties: {
        player_names: {
          type: "array",
          items: { type: "string" },
          description: "Array of player names to track",
        },
        include_price_prediction: {
          type: "boolean",
          description: "Include price change predictions (default: true)",
        },
      },
      required: ["player_names"],
    },
  },
];

/**
 * Get tool definitions formatted for Claude API
 */
export function getToolDefinitions() {
  return chatTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}
