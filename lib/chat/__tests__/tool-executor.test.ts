import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeTool } from "../tool-executor";

// Hoist mock before vi.mock factory runs
const mockGetManagerPicks = vi.hoisted(() => vi.fn());

vi.mock("@/lib/fpl/client", () => ({
  fplClient: {
    getManagerPicks: mockGetManagerPicks,
    getManager: vi.fn(),
    getFixtures: vi.fn(),
    getBootstrapStatic: vi.fn(),
    getLiveGameweek: vi.fn(),
    getLeagueStandings: vi.fn(),
    getManagerHistory: vi.fn(),
    getElementSummary: vi.fn(),
  },
  getCurrentGameweek: vi.fn().mockReturnValue(28),
}));

// Minimal bootstrap with two players: one in squad, one not
const player1 = {
  id: 1,
  web_name: "OwnedPlayer",
  first_name: "Owned",
  second_name: "Player",
  element_type: 3, // MID
  team: 1,
  now_cost: 51, // £5.1m
  minutes: 900,
  total_points: 80,
  form: "8.0",
  points_per_game: "6.5",
  selected_by_percent: "15.0",
  value_season: "15.0",
  ep_next: "8.0",
  ep_this: "7.0",
  news: "",
  chance_of_playing_next_round: 100,
  chance_of_playing_this_round: 100,
  transfers_in_event: 50000,
  transfers_out_event: 10000,
  cost_change_event: 0,
  expected_goals: "0.5",
  expected_assists: "0.3",
  expected_goal_involvements: "0.8",
  ict_index: "8.5",
  influence: "50",
  creativity: "40",
  threat: "60",
};

const player2 = {
  id: 2,
  web_name: "AvailablePlayer",
  first_name: "Available",
  second_name: "Player",
  element_type: 3, // MID
  team: 2,
  now_cost: 60, // £6.0m
  minutes: 800,
  total_points: 75,
  form: "7.5",
  points_per_game: "6.0",
  selected_by_percent: "10.0",
  value_season: "12.0",
  ep_next: "7.0",
  ep_this: "6.5",
  news: "",
  chance_of_playing_next_round: 100,
  chance_of_playing_this_round: 100,
  transfers_in_event: 30000,
  transfers_out_event: 5000,
  cost_change_event: 0,
  expected_goals: "0.4",
  expected_assists: "0.25",
  expected_goal_involvements: "0.65",
  ict_index: "7.5",
  influence: "45",
  creativity: "35",
  threat: "55",
};

const bootstrap = {
  elements: [player1, player2],
  teams: [
    { id: 1, name: "Team A", short_name: "TEA" },
    { id: 2, name: "Team B", short_name: "TEB" },
  ],
  element_types: [
    { id: 1, singular_name_short: "GKP" },
    { id: 2, singular_name_short: "DEF" },
    { id: 3, singular_name_short: "MID" },
    { id: 4, singular_name_short: "FWD" },
  ],
  events: [],
};

const fixtures = [
  {
    id: 1,
    event: 28,
    team_h: 1,
    team_a: 2,
    team_h_difficulty: 2,
    team_a_difficulty: 3,
    finished: false,
    kickoff_time: "2026-03-14T15:00:00Z",
  },
];

const context = {
  bootstrap: bootstrap as never,
  fixtures: fixtures as never,
  currentGw: 28,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("get_transfer_recommendations", () => {
  it("excludes players already in the squad when managerId is provided", async () => {
    // Manager owns player1 (OwnedPlayer)
    mockGetManagerPicks.mockResolvedValue({
      picks: [{ element: 1, position: 1, is_captain: false, multiplier: 1 }],
    });

    const result = (await executeTool(
      "get_transfer_recommendations",
      { limit: 10 },
      { ...context, managerId: 12345 },
    )) as Array<{ player: { name: string } }>;

    const names = result.map((r) => r.player.name);
    expect(names).not.toContain("OwnedPlayer");
    expect(names).toContain("AvailablePlayer");
  });

  it("includes all players when no managerId is provided", async () => {
    const result = (await executeTool(
      "get_transfer_recommendations",
      { limit: 10 },
      context, // no managerId
    )) as Array<{ player: { name: string } }>;

    const names = result.map((r) => r.player.name);
    expect(names).toContain("OwnedPlayer");
    expect(names).toContain("AvailablePlayer");
  });

  it("does not call getManagerPicks when no managerId is provided", async () => {
    await executeTool("get_transfer_recommendations", { limit: 10 }, context);

    expect(mockGetManagerPicks).not.toHaveBeenCalled();
  });
});
