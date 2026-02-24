import { describe, it, expect } from "vitest";
import type { Fixture } from "../types";
import type { EnrichedPlayer } from "../utils";
import { predictPoints } from "../points-model";

function createMockPlayer(
  overrides: Partial<EnrichedPlayer> = {},
): EnrichedPlayer {
  return {
    id: 1,
    first_name: "Test",
    second_name: "Player",
    web_name: "T.Player",
    element_type: 3,
    team: 1,
    now_cost: 80,
    total_points: 100,
    form: "5.0",
    status: "a",
    chance_of_playing_this_round: 100,
    chance_of_playing_next_round: 100,
    selected_by_percent: "10.0",
    transfers_in_event: 0,
    transfers_out_event: 0,
    cost_change_event: 0,
    cost_change_start: 0,
    goals_scored: 5,
    assists: 3,
    clean_sheets: 2,
    saves: 0,
    bonus: 10,
    bps: 200,
    minutes: 900,
    ict_index: "100.0",
    expected_goals: "5.0",
    expected_assists: "3.0",
    expected_goal_involvements: "8.0",
    points_per_game: "5.0",
    value_form: "0.6",
    value_season: "1.2",
    news: "",
    news_added: null,
    squad_number: null,
    photo: "test.jpg",
    code: 1,
    ep_next: "5.0",
    ep_this: "5.0",
    event_points: 10,
    goals_conceded: 5,
    in_dreamteam: false,
    influence: "100.0",
    creativity: "100.0",
    threat: "50.0",
    own_goals: 0,
    penalties_missed: 0,
    penalties_saved: 0,
    red_cards: 0,
    starts: 10,
    yellow_cards: 1,
    transfers_in: 50000,
    transfers_out: 20000,
    corners_and_indirect_freekicks_order: null,
    corners_and_indirect_freekicks_text: "",
    direct_freekicks_order: null,
    direct_freekicks_text: "",
    penalties_order: null,
    penalties_text: "",
    expected_goals_per_90: 0.5,
    expected_assists_per_90: 0.3,
    expected_goal_involvements_per_90: 0.8,
    goals_conceded_per_90: 0.5,
    saves_per_90: 0,
    starts_per_90: 1,
    clean_sheets_per_90: 0.2,
    now_cost_rank: 5,
    now_cost_rank_type: 2,
    form_rank: 3,
    form_rank_type: 1,
    points_per_game_rank: 4,
    points_per_game_rank_type: 2,
    selected_rank: 2,
    selected_rank_type: 1,
    dreamteam_count: 2,
    team_name: "Team A",
    team_short_name: "TEA",
    position_name: "Midfielder",
    position_short: "MID",
    price_formatted: "£8.0m",
    form_value: 5.0,
    ppg_value: 5.0,
    value_score: 0.6,
    xg_value: 5.0,
    xa_value: 3.0,
    xgi_value: 8.0,
    ict_value: 100.0,
    ownership_value: 10.0,
    ...overrides,
  };
}

function createMockFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 1,
    event: 20,
    team_h: 1,
    team_a: 2,
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    team_h_score: null,
    team_a_score: null,
    finished: false,
    finished_provisional: false,
    kickoff_time: null,
    minutes: 0,
    provisional_start_time: false,
    started: false,
    pulse_id: 1,
    stats: [],
    ...overrides,
  };
}

describe("predictPoints", () => {
  const fixtures = [
    createMockFixture({ event: 20, team_h: 1, team_h_difficulty: 2 }),
  ];

  it("returns 'low' confidence for a player with 0 minutes", () => {
    const player = createMockPlayer({ minutes: 0, starts: 0 });
    const results = predictPoints([player], fixtures, 20);
    expect(results[0].confidence).toBe("low");
  });

  it("does not assign 'medium' confidence when player has 0 minutes", () => {
    // Even with starts > 0 (edge case data), 0 minutes should remain 'low'
    const player = createMockPlayer({ minutes: 0, starts: 5 });
    const results = predictPoints([player], fixtures, 20);
    expect(results[0].confidence).toBe("low");
  });

  it("assigns 'medium' confidence for players with sufficient minutes but low form", () => {
    // startRate = 1 / (150/90) ≈ 0.6 (>0.4), minutes=150 (>90), form=2.0 (not >3) → medium
    const player = createMockPlayer({
      minutes: 150,
      starts: 1,
      form: "2.0",
    });
    const results = predictPoints([player], fixtures, 20);
    expect(results[0].confidence).toBe("medium");
  });

  it("assigns 'high' confidence for consistent starters with good form", () => {
    const player = createMockPlayer({
      minutes: 900, // > 270
      starts: 10,
      form: "6.0",
    });
    const results = predictPoints([player], fixtures, 20);
    expect(results[0].confidence).toBe("high");
  });

  it("applies zero fixture and home adjustments for a blank gameweek", () => {
    // No fixtures for GW 99 for team 1 — fixtureAdj and homeAdj should be 0
    const player = createMockPlayer({ team: 1 });
    const results = predictPoints([player], fixtures, 99);
    expect(results[0].breakdown.fixtureAdj).toBe(0);
    expect(results[0].breakdown.homeAdj).toBe(0);
  });

  it("applies home advantage for home players", () => {
    const homePlayer = createMockPlayer({ team: 1 }); // team 1 is home in fixtures
    const awayPlayer = createMockPlayer({ id: 2, team: 2 }); // team 2 is away
    const results = predictPoints([homePlayer, awayPlayer], fixtures, 20);
    const home = results.find((r) => r.player.id === 1)!;
    const away = results.find((r) => r.player.id === 2)!;
    expect(home.breakdown.homeAdj).toBe(0.3);
    expect(away.breakdown.homeAdj).toBe(0);
  });

  it("sorts results by predicted points descending", () => {
    const highForm = createMockPlayer({
      id: 1,
      form: "8.0",
      minutes: 900,
      starts: 10,
    });
    const lowForm = createMockPlayer({
      id: 2,
      form: "2.0",
      minutes: 900,
      starts: 10,
    });
    const results = predictPoints([lowForm, highForm], fixtures, 20);
    expect(results[0].predictedPoints).toBeGreaterThanOrEqual(
      results[1].predictedPoints,
    );
  });
});
