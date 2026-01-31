/**
 * Types for Claude AI simulation and analysis features
 */

// =============================================================================
// GW Decision Simulator (#43)
// =============================================================================

export interface SimulationRequest {
  /** Current squad with player IDs */
  squad: SimulationPlayer[];
  /** Proposed action to simulate */
  action: SimulationAction;
  /** Current league context */
  leagueContext?: SimulationLeagueContext;
  /** Current gameweek */
  currentGameweek: number;
}

export interface SimulationPlayer {
  id: number;
  name: string;
  position: string;
  team: string;
  expectedPoints: number;
  ownership: number;
}

export type SimulationAction =
  | { type: "captain_change"; from: string; to: string }
  | { type: "transfer"; out: string; in: string; cost: number }
  | {
      type: "chip";
      chip: "freehit" | "wildcard" | "benchboost" | "triplecaptain";
      gameweek: number;
    }
  | { type: "hold"; description: string };

export interface SimulationLeagueContext {
  rank: number;
  totalManagers: number;
  gapToLeader: number;
  gameweeksRemaining: number;
  /** Top rivals' likely captains */
  rivalCaptains?: string[];
}

export interface SimulationResult {
  /** Expected rank change (+/-) */
  expectedRankChange: number;
  /** Confidence interval */
  confidenceInterval: { low: number; high: number };
  /** Win probability vs hold */
  winProbability: number;
  /** Risk assessment */
  riskLevel: "low" | "medium" | "high";
  /** Detailed reasoning */
  reasoning: string;
  /** Key factors in the decision */
  keyFactors: string[];
  /** Alternative actions considered */
  alternatives?: { action: string; expectedValue: number }[];
}

export interface SimulationResponse {
  thinking: string;
  result: SimulationResult;
  processingTime: number;
}

// =============================================================================
// Rival Gameplan Analyzer (#44)
// =============================================================================

export interface RivalAnalysisRequest {
  /** Rival's historical data */
  rival: RivalProfile;
  /** Your current squad */
  yourSquad: SimulationPlayer[];
  /** Upcoming fixtures context */
  upcomingFixtures: FixtureContext[];
  /** Current gameweek */
  currentGameweek: number;
}

export interface RivalProfile {
  managerId: number;
  name: string;
  /** Chips used with gameweek */
  chipsUsed: { chip: string; gameweek: number }[];
  /** Historical captain choices */
  captainHistory: { gameweek: number; player: string; points: number }[];
  /** Recent transfer patterns */
  transferPatterns: { gameweek: number; in: string; out: string }[];
  /** Current rank */
  rank: number;
  /** Points behind/ahead of you */
  pointsGap: number;
}

export interface FixtureContext {
  gameweek: number;
  isDGW: boolean;
  isBGW: boolean;
  favorableTeams: string[];
}

export interface RivalPrediction {
  /** Predicted next chip */
  predictedChip: {
    chip: string;
    gameweek: number;
    confidence: number;
    reasoning: string;
  } | null;
  /** Predicted captain */
  predictedCaptain: {
    player: string;
    confidence: number;
    reasoning: string;
  };
  /** Predicted transfers */
  predictedTransfers: {
    likely: string[];
    reasoning: string;
  };
  /** Playing style assessment */
  playStyle: "aggressive" | "template" | "differential" | "conservative";
  /** Weaknesses to exploit */
  weaknesses: string[];
  /** Counter-strategy recommendations */
  counterStrategy: string[];
}

export interface RivalAnalysisResponse {
  thinking: string;
  prediction: RivalPrediction;
  processingTime: number;
}

// =============================================================================
// Injury Return Predictor (#45)
// =============================================================================

export interface InjuryPredictionRequest {
  /** Player details */
  player: InjuredPlayer;
  /** Current gameweek */
  currentGameweek: number;
  /** Manager's current squad context */
  squadContext?: {
    hasPlayer: boolean;
    replacementOptions: string[];
  };
}

export interface InjuredPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  /** Injury type from news */
  injuryType: string;
  /** FPL news text */
  news: string;
  /** When news was added */
  newsAdded: string | null;
  /** Chance of playing (0-100 or null) */
  chanceOfPlaying: number | null;
  /** Current price */
  price: number;
  /** Form before injury */
  formBeforeInjury: number;
  /** Expected points per game when fit */
  expectedPointsPerGame: number;
}

export interface InjuryPrediction {
  /** Estimated return gameweek */
  estimatedReturnGW: number;
  /** Confidence in prediction */
  confidence: "high" | "medium" | "low";
  /** Range of possible return */
  returnRange: { earliest: number; latest: number };
  /** Expected points on return */
  expectedPointsOnReturn: number;
  /** Historical precedent */
  historicalPrecedent: string;
  /** Risk assessment */
  risks: string[];
  /** Recommendation */
  recommendation: "hold" | "sell" | "buy" | "wait_and_see";
  /** Detailed reasoning */
  reasoning: string;
  /** Key monitoring indicators */
  monitoringIndicators: string[];
}

export interface InjuryPredictionResponse {
  thinking: string;
  prediction: InjuryPrediction;
  processingTime: number;
}
