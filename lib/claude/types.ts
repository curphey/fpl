/**
 * Types for Claude optimization integration
 */

export type OptimizationType = 'transfer' | 'chip' | 'wildcard';

export interface TransferConstraints {
  budget: number; // in millions (e.g., 2.5)
  maxTransfers: number; // 1-15
  positionNeeds?: ('GK' | 'DEF' | 'MID' | 'FWD')[];
  excludePlayers?: string[]; // player names to avoid
  mustInclude?: string[]; // player names to include
  preferDifferentials?: boolean;
  lookAheadWeeks?: number;
}

export interface ChipConstraints {
  chip: 'wildcard' | 'freehit' | 'benchboost' | 'triplecaptain';
  remainingChips: string[];
  currentRank?: number;
  targetRank?: number;
}

export interface WildcardConstraints {
  budget: number; // total budget in millions (e.g., 100)
  lookAheadWeeks: number;
  preferredFormation?: string; // e.g., "3-4-3"
  mustInclude?: string[];
  excludePlayers?: string[];
}

export interface OptimizeRequest {
  type: OptimizationType;
  query: string;
  constraints: TransferConstraints | ChipConstraints | WildcardConstraints;
  currentTeam?: TeamContext;
  leagueContext?: LeagueContext;
}

export interface TeamContext {
  players: { id: number; name: string; position: string; team: string; price: number }[];
  bank: number;
  freeTransfers: number;
  chipsUsed: string[];
}

export interface LeagueContext {
  rank: number;
  totalManagers: number;
  gapToLeader: number;
  gameweeksRemaining: number;
}

export interface TransferRecommendation {
  out: { name: string; team: string; price: number; reason: string };
  in: { name: string; team: string; price: number; reason: string };
  netCost: number;
  priority: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface ChipRecommendation {
  chip: string;
  recommendedGameweek: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  alternatives?: { gameweek: number; reason: string }[];
}

export interface WildcardRecommendation {
  team: { name: string; position: string; team: string; price: number }[];
  formation: string;
  totalCost: number;
  keyPicks: { name: string; reason: string }[];
  differentials: string[];
}

export interface OptimizeResponse {
  type: OptimizationType;
  thinking: string;
  summary: string;
  recommendations: TransferRecommendation[] | ChipRecommendation | WildcardRecommendation;
  warnings?: string[];
  processingTime: number;
}

export interface OptimizeError {
  error: string;
  code: 'API_ERROR' | 'INVALID_REQUEST' | 'RATE_LIMITED' | 'TIMEOUT';
}
