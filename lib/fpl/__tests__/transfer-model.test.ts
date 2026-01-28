import { describe, it, expect } from "vitest";
import type { Fixture } from "../types";
import type { EnrichedPlayer } from "../utils";
import { scoreTransferTargets } from "../transfer-model";

function createMockEnrichedPlayer(
  overrides: Partial<EnrichedPlayer> = {},
): EnrichedPlayer {
  return {
    id: 1,
    first_name: "Test",
    second_name: "Player",
    web_name: "T.Player",
    team: 1,
    element_type: 3,
    now_cost: 100,
    total_points: 100,
    form: "5.0",
    points_per_game: "5.0",
    selected_by_percent: "20.0",
    expected_goals: "5.0",
    expected_assists: "3.0",
    ict_index: "100",
    status: "a",
    minutes: 900,
    goals_scored: 5,
    assists: 3,
    clean_sheets: 2,
    goals_conceded: 5,
    own_goals: 0,
    penalties_saved: 0,
    penalties_missed: 0,
    yellow_cards: 1,
    red_cards: 0,
    saves: 0,
    bonus: 10,
    bps: 200,
    influence: "100",
    creativity: "100",
    threat: "100",
    starts: 10,
    chance_of_playing_next_round: 100,
    chance_of_playing_this_round: 100,
    code: 1,
    cost_change_event: 0,
    cost_change_event_fall: 0,
    cost_change_start: 0,
    cost_change_start_fall: 0,
    dreamteam_count: 0,
    ep_next: "5.0",
    ep_this: "5.0",
    in_dreamteam: false,
    news: "",
    news_added: null,
    photo: "",
    special: false,
    squad_number: null,
    team_code: 1,
    transfers_in: 1000,
    transfers_in_event: 100,
    transfers_out: 500,
    transfers_out_event: 50,
    value_form: "0.5",
    value_season: "10",
    influence_rank: 50,
    influence_rank_type: 20,
    creativity_rank: 50,
    creativity_rank_type: 20,
    threat_rank: 50,
    threat_rank_type: 20,
    ict_index_rank: 50,
    ict_index_rank_type: 20,
    corners_and_indirect_freekicks_order: null,
    corners_and_indirect_freekicks_text: "",
    direct_freekicks_order: null,
    direct_freekicks_text: "",
    penalties_order: null,
    penalties_text: "",
    expected_goals_per_90: 0.5,
    saves_per_90: 0,
    expected_assists_per_90: 0.3,
    expected_goal_involvements_per_90: 0.8,
    expected_goals_conceded_per_90: 0,
    goals_conceded_per_90: 0.5,
    now_cost_rank: 50,
    now_cost_rank_type: 20,
    form_rank: 50,
    form_rank_type: 20,
    points_per_game_rank: 50,
    points_per_game_rank_type: 20,
    selected_rank: 50,
    selected_rank_type: 20,
    starts_per_90: 1,
    clean_sheets_per_90: 0.2,
    // Enriched fields
    team_name: "Test Team",
    team_short_name: "TST",
    position_name: "Midfielder",
    position_short: "MID",
    price_formatted: "£10.0m",
    form_value: 5.0,
    ppg_value: 5.0,
    value_score: 10.0,
    xg_value: 5.0,
    xa_value: 3.0,
    xgi_value: 8.0,
    ict_value: 100,
    ownership_value: 20.0,
    ...overrides,
  };
}

function createMockFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 1,
    code: 12345,
    event: 20,
    finished: false,
    finished_provisional: false,
    kickoff_time: "2024-01-15T15:00:00Z",
    minutes: 0,
    provisional_start_time: false,
    started: false,
    team_a: 2,
    team_a_score: null,
    team_h: 1,
    team_h_score: null,
    stats: [],
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    pulse_id: 100,
    ...overrides,
  };
}

describe("scoreTransferTargets", () => {
  it("returns sorted recommendations by score", () => {
    const players = [
      createMockEnrichedPlayer({
        id: 1,
        web_name: "LowForm",
        team: 1,
        form: "2.0",
        total_points: 50,
        now_cost: 100,
        expected_goals: "2.0",
        expected_assists: "1.0",
        form_value: 2.0,
        xgi_value: 3.0,
        value_score: 5.0,
      }),
      createMockEnrichedPlayer({
        id: 2,
        web_name: "HighForm",
        team: 2,
        form: "8.0",
        total_points: 150,
        now_cost: 100,
        expected_goals: "10.0",
        expected_assists: "5.0",
        form_value: 8.0,
        xgi_value: 15.0,
        value_score: 15.0,
      }),
    ];

    const fixtures = [
      createMockFixture({
        event: 20,
        team_h: 1,
        team_a: 3,
        team_h_difficulty: 2,
      }),
      createMockFixture({
        event: 20,
        team_h: 4,
        team_a: 2,
        team_a_difficulty: 2,
      }),
      createMockFixture({
        event: 21,
        team_h: 1,
        team_a: 5,
        team_h_difficulty: 3,
      }),
      createMockFixture({
        event: 21,
        team_h: 2,
        team_a: 6,
        team_h_difficulty: 2,
      }),
    ];

    const recommendations = scoreTransferTargets(players, fixtures, 20, 2);

    expect(recommendations.length).toBe(2);
    expect(recommendations[0].player.web_name).toBe("HighForm");
    expect(recommendations[0].score).toBeGreaterThan(recommendations[1].score);
  });

  it("filters out players with zero minutes", () => {
    const players = [
      createMockEnrichedPlayer({ id: 1, minutes: 900 }),
      createMockEnrichedPlayer({ id: 2, minutes: 0 }),
    ];

    const fixtures = [createMockFixture({ event: 20, team_h: 1, team_a: 2 })];

    const recommendations = scoreTransferTargets(players, fixtures, 20);

    expect(recommendations.length).toBe(1);
    expect(recommendations[0].player.id).toBe(1);
  });

  it("calculates fixture difficulty correctly", () => {
    const players = [
      createMockEnrichedPlayer({
        id: 1,
        team: 1,
        form: "5.0",
        form_value: 5.0,
      }),
      createMockEnrichedPlayer({
        id: 2,
        team: 2,
        form: "5.0",
        form_value: 5.0,
      }),
    ];

    // Team 1 has easy fixtures (FDR 1), Team 2 has hard fixtures (FDR 5)
    const fixtures = [
      createMockFixture({
        event: 20,
        team_h: 1,
        team_a: 3,
        team_h_difficulty: 1,
      }),
      createMockFixture({
        event: 21,
        team_h: 1,
        team_a: 4,
        team_h_difficulty: 1,
      }),
      createMockFixture({
        event: 20,
        team_h: 5,
        team_a: 2,
        team_a_difficulty: 5,
      }),
      createMockFixture({
        event: 21,
        team_h: 6,
        team_a: 2,
        team_a_difficulty: 5,
      }),
    ];

    const recommendations = scoreTransferTargets(players, fixtures, 20, 2);

    // Player 1 (easy fixtures) should rank higher
    expect(recommendations[0].player.team).toBe(1);
    expect(recommendations[0].fixtureScore).toBeGreaterThan(
      recommendations[1].fixtureScore,
    );
  });

  it("includes all score components", () => {
    const players = [createMockEnrichedPlayer()];
    const fixtures = [createMockFixture({ event: 20, team_h: 1, team_a: 2 })];

    const recommendations = scoreTransferTargets(players, fixtures, 20);

    expect(recommendations[0]).toHaveProperty("score");
    expect(recommendations[0]).toHaveProperty("formScore");
    expect(recommendations[0]).toHaveProperty("fixtureScore");
    expect(recommendations[0]).toHaveProperty("valueScore");
    expect(recommendations[0]).toHaveProperty("xgiScore");
    expect(recommendations[0]).toHaveProperty("upcomingDifficulty");
  });

  it("handles players with no upcoming fixtures", () => {
    const players = [createMockEnrichedPlayer({ team: 99 })]; // Team with no fixtures
    const fixtures = [createMockFixture({ event: 20, team_h: 1, team_a: 2 })];

    const recommendations = scoreTransferTargets(players, fixtures, 20);

    expect(recommendations.length).toBe(1);
    expect(recommendations[0].upcomingDifficulty).toBe(3); // Neutral fallback
  });

  it("respects lookAhead parameter", () => {
    const players = [createMockEnrichedPlayer({ team: 1 })];

    // Create fixtures for GW 20-25
    const fixtures = Array.from({ length: 6 }, (_, i) =>
      createMockFixture({
        event: 20 + i,
        team_h: 1,
        team_a: 2,
        team_h_difficulty: i < 3 ? 2 : 5, // Easy first 3, hard last 3
      }),
    );

    const shortLookAhead = scoreTransferTargets(players, fixtures, 20, 3);
    const longLookAhead = scoreTransferTargets(players, fixtures, 20, 6);

    // Short look-ahead should show easier fixtures
    expect(shortLookAhead[0].upcomingDifficulty).toBeLessThan(
      longLookAhead[0].upcomingDifficulty,
    );
  });
});
