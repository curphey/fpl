import { describe, it, expect } from "vitest";
import type { EnrichedPlayer } from "../utils";
import {
  validateSquad,
  validateFormation,
  getFormationLabel,
  calculateTransferCost,
  calculateNextFreeTransfers,
  getAvailableChips,
  simulateAutoSubs,
  SQUAD_SIZE,
  SQUAD_BUDGET,
  MAX_PER_TEAM,
  VALID_FORMATIONS,
  CHIPS,
} from "../rules-engine";

/**
 * Creates a mock enriched player for testing.
 */
function createMockPlayer(
  overrides: Partial<EnrichedPlayer> = {},
): EnrichedPlayer {
  return {
    id: 1,
    first_name: "Test",
    second_name: "Player",
    web_name: "T.Player",
    team: 1,
    element_type: 3, // Midfielder
    now_cost: 60,
    total_points: 50,
    form: "5.0",
    points_per_game: "5.0",
    selected_by_percent: "10.0",
    expected_goals: "2.0",
    expected_assists: "1.0",
    ict_index: "50",
    status: "a",
    minutes: 900,
    goals_scored: 2,
    assists: 1,
    clean_sheets: 0,
    goals_conceded: 5,
    own_goals: 0,
    penalties_saved: 0,
    penalties_missed: 0,
    yellow_cards: 1,
    red_cards: 0,
    saves: 0,
    bonus: 5,
    bps: 100,
    influence: "50",
    creativity: "50",
    threat: "50",
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
    expected_goals_per_90: 0.2,
    saves_per_90: 0,
    expected_assists_per_90: 0.1,
    expected_goal_involvements_per_90: 0.3,
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
    clean_sheets_per_90: 0,
    team_name: "Test Team",
    team_short_name: "TST",
    position_name: "Midfielder",
    position_short: "MID",
    price_formatted: "£6.0m",
    form_value: 5.0,
    ppg_value: 5.0,
    value_score: 8.3,
    xg_value: 2.0,
    xa_value: 1.0,
    xgi_value: 3.0,
    ict_value: 50,
    ownership_value: 10.0,
    ...overrides,
  } as EnrichedPlayer;
}

/**
 * Creates a valid 15-player squad with proper position distribution.
 * 2 GK, 5 DEF, 5 MID, 3 FWD across different teams.
 */
function createValidSquad(): EnrichedPlayer[] {
  const squad: EnrichedPlayer[] = [];
  let id = 1;

  // 2 Goalkeepers
  for (let i = 0; i < 2; i++) {
    squad.push(
      createMockPlayer({
        id: id++,
        web_name: `GK${i + 1}`,
        element_type: 1,
        team: i + 1,
        team_short_name: `T${i + 1}`,
        now_cost: 45,
        position_name: "Goalkeeper",
        position_short: "GK",
      }),
    );
  }

  // 5 Defenders
  for (let i = 0; i < 5; i++) {
    squad.push(
      createMockPlayer({
        id: id++,
        web_name: `DEF${i + 1}`,
        element_type: 2,
        team: (i % 5) + 3,
        team_short_name: `T${(i % 5) + 3}`,
        now_cost: 55,
        position_name: "Defender",
        position_short: "DEF",
      }),
    );
  }

  // 5 Midfielders
  for (let i = 0; i < 5; i++) {
    squad.push(
      createMockPlayer({
        id: id++,
        web_name: `MID${i + 1}`,
        element_type: 3,
        team: (i % 5) + 8,
        team_short_name: `T${(i % 5) + 8}`,
        now_cost: 70,
        position_name: "Midfielder",
        position_short: "MID",
      }),
    );
  }

  // 3 Forwards
  for (let i = 0; i < 3; i++) {
    squad.push(
      createMockPlayer({
        id: id++,
        web_name: `FWD${i + 1}`,
        element_type: 4,
        team: i + 13,
        team_short_name: `T${i + 13}`,
        now_cost: 80,
        position_name: "Forward",
        position_short: "FWD",
      }),
    );
  }

  return squad;
}

/**
 * Creates a valid starting XI from a squad.
 */
function createStartingXI(
  formation: [number, number, number],
): EnrichedPlayer[] {
  const [defCount, midCount, fwdCount] = formation;
  const xi: EnrichedPlayer[] = [];
  let id = 1;

  // 1 GK
  xi.push(
    createMockPlayer({
      id: id++,
      element_type: 1,
      team: 1,
    }),
  );

  // Defenders
  for (let i = 0; i < defCount; i++) {
    xi.push(
      createMockPlayer({
        id: id++,
        element_type: 2,
        team: i + 2,
      }),
    );
  }

  // Midfielders
  for (let i = 0; i < midCount; i++) {
    xi.push(
      createMockPlayer({
        id: id++,
        element_type: 3,
        team: i + 7,
      }),
    );
  }

  // Forwards
  for (let i = 0; i < fwdCount; i++) {
    xi.push(
      createMockPlayer({
        id: id++,
        element_type: 4,
        team: i + 12,
      }),
    );
  }

  return xi;
}

// =============================================================================
// Constants Tests
// =============================================================================

describe("Constants", () => {
  it("has correct squad size", () => {
    expect(SQUAD_SIZE).toBe(15);
  });

  it("has correct budget in API units (£100m)", () => {
    expect(SQUAD_BUDGET).toBe(1000);
  });

  it("has correct max per team", () => {
    expect(MAX_PER_TEAM).toBe(3);
  });

  it("has 8 valid formations", () => {
    expect(VALID_FORMATIONS).toHaveLength(8);
  });

  it("all formations sum to 10 outfield players", () => {
    for (const [def, mid, fwd] of VALID_FORMATIONS) {
      expect(def + mid + fwd).toBe(10);
    }
  });

  it("all formations have at least 3 defenders", () => {
    for (const [def] of VALID_FORMATIONS) {
      expect(def).toBeGreaterThanOrEqual(3);
    }
  });

  it("all formations have at least 1 forward", () => {
    for (const [, , fwd] of VALID_FORMATIONS) {
      expect(fwd).toBeGreaterThanOrEqual(1);
    }
  });

  it("has 4 chip types", () => {
    expect(CHIPS).toHaveLength(4);
    expect(CHIPS.map((c) => c.name)).toContain("wildcard");
    expect(CHIPS.map((c) => c.name)).toContain("freehit");
    expect(CHIPS.map((c) => c.name)).toContain("3xc");
    expect(CHIPS.map((c) => c.name)).toContain("bboost");
  });
});

// =============================================================================
// Squad Validation Tests
// =============================================================================

describe("validateSquad", () => {
  it("validates a correct 15-player squad", () => {
    const squad = createValidSquad();
    const result = validateSquad(squad);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects squad with wrong size (too few)", () => {
    const squad = createValidSquad().slice(0, 14);
    const result = validateSquad(squad);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "SQUAD_SIZE")).toBe(true);
  });

  it("rejects squad with wrong size (too many)", () => {
    const squad = createValidSquad();
    squad.push(createMockPlayer({ id: 100, element_type: 3, team: 20 }));
    const result = validateSquad(squad);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "SQUAD_SIZE")).toBe(true);
  });

  it("rejects squad with wrong position counts", () => {
    const squad = createValidSquad();
    // Replace a midfielder with a forward (5 MID -> 4 MID, 3 FWD -> 4 FWD)
    squad[10] = createMockPlayer({
      id: 100,
      element_type: 4,
      team: 16,
    });

    const result = validateSquad(squad);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "POSITION_COUNT")).toBe(true);
  });

  it("rejects squad with too few goalkeepers", () => {
    const squad = createValidSquad();
    // Replace a GK with a defender
    squad[0] = createMockPlayer({
      id: 100,
      element_type: 2,
      team: 17,
    });

    const result = validateSquad(squad);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "POSITION_COUNT")).toBe(true);
  });

  it("rejects squad exceeding max players per team", () => {
    const squad = createValidSquad();
    // Put 4 players on same team
    squad[2].team = 1;
    squad[2].team_short_name = "T1";
    squad[3].team = 1;
    squad[3].team_short_name = "T1";
    squad[4].team = 1;
    squad[4].team_short_name = "T1";

    const result = validateSquad(squad);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "TEAM_LIMIT")).toBe(true);
  });

  it("rejects squad over budget", () => {
    const squad = createValidSquad();
    // Make all players expensive (150 * 15 = 2250, over 1000 budget)
    for (const p of squad) {
      p.now_cost = 150;
    }

    const result = validateSquad(squad);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "BUDGET")).toBe(true);
  });

  it("accepts custom budget parameter", () => {
    const squad = createValidSquad();
    // Total cost: 2*45 + 5*55 + 5*70 + 3*80 = 90 + 275 + 350 + 240 = 955
    const result = validateSquad(squad, 950);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "BUDGET")).toBe(true);
  });

  it("rejects squad with duplicate players", () => {
    const squad = createValidSquad();
    squad[1].id = squad[0].id; // Duplicate ID

    const result = validateSquad(squad);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "DUPLICATE")).toBe(true);
  });

  it("warns about injured players", () => {
    const squad = createValidSquad();
    squad[5].status = "i";

    const result = validateSquad(squad);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === "UNAVAILABLE")).toBe(true);
    expect(result.warnings[0].message).toContain("injured");
  });

  it("warns about suspended players", () => {
    const squad = createValidSquad();
    squad[5].status = "s";

    const result = validateSquad(squad);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === "UNAVAILABLE")).toBe(true);
    expect(result.warnings[0].message).toContain("suspended");
  });

  it("warns about unavailable players", () => {
    const squad = createValidSquad();
    squad[5].status = "u";

    const result = validateSquad(squad);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === "UNAVAILABLE")).toBe(true);
  });

  it("warns about doubtful players", () => {
    const squad = createValidSquad();
    squad[5].status = "d";
    squad[5].chance_of_playing_next_round = 50;

    const result = validateSquad(squad);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === "DOUBTFUL")).toBe(true);
    expect(result.warnings[0].message).toContain("50%");
  });

  it("can have multiple errors at once", () => {
    const squad = createValidSquad().slice(0, 13); // Wrong size
    squad[0].id = squad[1].id; // Duplicate

    const result = validateSquad(squad);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Formation Validation Tests
// =============================================================================

describe("validateFormation", () => {
  it("validates 4-4-2 formation", () => {
    const xi = createStartingXI([4, 4, 2]);
    const result = validateFormation(xi);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validates 3-5-2 formation", () => {
    const xi = createStartingXI([3, 5, 2]);
    const result = validateFormation(xi);

    expect(result.valid).toBe(true);
  });

  it("validates 5-4-1 formation", () => {
    const xi = createStartingXI([5, 4, 1]);
    const result = validateFormation(xi);

    expect(result.valid).toBe(true);
  });

  it("validates 5-3-2 formation", () => {
    const xi = createStartingXI([5, 3, 2]);
    const result = validateFormation(xi);

    expect(result.valid).toBe(true);
  });

  it("validates 3-4-3 formation", () => {
    const xi = createStartingXI([3, 4, 3]);
    const result = validateFormation(xi);

    expect(result.valid).toBe(true);
  });

  it("validates all valid formations", () => {
    for (const formation of VALID_FORMATIONS) {
      const xi = createStartingXI(formation);
      const result = validateFormation(xi);
      expect(result.valid).toBe(true);
    }
  });

  it("rejects invalid 2-5-3 formation", () => {
    const xi = createStartingXI([2, 5, 3]);
    const result = validateFormation(xi);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "INVALID_FORMATION")).toBe(
      true,
    );
  });

  it("rejects invalid 6-3-1 formation", () => {
    const xi = createStartingXI([6, 3, 1]);
    const result = validateFormation(xi);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "INVALID_FORMATION")).toBe(
      true,
    );
  });

  it("rejects XI without goalkeeper", () => {
    const xi: EnrichedPlayer[] = [];
    let id = 1;
    // All outfield players
    for (let i = 0; i < 4; i++) {
      xi.push(createMockPlayer({ id: id++, element_type: 2 }));
    }
    for (let i = 0; i < 4; i++) {
      xi.push(createMockPlayer({ id: id++, element_type: 3 }));
    }
    for (let i = 0; i < 3; i++) {
      xi.push(createMockPlayer({ id: id++, element_type: 4 }));
    }

    const result = validateFormation(xi);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "GK_COUNT")).toBe(true);
  });

  it("rejects XI with two goalkeepers", () => {
    const xi = createStartingXI([4, 4, 2]);
    // Replace a defender with a GK
    xi[1] = createMockPlayer({ id: 100, element_type: 1 });

    const result = validateFormation(xi);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "GK_COUNT")).toBe(true);
  });

  it("rejects XI with wrong player count (10 players)", () => {
    const xi = createStartingXI([4, 4, 2]).slice(0, 10);
    const result = validateFormation(xi);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "XI_SIZE")).toBe(true);
  });

  it("rejects XI with wrong player count (12 players)", () => {
    const xi = createStartingXI([4, 4, 2]);
    xi.push(createMockPlayer({ id: 100, element_type: 3 }));
    const result = validateFormation(xi);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "XI_SIZE")).toBe(true);
  });
});

// =============================================================================
// Formation Label Tests
// =============================================================================

describe("getFormationLabel", () => {
  it("returns correct 4-4-2 label", () => {
    const xi = createStartingXI([4, 4, 2]);
    expect(getFormationLabel(xi)).toBe("4-4-2");
  });

  it("returns correct 3-5-2 label", () => {
    const xi = createStartingXI([3, 5, 2]);
    expect(getFormationLabel(xi)).toBe("3-5-2");
  });

  it("returns correct 5-4-1 label", () => {
    const xi = createStartingXI([5, 4, 1]);
    expect(getFormationLabel(xi)).toBe("5-4-1");
  });

  it("returns label for invalid formations too", () => {
    const xi = createStartingXI([2, 5, 3]);
    expect(getFormationLabel(xi)).toBe("2-5-3");
  });
});

// =============================================================================
// Transfer Cost Tests
// =============================================================================

describe("calculateTransferCost", () => {
  it("calculates zero cost when transfers <= free transfers", () => {
    const result = calculateTransferCost(2, 2);

    expect(result.extraTransfers).toBe(0);
    expect(result.hitCost).toBe(0);
    expect(result.netPointsCost).toBe(0);
  });

  it("calculates zero cost for unused free transfers", () => {
    const result = calculateTransferCost(3, 1);

    expect(result.extraTransfers).toBe(0);
    expect(result.hitCost).toBe(0);
  });

  it("calculates 4 points per extra transfer", () => {
    const result = calculateTransferCost(1, 3);

    expect(result.extraTransfers).toBe(2);
    expect(result.hitCost).toBe(8);
  });

  it("calculates cost for single extra transfer", () => {
    const result = calculateTransferCost(1, 2);

    expect(result.extraTransfers).toBe(1);
    expect(result.hitCost).toBe(4);
  });

  it("handles zero transfers made", () => {
    const result = calculateTransferCost(2, 0);

    expect(result.hitCost).toBe(0);
    expect(result.transfersMade).toBe(0);
  });

  it("tracks free transfers and transfers made", () => {
    const result = calculateTransferCost(2, 5);

    expect(result.freeTransfers).toBe(2);
    expect(result.transfersMade).toBe(5);
    expect(result.extraTransfers).toBe(3);
    expect(result.hitCost).toBe(12);
  });
});

// =============================================================================
// Next Free Transfers Tests
// =============================================================================

describe("calculateNextFreeTransfers", () => {
  it("banks 1 FT when no transfers made", () => {
    expect(calculateNextFreeTransfers(1, 0)).toBe(2);
  });

  it("caps at 5 when banking", () => {
    expect(calculateNextFreeTransfers(5, 0)).toBe(5);
    expect(calculateNextFreeTransfers(4, 0)).toBe(5);
  });

  it("resets to 1 when all FTs used", () => {
    expect(calculateNextFreeTransfers(2, 2)).toBe(1);
    expect(calculateNextFreeTransfers(1, 1)).toBe(1);
  });

  it("carries over unused when some transfers made", () => {
    expect(calculateNextFreeTransfers(3, 1)).toBe(3); // 3 - 1 + 1 = 3
    expect(calculateNextFreeTransfers(5, 2)).toBe(4); // 5 - 2 + 1 = 4
  });

  it("handles taking hits correctly", () => {
    // Taking hits means using more than available
    expect(calculateNextFreeTransfers(1, 3)).toBe(1); // Used 3 with 1 FT, -4 point hit, back to 1 FT
  });

  it("banks correctly from 2 to 3", () => {
    expect(calculateNextFreeTransfers(2, 0)).toBe(3);
  });

  it("banks correctly from 3 to 4", () => {
    expect(calculateNextFreeTransfers(3, 0)).toBe(4);
  });
});

// =============================================================================
// Chip Availability Tests
// =============================================================================

describe("getAvailableChips", () => {
  it("returns all chips when none used", () => {
    const available = getAvailableChips([], 10);

    expect(available).toHaveLength(4);
    expect(available.map((c) => c.name)).toContain("wildcard");
    expect(available.map((c) => c.name)).toContain("freehit");
    expect(available.map((c) => c.name)).toContain("3xc");
    expect(available.map((c) => c.name)).toContain("bboost");
  });

  it("excludes used single-use chips", () => {
    const usedChips = [{ name: "freehit", event: 15 }];
    const available = getAvailableChips(usedChips, 20);

    expect(available.map((c) => c.name)).not.toContain("freehit");
    expect(available).toHaveLength(3);
  });

  it("excludes triple captain when used", () => {
    const usedChips = [{ name: "3xc", event: 10 }];
    const available = getAvailableChips(usedChips, 15);

    expect(available.map((c) => c.name)).not.toContain("3xc");
  });

  it("excludes bench boost when used", () => {
    const usedChips = [{ name: "bboost", event: 25 }];
    const available = getAvailableChips(usedChips, 30);

    expect(available.map((c) => c.name)).not.toContain("bboost");
  });

  it("allows first wildcard in first half of season", () => {
    const available = getAvailableChips([], 10);
    expect(available.map((c) => c.name)).toContain("wildcard");
  });

  it("allows second wildcard in second half after using first", () => {
    const usedChips = [{ name: "wildcard", event: 10 }];
    const available = getAvailableChips(usedChips, 25);

    expect(available.map((c) => c.name)).toContain("wildcard");
  });

  it("excludes wildcard in first half if already used", () => {
    const usedChips = [{ name: "wildcard", event: 5 }];
    const available = getAvailableChips(usedChips, 15);

    expect(available.map((c) => c.name)).not.toContain("wildcard");
  });

  it("excludes wildcard in second half if already used", () => {
    const usedChips = [{ name: "wildcard", event: 25 }];
    const available = getAvailableChips(usedChips, 30);

    expect(available.map((c) => c.name)).not.toContain("wildcard");
  });

  it("returns no chips when all used", () => {
    const usedChips = [
      { name: "wildcard", event: 5 },
      { name: "wildcard", event: 25 },
      { name: "freehit", event: 15 },
      { name: "3xc", event: 20 },
      { name: "bboost", event: 30 },
    ];
    const available = getAvailableChips(usedChips, 35);

    expect(available).toHaveLength(0);
  });

  it("handles boundary GW 19 (first half)", () => {
    const usedChips = [{ name: "wildcard", event: 19 }];
    const available = getAvailableChips(usedChips, 19);

    // Used in first half, still in first half
    expect(available.map((c) => c.name)).not.toContain("wildcard");
  });

  it("handles boundary GW 20 (second half)", () => {
    const usedChips = [{ name: "wildcard", event: 10 }];
    const available = getAvailableChips(usedChips, 20);

    // Used in first half, now in second half - should be available
    expect(available.map((c) => c.name)).toContain("wildcard");
  });
});

// =============================================================================
// Auto-Sub Simulation Tests
// =============================================================================

describe("simulateAutoSubs", () => {
  it("makes no subs when all starters play", () => {
    const xi = createStartingXI([4, 4, 2]);
    const bench = [
      createMockPlayer({ id: 12, element_type: 1, team: 15 }),
      createMockPlayer({ id: 13, element_type: 2, team: 16 }),
      createMockPlayer({ id: 14, element_type: 3, team: 17 }),
      createMockPlayer({ id: 15, element_type: 4, team: 18 }),
    ];

    const didNotPlay = new Set<number>();
    const result = simulateAutoSubs(xi, bench, didNotPlay);

    expect(result.subsIn).toHaveLength(0);
    expect(result.subsOut).toHaveLength(0);
    expect(result.finalXI).toHaveLength(11);
  });

  it("subs in bench player when starter does not play", () => {
    const xi = createStartingXI([4, 4, 2]);
    const bench = [
      createMockPlayer({ id: 12, element_type: 1, team: 15 }),
      createMockPlayer({ id: 13, element_type: 2, team: 16 }),
      createMockPlayer({ id: 14, element_type: 3, team: 17 }),
      createMockPlayer({ id: 15, element_type: 4, team: 18 }),
    ];

    // One midfielder didn't play
    const didNotPlay = new Set([xi[5].id]); // 5th player is a midfielder
    const result = simulateAutoSubs(xi, bench, didNotPlay);

    expect(result.subsOut).toContain(xi[5].id);
    expect(result.subsIn.length).toBeGreaterThan(0);
    expect(result.finalXI).toHaveLength(11);
  });

  it("maintains valid formation after subs", () => {
    const xi = createStartingXI([4, 4, 2]);
    const bench = [
      createMockPlayer({ id: 12, element_type: 1, team: 15 }),
      createMockPlayer({ id: 13, element_type: 2, team: 16 }),
      createMockPlayer({ id: 14, element_type: 3, team: 17 }),
      createMockPlayer({ id: 15, element_type: 4, team: 18 }),
    ];

    const didNotPlay = new Set([xi[1].id]); // First defender
    const result = simulateAutoSubs(xi, bench, didNotPlay);

    const validation = validateFormation(result.finalXI);
    expect(validation.valid).toBe(true);
  });

  it("skips bench players who also did not play", () => {
    const xi = createStartingXI([4, 4, 2]);
    const bench = [
      createMockPlayer({ id: 12, element_type: 1, team: 15 }),
      createMockPlayer({ id: 13, element_type: 2, team: 16 }),
      createMockPlayer({ id: 14, element_type: 3, team: 17 }),
      createMockPlayer({ id: 15, element_type: 4, team: 18 }),
    ];

    // First midfielder didn't play, first bench player also didn't
    const didNotPlay = new Set([xi[5].id, 12]);
    const result = simulateAutoSubs(xi, bench, didNotPlay);

    // Should skip player 12 and use player 13 or later
    expect(result.subsIn).not.toContain(12);
  });

  it("handles multiple players not playing", () => {
    const xi = createStartingXI([4, 4, 2]);
    const bench = [
      createMockPlayer({ id: 12, element_type: 1, team: 15 }),
      createMockPlayer({ id: 13, element_type: 2, team: 16 }),
      createMockPlayer({ id: 14, element_type: 3, team: 17 }),
      createMockPlayer({ id: 15, element_type: 4, team: 18 }),
    ];

    // Two midfielders didn't play
    const didNotPlay = new Set([xi[5].id, xi[6].id]);
    const result = simulateAutoSubs(xi, bench, didNotPlay);

    expect(result.subsOut.length).toBe(2);
    expect(result.subsIn.length).toBe(2);
  });

  it("does not sub in GK for outfield player", () => {
    const xi = createStartingXI([4, 4, 2]);
    const bench = [
      createMockPlayer({ id: 12, element_type: 1, team: 15 }), // GK first on bench
      createMockPlayer({ id: 13, element_type: 2, team: 16 }),
      createMockPlayer({ id: 14, element_type: 3, team: 17 }),
      createMockPlayer({ id: 15, element_type: 4, team: 18 }),
    ];

    // Midfielder didn't play
    const didNotPlay = new Set([xi[5].id]);
    const result = simulateAutoSubs(xi, bench, didNotPlay);

    // Should not sub in the bench GK for a midfielder
    expect(result.subsIn).not.toContain(12);
  });
});
