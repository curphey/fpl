/**
 * Types for AI Chat Assistant
 */

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  thinking?: string;
  isStreaming?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "running" | "completed" | "error";
  error?: string;
}

export interface ChatRequest {
  messages: { role: MessageRole; content: string }[];
  managerId?: number;
  showThinking?: boolean;
}

export interface StreamEvent {
  type:
    | "text_delta"
    | "thinking_delta"
    | "tool_use_start"
    | "tool_use_end"
    | "error"
    | "done";
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    input?: Record<string, unknown>;
    result?: unknown;
    error?: string;
  };
}

// Tool definitions matching the MCP server pattern
export type ChatToolName =
  | "get_my_squad"
  | "search_players"
  | "get_player_details"
  | "compare_players"
  | "get_fixtures"
  | "get_captain_recommendations"
  | "get_transfer_recommendations"
  | "get_price_changes"
  | "get_chip_advice"
  | "get_gameweek_info";

export interface ChatTool {
  name: ChatToolName;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
        items?: { type: string };
      }
    >;
    required?: string[];
  };
}

// Structured response types for rich UI rendering
export interface PlayerComparisonData {
  players: {
    id: number;
    name: string;
    team: string;
    position: string;
    price: string;
    totalPoints: number;
    form: number;
    ownership: string;
    xGI: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    bonus: number;
    pointsPerGame: string;
    pointsPerMillion: string;
  }[];
}

export interface CaptainRecommendationData {
  recommendations: {
    rank: number;
    player: {
      name: string;
      team: string;
      position: string;
    };
    score: number;
    opponent: string;
    isHome: boolean;
    difficulty: number;
    reasoning: {
      form: number;
      fixture: number;
      xgi: number;
      setPieces: number;
    };
  }[];
}

export interface TransferRecommendationData {
  recommendations: {
    rank: number;
    player: {
      name: string;
      team: string;
      position: string;
      price: string;
    };
    score: number;
    upcomingDifficulty: number;
    reasoning: {
      form: number;
      fixture: number;
      value: number;
      xgi: number;
    };
  }[];
}

export interface SquadData {
  manager: {
    name: string;
    teamName: string;
    overallPoints: number;
    overallRank: number;
  };
  teamValue: string;
  bank: string;
  freeTransfers: number;
  players: {
    name: string;
    team: string;
    position: string;
    price: string;
    points: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
    isOnBench: boolean;
  }[];
}

export interface FixtureData {
  team: string;
  fixtures: {
    gameweek: number;
    opponent: string;
    isHome: boolean;
    difficulty: number;
  }[];
}

export interface GameweekInfoData {
  id: number;
  name: string;
  deadline: string;
  isCurrent: boolean;
  isNext: boolean;
  finished: boolean;
  averageScore: number;
  highestScore: number;
}
