import { describe, it, expect } from "vitest";
import {
  buildGwPlanPrompt,
  parseGwPlanResult,
  GW_PLAN_SYSTEM_PROMPT,
} from "../gw-plan-client";
import type { GwPlanRequest } from "../gw-plan-client";

const baseRequest: GwPlanRequest = {
  gameweek: 28,
  squad: [
    {
      id: 1,
      name: "Salah",
      team: "LIV",
      position: "MID",
      predictedPtsNextGW: 9.2,
      predicted4GW: 32.1,
      form: "9.0",
      upcomingDifficulty: 2.0,
      sellingPrice: 12.5,
      isStarter: true,
    },
    {
      id: 5,
      name: "BenchPlayer",
      team: "EVE",
      position: "MID",
      predictedPtsNextGW: 2.1,
      predicted4GW: 8.4,
      form: "2.0",
      upcomingDifficulty: 4.0,
      sellingPrice: 4.5,
      isStarter: false,
      benchPriority: 2,
    },
  ],
  freeTransfers: 1,
  bank: 5, // £0.5m
  topTargets: [
    {
      id: 2,
      name: "Haaland",
      team: "MCI",
      position: "FWD",
      score: 8.5,
      predicted4GW: 28.0,
      form: "7.5",
      upcomingDifficulty: 2.5,
      cost: 14.0,
    },
  ],
  captainOptions: [
    {
      id: 1,
      name: "Salah",
      score: 9.1,
      opponentShortName: "PAL",
      isHome: true,
    },
  ],
};

describe("buildGwPlanPrompt", () => {
  it("includes gameweek number", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("GW28");
  });

  it("includes squad player name", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("Salah");
  });

  it("includes free transfers count", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("1");
  });

  it("includes top transfer target", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("Haaland");
  });

  it("includes captain option with opponent", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("PAL");
  });

  it("includes JSON schema instructions", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("predictedTeamPoints");
    expect(prompt).toContain("transfers");
  });

  it("includes squad player selling price", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("£12.5m");
  });

  it("includes transfer target cost", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("£14.0m");
  });

  it("includes squad player id so Claude echoes real FPL element IDs", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("[1]"); // Salah's id
  });

  it("includes transfer target id so Claude echoes real FPL element IDs", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("[2]"); // Haaland's id
  });

  it("includes captain option id so Claude echoes real FPL element IDs", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    // captain options section should reference player id 1
    expect(prompt).toMatch(/\[1\].*Salah/);
  });

  it("includes budget affordability guidance", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("affordable");
  });

  it("explains the points hit mechanic", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("4 points");
  });

  it("includes hitCost in the JSON schema", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("hitCost");
  });

  it("mentions multi-transfer budget strategy", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("multiple");
  });

  it("separates starting XI from bench players", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toMatch(/Starting XI/i);
    expect(prompt).toMatch(/Bench/i);
    // Salah is a starter, BenchPlayer is on bench
    const starterIdx = prompt.indexOf("Salah");
    const benchIdx = prompt.indexOf("BenchPlayer");
    expect(starterIdx).toBeGreaterThan(-1);
    expect(benchIdx).toBeGreaterThan(-1);
    // Salah should appear in starting XI section (before Bench heading)
    const benchHeadingIdx = prompt.search(/Bench/i);
    expect(starterIdx).toBeLessThan(benchHeadingIdx);
    expect(benchIdx).toBeGreaterThan(benchHeadingIdx);
  });

  it("includes bench priority for bench players", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    // BenchPlayer has benchPriority: 2
    expect(prompt).toMatch(/Slot 2.*BenchPlayer|BenchPlayer.*Slot 2/i);
  });

  it("includes substitutions in the JSON schema", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain('"substitutions"');
  });
});

describe("GW plan prompt — substitutions schema", () => {
  it("system prompt instructs Claude to output substitutions", () => {
    expect(GW_PLAN_SYSTEM_PROMPT).toContain("substitutions");
    expect(GW_PLAN_SYSTEM_PROMPT).toContain("Substitutions");
  });

  it("buildGwPlanPrompt JSON schema includes substitutions array", () => {
    const prompt = buildGwPlanPrompt({
      gameweek: 28,
      squad: [],
      freeTransfers: 1,
      bank: 10,
      topTargets: [],
      captainOptions: [],
    });
    expect(prompt).toContain('"substitutions"');
    expect(prompt).toContain('"playerOut"');
    expect(prompt).toContain('"playerIn"');
    // bench player coming on
    expect(prompt).toContain("bench player");
  });

  it("buildGwPlanPrompt JSON schema does not include benchAdvice", () => {
    const prompt = buildGwPlanPrompt({
      gameweek: 28,
      squad: [],
      freeTransfers: 1,
      bank: 10,
      topTargets: [],
      captainOptions: [],
    });
    expect(prompt).not.toContain('"benchAdvice"');
  });
});

describe("GW_PLAN_SYSTEM_PROMPT", () => {
  it("enforces same-position-only transfers (GK→GK, DEF→DEF, MID→MID, FWD→FWD)", () => {
    expect(GW_PLAN_SYSTEM_PROMPT).toMatch(
      /GK.*GK|DEF.*DEF|same.*position|position.*same/i,
    );
  });

  it("includes bench/substitution analysis instruction", () => {
    expect(GW_PLAN_SYSTEM_PROMPT).toMatch(/bench/i);
  });
});

describe("parseGwPlanResult", () => {
  it("parses valid JSON response", () => {
    const json = JSON.stringify({
      predictedTeamPoints: 62,
      captain: { playerId: 1, name: "Salah", reasoning: "good fixtures" },
      transfers: [
        {
          playerOut: { id: 100, name: "Saka", predicted4GW: 18 },
          playerIn: { id: 200, name: "Palmer", predicted4GW: 26 },
          pointsGain: 8.0,
          hitCost: 0,
          reasoning: "Palmer in form",
        },
      ],
      notes: "No chip needed",
    });
    const result = parseGwPlanResult(json);
    expect(result.predictedTeamPoints).toBe(62);
    expect(result.captain.name).toBe("Salah");
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0].pointsGain).toBe(8.0);
    expect(result.transfers[0].hitCost).toBe(0);
    expect(result.notes).toBe("No chip needed");
  });

  it("parses hitCost on transfers that take a hit", () => {
    const json = JSON.stringify({
      predictedTeamPoints: 55,
      captain: { playerId: 1, name: "Salah", reasoning: "" },
      transfers: [
        {
          playerOut: { id: 1, name: "A", predicted4GW: 10 },
          playerIn: { id: 2, name: "B", predicted4GW: 18 },
          pointsGain: 4.0,
          hitCost: 4,
          reasoning: "Worth the hit",
        },
      ],
      notes: "",
    });
    const result = parseGwPlanResult(json);
    expect(result.transfers[0].hitCost).toBe(4);
  });

  it("parses JSON wrapped in markdown code block", () => {
    const text =
      'Here is the plan:\n```json\n{"predictedTeamPoints":55,"captain":{"playerId":1,"name":"Haaland","reasoning":"top scorer"},"transfers":[],"notes":""}\n```';
    const result = parseGwPlanResult(text);
    expect(result.predictedTeamPoints).toBe(55);
    expect(result.captain.name).toBe("Haaland");
  });

  it("returns safe defaults on parse error", () => {
    const result = parseGwPlanResult("not valid json {{{");
    expect(result.predictedTeamPoints).toBe(0);
    expect(result.captain.name).toBe("Unknown");
    expect(result.transfers).toEqual([]);
    expect(result.notes).toContain("Parse error");
  });

  it("handles missing optional fields with defaults", () => {
    const result = parseGwPlanResult(
      JSON.stringify({ predictedTeamPoints: 50 }),
    );
    expect(result.transfers).toEqual([]);
    expect(result.notes).toBe("");
  });

  it("parses benchAdvice field", () => {
    const json = JSON.stringify({
      predictedTeamPoints: 60,
      captain: { playerId: 1, name: "Salah", reasoning: "" },
      transfers: [],
      benchAdvice: "Swap Slot 1 and Slot 2 for better auto-sub coverage.",
      notes: "",
    });
    const result = parseGwPlanResult(json);
    expect(result.benchAdvice).toBe(
      "Swap Slot 1 and Slot 2 for better auto-sub coverage.",
    );
  });

  it("defaults benchAdvice to empty string when absent", () => {
    const json = JSON.stringify({
      predictedTeamPoints: 60,
      captain: { playerId: 1, name: "Salah", reasoning: "" },
      transfers: [],
      notes: "",
    });
    const result = parseGwPlanResult(json);
    expect(result.benchAdvice).toBe("");
  });

  it("parseGwPlanResult extracts substitutions array", () => {
    const raw = JSON.stringify({
      predictedTeamPoints: 55,
      captain: { playerId: 1, name: "Salah", reasoning: "Good fixture" },
      transfers: [],
      substitutions: [
        {
          playerOut: { id: 10, name: "Garner" },
          playerIn: { id: 20, name: "Dalot" },
          reasoning: "Dalot has better predicted points this week",
        },
      ],
      notes: "",
    });

    const result = parseGwPlanResult(raw);
    expect(result.substitutions).toHaveLength(1);
    expect(result.substitutions[0].playerOut.name).toBe("Garner");
    expect(result.substitutions[0].playerIn.name).toBe("Dalot");
  });

  it("parseGwPlanResult defaults substitutions to empty array when absent", () => {
    const raw = JSON.stringify({
      predictedTeamPoints: 55,
      captain: { playerId: 1, name: "Salah", reasoning: "" },
      transfers: [],
      notes: "",
    });

    const result = parseGwPlanResult(raw);
    expect(result.substitutions).toEqual([]);
  });
});
