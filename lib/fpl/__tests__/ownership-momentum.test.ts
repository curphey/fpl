import { describe, it, expect } from "vitest";
import {
  calculatePlayerMomentum,
  analyzeOwnershipMomentum,
  formatMomentumPercent,
  getMomentumColorClass,
  getMomentumBgClass,
} from "../ownership-momentum";
import type { EnrichedPlayer } from "../utils";

// Helper to create mock player
function createMockPlayer(
  overrides: Partial<EnrichedPlayer> = {},
): EnrichedPlayer {
  return {
    id: 1,
    web_name: "Test Player",
    first_name: "Test",
    second_name: "Player",
    element_type: 3,
    team: 1,
    team_short_name: "TST",
    position_short: "MID",
    now_cost: 100,
    selected_by_percent: "10.0",
    transfers_in_event: 50000,
    transfers_out_event: 50000,
    form: "5.0",
    total_points: 100,
    minutes: 900,
    goals_scored: 5,
    assists: 3,
    clean_sheets: 0,
    expected_goals: "4.5",
    expected_assists: "2.5",
    expected_goal_involvements: "7.0",
    bonus: 10,
    bps: 200,
    cost_change_event: 0,
    cost_change_start: 0,
    chance_of_playing_next_round: 100,
    chance_of_playing_this_round: 100,
    news: "",
    news_added: null,
    status: "a",
    ...overrides,
  } as EnrichedPlayer;
}

describe("calculatePlayerMomentum", () => {
  it("returns null for players with very low ownership", () => {
    const player = createMockPlayer({ selected_by_percent: "0.05" });
    const result = calculatePlayerMomentum(player);
    expect(result).toBeNull();
  });

  it("returns null for players with minimal transfer activity", () => {
    const player = createMockPlayer({
      transfers_in_event: 100,
      transfers_out_event: 100,
    });
    const result = calculatePlayerMomentum(player);
    expect(result).toBeNull();
  });

  it("calculates positive momentum for rising player", () => {
    const player = createMockPlayer({
      transfers_in_event: 80000,
      transfers_out_event: 20000,
    });
    const result = calculatePlayerMomentum(player);

    expect(result).not.toBeNull();
    expect(result!.netTransfers).toBe(60000);
    expect(result!.totalTransfers).toBe(100000);
    expect(result!.momentumScore).toBe(0.6);
    expect(result!.trend).toBe("rising");
  });

  it("calculates negative momentum for falling player", () => {
    const player = createMockPlayer({
      transfers_in_event: 20000,
      transfers_out_event: 80000,
    });
    const result = calculatePlayerMomentum(player);

    expect(result).not.toBeNull();
    expect(result!.netTransfers).toBe(-60000);
    expect(result!.momentumScore).toBe(-0.6);
    expect(result!.trend).toBe("falling");
  });

  it("identifies stable players", () => {
    const player = createMockPlayer({
      transfers_in_event: 55000,
      transfers_out_event: 45000,
    });
    const result = calculatePlayerMomentum(player);

    expect(result).not.toBeNull();
    expect(result!.trend).toBe("stable");
  });

  it("identifies differentials", () => {
    const player = createMockPlayer({
      selected_by_percent: "5.0",
      transfers_in_event: 80000,
      transfers_out_event: 20000,
    });
    const result = calculatePlayerMomentum(player);

    expect(result!.isDifferential).toBe(true);
  });

  it("does not mark high-owned players as differentials", () => {
    const player = createMockPlayer({
      selected_by_percent: "25.0",
      transfers_in_event: 80000,
      transfers_out_event: 20000,
    });
    const result = calculatePlayerMomentum(player);

    expect(result!.isDifferential).toBe(false);
  });

  it("calculates risk level for falling players", () => {
    const highRisk = createMockPlayer({
      transfers_in_event: 10000,
      transfers_out_event: 90000,
    });
    const mediumRisk = createMockPlayer({
      transfers_in_event: 30000,
      transfers_out_event: 70000,
    });
    const lowRisk = createMockPlayer({
      transfers_in_event: 40000,
      transfers_out_event: 60000,
    });

    expect(calculatePlayerMomentum(highRisk)!.riskLevel).toBe("high");
    expect(calculatePlayerMomentum(mediumRisk)!.riskLevel).toBe("medium");
    expect(calculatePlayerMomentum(lowRisk)!.riskLevel).toBe("low");
  });

  it("marks rising players with no risk", () => {
    const player = createMockPlayer({
      transfers_in_event: 80000,
      transfers_out_event: 20000,
    });
    const result = calculatePlayerMomentum(player);

    expect(result!.riskLevel).toBe("none");
  });
});

describe("analyzeOwnershipMomentum", () => {
  it("returns analysis with all categories", () => {
    const players = [
      createMockPlayer({
        id: 1,
        web_name: "Rising Star",
        transfers_in_event: 90000,
        transfers_out_event: 10000,
        selected_by_percent: "15.0",
      }),
      createMockPlayer({
        id: 2,
        web_name: "Falling Asset",
        transfers_in_event: 10000,
        transfers_out_event: 90000,
        selected_by_percent: "30.0",
      }),
      createMockPlayer({
        id: 3,
        web_name: "Emerging Diff",
        transfers_in_event: 80000,
        transfers_out_event: 20000,
        selected_by_percent: "5.0",
      }),
    ];

    const analysis = analyzeOwnershipMomentum(players);

    expect(analysis.risingStars.length).toBeGreaterThan(0);
    expect(analysis.fallingAssets.length).toBeGreaterThan(0);
    expect(analysis.emergingDifferentials.length).toBeGreaterThan(0);
  });

  it("calculates stats correctly", () => {
    const players = [
      createMockPlayer({
        id: 1,
        transfers_in_event: 80000,
        transfers_out_event: 20000,
      }),
      createMockPlayer({
        id: 2,
        transfers_in_event: 20000,
        transfers_out_event: 80000,
      }),
    ];

    const analysis = analyzeOwnershipMomentum(players);

    expect(analysis.stats.totalPlayersAnalyzed).toBe(2);
    expect(analysis.stats.highestMomentum).not.toBeNull();
    expect(analysis.stats.lowestMomentum).not.toBeNull();
    expect(analysis.stats.averageMomentum).toBe(0); // +0.6 and -0.6 average to 0
  });

  it("filters out low-activity players", () => {
    const players = [
      createMockPlayer({
        id: 1,
        transfers_in_event: 100,
        transfers_out_event: 100,
      }),
    ];

    const analysis = analyzeOwnershipMomentum(players);

    expect(analysis.stats.totalPlayersAnalyzed).toBe(0);
  });

  it("identifies template exits (high owned + falling)", () => {
    const players = [
      createMockPlayer({
        id: 1,
        web_name: "Template Exit",
        transfers_in_event: 10000,
        transfers_out_event: 90000,
        selected_by_percent: "35.0",
      }),
    ];

    const analysis = analyzeOwnershipMomentum(players);

    expect(analysis.templateExits.length).toBe(1);
    expect(analysis.templateExits[0].player.web_name).toBe("Template Exit");
  });
});

describe("formatMomentumPercent", () => {
  it("formats positive momentum with plus sign", () => {
    expect(formatMomentumPercent(0.6)).toBe("+60%");
    expect(formatMomentumPercent(0.25)).toBe("+25%");
  });

  it("formats negative momentum", () => {
    expect(formatMomentumPercent(-0.6)).toBe("-60%");
    expect(formatMomentumPercent(-0.25)).toBe("-25%");
  });

  it("formats zero as no sign", () => {
    expect(formatMomentumPercent(0)).toBe("0%");
  });

  it("rounds to nearest percent", () => {
    expect(formatMomentumPercent(0.666)).toBe("+67%");
    expect(formatMomentumPercent(0.333)).toBe("+33%");
  });
});

describe("getMomentumColorClass", () => {
  it("returns green for high positive momentum", () => {
    expect(getMomentumColorClass(0.6)).toBe("text-fpl-green");
  });

  it("returns light green for medium positive momentum", () => {
    expect(getMomentumColorClass(0.3)).toBe("text-green-400");
  });

  it("returns danger for high negative momentum", () => {
    expect(getMomentumColorClass(-0.6)).toBe("text-fpl-danger");
  });

  it("returns orange for medium negative momentum", () => {
    expect(getMomentumColorClass(-0.3)).toBe("text-orange-400");
  });

  it("returns muted for stable momentum", () => {
    expect(getMomentumColorClass(0.1)).toBe("text-fpl-muted");
    expect(getMomentumColorClass(-0.1)).toBe("text-fpl-muted");
  });
});

describe("getMomentumBgClass", () => {
  it("returns green background for high positive momentum", () => {
    expect(getMomentumBgClass(0.6)).toBe("bg-fpl-green/20");
  });

  it("returns danger background for high negative momentum", () => {
    expect(getMomentumBgClass(-0.6)).toBe("bg-fpl-danger/20");
  });

  it("returns purple background for stable momentum", () => {
    expect(getMomentumBgClass(0)).toBe("bg-fpl-purple-light");
  });
});
