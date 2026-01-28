import { describe, it, expect } from "vitest";
import type { Fixture } from "../types";
import type { EnrichedPlayer } from "../utils";
import { scoreCaptainOptions } from "../captain-model";

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

describe("scoreCaptainOptions", () => {
  it("returns sorted captain picks by score", () => {
    const players = [
      createMockEnrichedPlayer({
        id: 1,
        team: 1,
        form: "3.0",
        expected_goals: "2.0",
        expected_assists: "1.0",
        form_value: 3.0,
        xgi_value: 3.0,
        selected_by_percent: "30",
      }),
      createMockEnrichedPlayer({
        id: 2,
        team: 2,
        form: "8.0",
        expected_goals: "8.0",
        expected_assists: "4.0",
        form_value: 8.0,
        xgi_value: 12.0,
        selected_by_percent: "50",
      }),
    ];

    const fixtures = [
      createMockFixture({
        event: 20,
        team_h: 1,
        team_a: 3,
        team_h_difficulty: 3,
      }),
      createMockFixture({
        event: 20,
        team_h: 2,
        team_a: 4,
        team_h_difficulty: 2,
      }),
    ];

    const teamMap = new Map([
      [1, { short_name: "TST" }],
      [2, { short_name: "TOP" }],
      [3, { short_name: "OPP" }],
      [4, { short_name: "OTH" }],
    ]);

    const picks = scoreCaptainOptions(players, fixtures, teamMap, 20);

    expect(picks.length).toBe(2);
    expect(picks[0].player.id).toBe(2); // Higher form/xGI
    expect(picks[0].score).toBeGreaterThan(picks[1].score);
  });

  it("filters out players with insufficient minutes", () => {
    const players = [
      createMockEnrichedPlayer({ id: 1, minutes: 900 }),
      createMockEnrichedPlayer({ id: 2, minutes: 45 }), // Less than 90
    ];

    const fixtures = [createMockFixture({ event: 20, team_h: 1, team_a: 2 })];

    const teamMap = new Map([
      [1, { short_name: "TST" }],
      [2, { short_name: "OPP" }],
    ]);

    const picks = scoreCaptainOptions(players, fixtures, teamMap, 20);

    expect(picks.length).toBe(1);
    expect(picks[0].player.id).toBe(1);
  });

  it("excludes players with no fixture in gameweek", () => {
    const players = [
      createMockEnrichedPlayer({ id: 1, team: 1 }),
      createMockEnrichedPlayer({ id: 2, team: 99 }), // No fixture
    ];

    const fixtures = [createMockFixture({ event: 20, team_h: 1, team_a: 3 })];

    const teamMap = new Map([
      [1, { short_name: "TST" }],
      [3, { short_name: "OPP" }],
    ]);

    const picks = scoreCaptainOptions(players, fixtures, teamMap, 20);

    expect(picks.length).toBe(1);
    expect(picks[0].player.id).toBe(1);
  });

  it("applies home bonus correctly", () => {
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

    const fixtures = [
      createMockFixture({
        event: 20,
        team_h: 1,
        team_a: 2,
        team_h_difficulty: 3,
        team_a_difficulty: 3,
      }),
    ];

    const teamMap = new Map([
      [1, { short_name: "HOM" }],
      [2, { short_name: "AWY" }],
    ]);

    const picks = scoreCaptainOptions(players, fixtures, teamMap, 20);

    const homePick = picks.find((p) => p.player.id === 1);
    const awayPick = picks.find((p) => p.player.id === 2);

    expect(homePick?.isHome).toBe(true);
    expect(awayPick?.isHome).toBe(false);
    expect(homePick?.homeBonus).toBe(10);
    expect(awayPick?.homeBonus).toBe(0);
  });

  it("categorizes by ownership correctly", () => {
    const players = [
      createMockEnrichedPlayer({ id: 1, team: 1, selected_by_percent: "50" }), // Safe
      createMockEnrichedPlayer({ id: 2, team: 2, selected_by_percent: "5" }), // Differential
    ];

    const fixtures = [
      createMockFixture({ event: 20, team_h: 1, team_a: 3 }),
      createMockFixture({ event: 20, team_h: 2, team_a: 4 }),
    ];

    const teamMap = new Map([
      [1, { short_name: "T1" }],
      [2, { short_name: "T2" }],
      [3, { short_name: "O1" }],
      [4, { short_name: "O2" }],
    ]);

    const picks = scoreCaptainOptions(players, fixtures, teamMap, 20);

    const safePick = picks.find((p) => p.player.id === 1);
    const diffPick = picks.find((p) => p.player.id === 2);

    expect(safePick?.category).toBe("safe");
    expect(diffPick?.category).toBe("differential");
  });

  it("includes set piece score for penalty takers", () => {
    const players = [
      createMockEnrichedPlayer({
        id: 1,
        team: 1,
        penalties_order: 1, // On penalties
        direct_freekicks_order: 1,
        corners_and_indirect_freekicks_order: 1,
      }),
      createMockEnrichedPlayer({
        id: 2,
        team: 2,
        penalties_order: null,
        direct_freekicks_order: null,
        corners_and_indirect_freekicks_order: null,
      }),
    ];

    const fixtures = [
      createMockFixture({ event: 20, team_h: 1, team_a: 3 }),
      createMockFixture({ event: 20, team_h: 2, team_a: 4 }),
    ];

    const teamMap = new Map([
      [1, { short_name: "T1" }],
      [2, { short_name: "T2" }],
      [3, { short_name: "O1" }],
      [4, { short_name: "O2" }],
    ]);

    const picks = scoreCaptainOptions(players, fixtures, teamMap, 20);

    const penTaker = picks.find((p) => p.player.id === 1);
    const noPens = picks.find((p) => p.player.id === 2);

    expect(penTaker?.setPieceScore).toBeGreaterThan(noPens?.setPieceScore ?? 0);
  });

  it("includes opponent short name", () => {
    const players = [createMockEnrichedPlayer({ id: 1, team: 1 })];

    const fixtures = [createMockFixture({ event: 20, team_h: 1, team_a: 2 })];

    const teamMap = new Map([
      [1, { short_name: "LIV" }],
      [2, { short_name: "MCI" }],
    ]);

    const picks = scoreCaptainOptions(players, fixtures, teamMap, 20);

    expect(picks[0].opponentShortName).toBe("MCI");
  });

  it("includes fixture difficulty", () => {
    const players = [createMockEnrichedPlayer({ id: 1, team: 1 })];

    const fixtures = [
      createMockFixture({
        event: 20,
        team_h: 1,
        team_a: 2,
        team_h_difficulty: 2,
      }),
    ];

    const teamMap = new Map([
      [1, { short_name: "T1" }],
      [2, { short_name: "T2" }],
    ]);

    const picks = scoreCaptainOptions(players, fixtures, teamMap, 20);

    expect(picks[0].difficulty).toBe(2);
  });

  it("calculates all score components", () => {
    const players = [createMockEnrichedPlayer()];

    const fixtures = [createMockFixture({ event: 20, team_h: 1, team_a: 2 })];

    const teamMap = new Map([
      [1, { short_name: "T1" }],
      [2, { short_name: "T2" }],
    ]);

    const picks = scoreCaptainOptions(players, fixtures, teamMap, 20);

    expect(picks[0]).toHaveProperty("score");
    expect(picks[0]).toHaveProperty("formScore");
    expect(picks[0]).toHaveProperty("fixtureScore");
    expect(picks[0]).toHaveProperty("xgiScore");
    expect(picks[0]).toHaveProperty("homeBonus");
    expect(picks[0]).toHaveProperty("setPieceScore");
  });
});
