import { describe, it, expect } from "vitest";
import {
  buildChipPlanPrompt,
  parseChipPlanResult,
  type ChipPlanRequest,
} from "@/lib/claude/chip-plan-client";

const BASE_REQ: ChipPlanRequest = {
  chipType: "wildcard",
  gameweek: 28,
  budget: 1000, // £100.0m in 0.1m units
  currentSquad: [
    { id: 1, name: "Raya", position: "GK", sellingPrice: 5.5 },
    { id: 2, name: "Flekken", position: "GK", sellingPrice: 4.5 },
  ],
  candidates: {
    GK: [
      {
        id: 10,
        name: "Raya",
        team: "ARS",
        position: "GK",
        cost: 5.5,
        predictedNextGW: 7,
        predicted4GW: 28,
        form: "7.0",
        upcomingDifficulty: 2,
      },
    ],
    DEF: [],
    MID: [],
    FWD: [],
  },
};

describe("buildChipPlanPrompt", () => {
  it("includes the chip type in the prompt", () => {
    const prompt = buildChipPlanPrompt(BASE_REQ);
    expect(prompt).toContain("WILDCARD");
    expect(prompt).toContain("GW28");
  });

  it("shows budget in £m", () => {
    const prompt = buildChipPlanPrompt(BASE_REQ);
    expect(prompt).toContain("£100.0m");
  });

  it("uses 4-GW optimisation for wildcard", () => {
    const prompt = buildChipPlanPrompt({ ...BASE_REQ, chipType: "wildcard" });
    expect(prompt).toContain("4 gameweek");
  });

  it("uses next-GW optimisation for freehit", () => {
    const prompt = buildChipPlanPrompt({ ...BASE_REQ, chipType: "freehit" });
    expect(prompt).toContain("FREE HIT");
    expect(prompt).toContain("single gameweek");
  });

  it("prompt schema includes formation and formationReasoning", () => {
    const prompt = buildChipPlanPrompt(BASE_REQ);
    expect(prompt).toContain('"formation"');
    expect(prompt).toContain('"formationReasoning"');
  });
});

describe("parseChipPlanResult", () => {
  it("parses valid JSON response", () => {
    const raw = JSON.stringify({
      predictedTeamPoints: 85,
      squad: {
        GK: [
          { id: 1, name: "Raya", cost: 5.5 },
          { id: 2, name: "Flekken", cost: 4.5 },
        ],
        DEF: [
          { id: 3, name: "TAA", cost: 7.0 },
          { id: 4, name: "Pedro", cost: 5.0 },
          { id: 5, name: "Mykolenko", cost: 4.5 },
          { id: 6, name: "Digne", cost: 4.5 },
          { id: 7, name: "Dalot", cost: 5.0 },
        ],
        MID: [
          { id: 8, name: "Salah", cost: 13.0 },
          { id: 9, name: "Palmer", cost: 11.5 },
          { id: 10, name: "Mbeumo", cost: 8.5 },
          { id: 11, name: "Saka", cost: 10.5 },
          { id: 12, name: "Garner", cost: 5.5 },
        ],
        FWD: [
          { id: 13, name: "Isak", cost: 9.5 },
          { id: 14, name: "Watkins", cost: 9.0 },
          { id: 15, name: "Welbeck", cost: 5.5 },
        ],
      },
      startingXI: [1, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14],
      benchOrder: [7, 12, 15, 2],
      captain: { playerId: 8, name: "Salah", reasoning: "Top pick" },
      notes: "Strong squad",
    });
    const result = parseChipPlanResult(raw);
    expect(result.predictedTeamPoints).toBe(85);
    expect(result.squad.GK).toHaveLength(2);
    expect(result.squad.DEF).toHaveLength(5);
    expect(result.squad.MID).toHaveLength(5);
    expect(result.squad.FWD).toHaveLength(3);
    expect(result.startingXI).toHaveLength(11);
    expect(result.benchOrder).toHaveLength(4);
    expect(result.captain.playerId).toBe(8);
  });

  it("returns a fallback on malformed JSON", () => {
    const result = parseChipPlanResult("not json at all");
    expect(result.predictedTeamPoints).toBe(0);
    expect(result.squad.GK).toHaveLength(0);
  });

  it("extracts formation and formationReasoning from response", () => {
    const raw = JSON.stringify({
      predictedTeamPoints: 65,
      squad: { GK: [], DEF: [], MID: [], FWD: [] },
      startingXI: [],
      benchOrder: [],
      captain: { playerId: 1, name: "Salah", reasoning: "test" },
      formation: "4-3-3",
      formationReasoning: "Strong midfield coverage with attacking width",
      notes: "",
    });
    const result = parseChipPlanResult(raw);
    expect(result.formation).toBe("4-3-3");
    expect(result.formationReasoning).toBe("Strong midfield coverage with attacking width");
  });

  it("defaults formation fields to undefined when absent", () => {
    const raw = JSON.stringify({
      predictedTeamPoints: 65,
      squad: { GK: [], DEF: [], MID: [], FWD: [] },
      startingXI: [],
      benchOrder: [],
      captain: { playerId: 1, name: "Salah", reasoning: "test" },
      notes: "",
    });
    const result = parseChipPlanResult(raw);
    expect(result.formation).toBeUndefined();
    expect(result.formationReasoning).toBeUndefined();
  });
});
