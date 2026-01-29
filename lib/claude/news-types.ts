/**
 * Types for FPL news search integration
 */

export type NewsCategory =
  | "injury"
  | "transfer"
  | "team_news"
  | "press_conference"
  | "suspension"
  | "general";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: NewsCategory;
  players: string[]; // Player names mentioned
  teams: string[]; // Team names mentioned
  source: string;
  sourceUrl: string;
  publishedAt: string;
  fetchedAt: string;
  relevanceScore: number; // 0-100, how relevant to FPL
  fplImpact: "positive" | "negative" | "neutral" | "unknown";
  impactDetails?: string;
}

export interface NewsSearchRequest {
  query?: string;
  players?: string[]; // Specific players to search for
  teams?: string[]; // Specific teams to search for
  categories?: NewsCategory[];
  maxResults?: number;
}

export interface NewsSearchResponse {
  items: NewsItem[];
  searchQuery: string;
  timestamp: string;
  cached: boolean;
}

export interface InjuryUpdate {
  playerName: string;
  team: string;
  status: "injured" | "doubtful" | "fit" | "suspended" | "unknown";
  details: string;
  expectedReturn?: string;
  source: string;
  updatedAt: string;
}

export interface TeamNewsUpdate {
  team: string;
  gameweek: number;
  predictedLineup?: string[];
  absentPlayers: { name: string; reason: string }[];
  returnees: { name: string; details: string }[];
  managerQuotes?: string[];
  source: string;
  updatedAt: string;
}

export interface PressConferenceUpdate {
  manager: string;
  team: string;
  date: string;
  keyPoints: string[];
  injuryUpdates: InjuryUpdate[];
  source: string;
}
