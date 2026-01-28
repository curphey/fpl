import { describe, it, expect } from "vitest";
import {
  buildTransferPrompt,
  buildChipPrompt,
  buildWildcardPrompt,
  buildSystemPrompt,
} from "../prompts";
import type {
  TransferConstraints,
  ChipConstraints,
  WildcardConstraints,
  TeamContext,
  LeagueContext,
} from "../types";

describe("buildTransferPrompt", () => {
  const defaultConstraints: TransferConstraints = {
    budget: 2.5,
    maxTransfers: 2,
    lookAheadWeeks: 5,
  };

  const playerData = `### MID
- Salah (LIV) £13.0m | Form: 8.5 | Pts: 150 | Own: 45% | xPts: 6.5`;

  const fixtureData = `LIV: GW20: MCI(4), GW21: EVE(2)`;

  it("includes user query in prompt", () => {
    const prompt = buildTransferPrompt(
      "Find best midfielders under 10m",
      defaultConstraints,
      undefined,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Find best midfielders under 10m");
  });

  it("includes budget constraint", () => {
    const prompt = buildTransferPrompt(
      "Test query",
      { ...defaultConstraints, budget: 3.5 },
      undefined,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("£3.5m");
  });

  it("includes max transfers constraint", () => {
    const prompt = buildTransferPrompt(
      "Test query",
      { ...defaultConstraints, maxTransfers: 3 },
      undefined,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Maximum transfers: 3");
  });

  it("includes position needs when specified", () => {
    const prompt = buildTransferPrompt(
      "Test query",
      { ...defaultConstraints, positionNeeds: ["DEF", "MID"] },
      undefined,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Position needs: DEF, MID");
  });

  it("includes exclude players when specified", () => {
    const prompt = buildTransferPrompt(
      "Test query",
      { ...defaultConstraints, excludePlayers: ["Salah", "Haaland"] },
      undefined,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Exclude players: Salah, Haaland");
  });

  it("includes must include players when specified", () => {
    const prompt = buildTransferPrompt(
      "Test query",
      { ...defaultConstraints, mustInclude: ["Palmer"] },
      undefined,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Must include: Palmer");
  });

  it("includes team context when provided", () => {
    const team: TeamContext = {
      players: [
        { id: 1, name: "Salah", position: "MID", team: "LIV", price: 13.0 },
        { id: 2, name: "Haaland", position: "FWD", team: "MCI", price: 15.0 },
      ],
      bank: 1.5,
      freeTransfers: 2,
      chipsUsed: ["wildcard"],
    };

    const prompt = buildTransferPrompt(
      "Test query",
      defaultConstraints,
      team,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Current Team");
    expect(prompt).toContain("Salah");
    expect(prompt).toContain("Bank: £1.5m");
    expect(prompt).toContain("Free Transfers: 2");
    expect(prompt).toContain("wildcard");
  });

  it("includes league context when provided", () => {
    const league: LeagueContext = {
      rank: 15,
      totalManagers: 100,
      gapToLeader: 50,
      gameweeksRemaining: 18,
    };

    const prompt = buildTransferPrompt(
      "Test query",
      defaultConstraints,
      undefined,
      league,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("League Context");
    expect(prompt).toContain("Rank: 15 of 100");
    expect(prompt).toContain("Gap to Leader: 50 points");
    expect(prompt).toContain("Gameweeks Remaining: 18");
  });

  it("includes player data", () => {
    const prompt = buildTransferPrompt(
      "Test query",
      defaultConstraints,
      undefined,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Salah (LIV)");
    expect(prompt).toContain("Form: 8.5");
  });

  it("includes fixture data", () => {
    const prompt = buildTransferPrompt(
      "Test query",
      defaultConstraints,
      undefined,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("LIV: GW20: MCI(4)");
  });

  it("includes FPL rules reminder", () => {
    const prompt = buildTransferPrompt(
      "Test query",
      defaultConstraints,
      undefined,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("FPL Rules Reminder");
    expect(prompt).toContain("Max 3 players from any single team");
  });

  it("requests JSON response format", () => {
    const prompt = buildTransferPrompt(
      "Test query",
      defaultConstraints,
      undefined,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("JSON object");
    expect(prompt).toContain('"recommendations"');
  });
});

describe("buildChipPrompt", () => {
  const defaultConstraints: ChipConstraints = {
    chip: "benchboost",
    remainingChips: ["wildcard", "freehit"],
  };

  const fixtureData = `LIV: GW20: MCI(4), GW21: EVE(2)`;

  it("includes user query", () => {
    const prompt = buildChipPrompt(
      "When should I use Bench Boost?",
      defaultConstraints,
      undefined,
      undefined,
      fixtureData,
    );

    expect(prompt).toContain("When should I use Bench Boost?");
  });

  it("includes chip name", () => {
    const prompt = buildChipPrompt(
      "Test query",
      { ...defaultConstraints, chip: "triplecaptain" },
      undefined,
      undefined,
      fixtureData,
    );

    expect(prompt).toContain("TRIPLECAPTAIN");
  });

  it("includes remaining chips", () => {
    const prompt = buildChipPrompt(
      "Test query",
      defaultConstraints,
      undefined,
      undefined,
      fixtureData,
    );

    expect(prompt).toContain("wildcard, freehit");
  });

  it("includes chip strategy guidelines", () => {
    const prompt = buildChipPrompt(
      "Test query",
      defaultConstraints,
      undefined,
      undefined,
      fixtureData,
    );

    expect(prompt).toContain("Chip Strategy Guidelines");
    expect(prompt).toContain("Bench Boost");
    expect(prompt).toContain("Triple Captain");
  });

  it("requests JSON response with recommendation", () => {
    const prompt = buildChipPrompt(
      "Test query",
      defaultConstraints,
      undefined,
      undefined,
      fixtureData,
    );

    expect(prompt).toContain('"recommendedGameweek"');
    expect(prompt).toContain('"confidence"');
  });
});

describe("buildWildcardPrompt", () => {
  const defaultConstraints: WildcardConstraints = {
    budget: 100,
    lookAheadWeeks: 8,
  };

  const playerData = `### FWD
- Haaland (MCI) £15.0m | Form: 9.0 | Pts: 180`;

  const fixtureData = `MCI: GW20: LIV(4), GW21: NEW(2)`;

  it("includes user query", () => {
    const prompt = buildWildcardPrompt(
      "Build me a strong team",
      defaultConstraints,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Build me a strong team");
  });

  it("includes total budget", () => {
    const prompt = buildWildcardPrompt(
      "Test query",
      defaultConstraints,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Total budget: £100m");
  });

  it("includes look ahead weeks", () => {
    const prompt = buildWildcardPrompt(
      "Test query",
      { ...defaultConstraints, lookAheadWeeks: 10 },
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Look ahead: 10 gameweeks");
  });

  it("includes preferred formation when specified", () => {
    const prompt = buildWildcardPrompt(
      "Test query",
      { ...defaultConstraints, preferredFormation: "3-5-2" },
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Preferred formation: 3-5-2");
  });

  it("includes squad rules", () => {
    const prompt = buildWildcardPrompt(
      "Test query",
      defaultConstraints,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain("Squad Rules");
    expect(prompt).toContain("2 Goalkeepers");
    expect(prompt).toContain("5 Defenders");
    expect(prompt).toContain("5 Midfielders");
    expect(prompt).toContain("3 Forwards");
  });

  it("requests JSON response with team", () => {
    const prompt = buildWildcardPrompt(
      "Test query",
      defaultConstraints,
      undefined,
      playerData,
      fixtureData,
    );

    expect(prompt).toContain('"team"');
    expect(prompt).toContain('"formation"');
    expect(prompt).toContain('"keyPicks"');
  });
});

describe("buildSystemPrompt", () => {
  it("establishes FPL expertise", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("Fantasy Premier League");
    expect(prompt).toContain("expert");
  });

  it("mentions key FPL concepts", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("form");
    expect(prompt).toContain("Fixture");
    expect(prompt).toContain("Chip");
  });

  it("requests data-driven recommendations", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("data-driven");
  });

  it("requires JSON output", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("JSON");
  });
});
