# Wildcard & Free Hit Chip Planner — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Wildcard and Free Hit chip buttons to the GW Plan widget that use Claude to recommend a complete 15-player squad rebuild and submit it to FPL with the chip activated.

**Architecture:** New `chip-plan` API route + Claude client for full squad generation, stored in the existing `gw_plans` table with a new `chip_type` column, with a small extension to the `submit` route to activate the chip flag. The GW Plan widget gets chip availability checking and two new buttons.

**Tech Stack:** Next.js App Router, TypeScript, SQLite (better-sqlite3), Anthropic SDK, Zod, Vitest, React

---

## Task 1: DB schema — add `chip_type` column

**Files:**

- Modify: `lib/db/client.ts` (line 93–103)
- Modify: `lib/db/gw-plan.ts` (interface + repository functions)

**Step 1: Write the failing test**

`lib/db/__tests__/gw-plan-chip.test.ts` (new file):

```typescript
import { describe, it, expect } from "vitest";
import { saveGwPlan, getGwPlan } from "@/lib/db/gw-plan";
import type { GwPlanResult } from "@/lib/db/gw-plan";

const PLAN: GwPlanResult = {
  predictedTeamPoints: 60,
  captain: { playerId: 1, name: "Salah", reasoning: "Top pick" },
  transfers: [],
  substitutions: [],
  notes: "",
};

it("saves and retrieves chip_type on a gw_plan", () => {
  const sessionId = "00000000-0000-4000-8000-000000000001";
  const saved = saveGwPlan(sessionId, 99, PLAN, "", "wildcard");
  expect(saved.chipType).toBe("wildcard");

  const fetched = getGwPlan(sessionId, 99);
  expect(fetched?.chipType).toBe("wildcard");
});

it("chipType defaults to undefined when not set", () => {
  const sessionId = "00000000-0000-4000-8000-000000000002";
  const saved = saveGwPlan(sessionId, 98, PLAN, "");
  expect(saved.chipType).toBeUndefined();
});
```

**Step 2: Run to verify it fails**

```bash
npx vitest run lib/db/__tests__/gw-plan-chip.test.ts
```

Expected: FAIL — `saveGwPlan` doesn't accept a 5th arg yet.

**Step 3: Apply the schema migration in `lib/db/client.ts`**

After the `gw_plans` table CREATE (around line 100), add the ALTER TABLE in the `db.exec` block. SQLite `ALTER TABLE ADD COLUMN` is idempotent via a try/catch wrapper because SQLite doesn't support `IF NOT EXISTS` for columns:

```typescript
// After the gw_plans CREATE TABLE and index (around line 103), inside the db.exec() string:
`);

// Migrate: add chip_type column if it doesn't exist yet
try {
  db.exec("ALTER TABLE gw_plans ADD COLUMN chip_type TEXT");
} catch {
  // column already exists — ignore
}
```

**Step 4: Update `lib/db/gw-plan.ts`**

a) Extend `GwPlan` interface:

```typescript
export interface GwPlan {
  id: string;
  sessionId: string;
  gameweek: number;
  plan: GwPlanResult;
  thinking: string;
  generatedAt: string;
  chipType?: "wildcard" | "freehit"; // NEW
}
```

b) Update `saveGwPlan` signature and INSERT:

```typescript
export function saveGwPlan(
  sessionId: string,
  gameweek: number,
  plan: GwPlanResult,
  thinking: string,
  chipType?: "wildcard" | "freehit", // NEW param
): GwPlan {
  const id = randomUUID();
  db.prepare(
    `INSERT OR REPLACE INTO gw_plans (id, session_id, gameweek, plan_json, thinking, chip_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    sessionId,
    gameweek,
    JSON.stringify(plan),
    thinking,
    chipType ?? null,
  );
  return {
    id,
    sessionId,
    gameweek,
    plan,
    thinking,
    generatedAt: new Date().toISOString(),
    chipType,
  };
}
```

c) Update `rowToGwPlan` to include `chipType`:

```typescript
function rowToGwPlan(row: Record<string, unknown>): GwPlan {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    gameweek: row.gameweek as number,
    plan: JSON.parse(row.plan_json as string) as GwPlanResult,
    thinking: (row.thinking as string) ?? "",
    generatedAt: row.generated_at as string,
    chipType: (row.chip_type as "wildcard" | "freehit" | null) ?? undefined,
  };
}
```

**Step 5: Run test to verify it passes**

```bash
npx vitest run lib/db/__tests__/gw-plan-chip.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add lib/db/client.ts lib/db/gw-plan.ts lib/db/__tests__/gw-plan-chip.test.ts
git commit -m "feat: add chip_type column to gw_plans table and extend GwPlan interface"
```

---

## Task 2: Claude client — `chip-plan-client.ts`

**Files:**

- Create: `lib/claude/chip-plan-client.ts`
- Create: `lib/claude/__tests__/chip-plan-client.test.ts`

This follows the exact same structure as `lib/claude/gw-plan-client.ts`.

**Step 1: Write the failing tests**

`lib/claude/__tests__/chip-plan-client.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
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
});
```

**Step 2: Run to verify it fails**

```bash
npx vitest run lib/claude/__tests__/chip-plan-client.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement `lib/claude/chip-plan-client.ts`**

````typescript
/**
 * Claude AI client for Chip Plan generation (Wildcard / Free Hit)
 */

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_CONFIG } from "./client";
import { getAnthropicApiKey } from "@/lib/db/settings";

// =============================================================================
// Types
// =============================================================================

export interface ChipPlanCurrentPlayer {
  id: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  sellingPrice: number; // £m
}

export interface ChipPlanCandidate {
  id: number;
  name: string;
  team: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  cost: number; // buying cost in £m
  predictedNextGW: number;
  predicted4GW: number;
  form: string;
  upcomingDifficulty: number;
}

export interface ChipPlanCandidatesByPosition {
  GK: ChipPlanCandidate[];
  DEF: ChipPlanCandidate[];
  MID: ChipPlanCandidate[];
  FWD: ChipPlanCandidate[];
}

export interface ChipPlanRequest {
  chipType: "wildcard" | "freehit";
  gameweek: number;
  budget: number; // total squad value in 0.1m units (selling prices + bank)
  currentSquad: ChipPlanCurrentPlayer[];
  candidates: ChipPlanCandidatesByPosition;
}

export interface ChipPlanSquadPlayer {
  id: number;
  name: string;
  cost: number; // £m
}

export interface ChipPlanSquad {
  GK: ChipPlanSquadPlayer[];
  DEF: ChipPlanSquadPlayer[];
  MID: ChipPlanSquadPlayer[];
  FWD: ChipPlanSquadPlayer[];
}

export interface ChipPlanRawResult {
  predictedTeamPoints: number;
  squad: ChipPlanSquad;
  startingXI: number[]; // 11 player IDs
  benchOrder: number[]; // 4 player IDs, GK bench last
  captain: { playerId: number; name: string; reasoning: string };
  notes: string;
}

export interface ChipPlanResponse {
  thinking: string;
  result: ChipPlanRawResult;
  processingTime: number;
}

// =============================================================================
// Prompt Builder
// =============================================================================

const CHIP_PLAN_SYSTEM_PROMPT = `You are an expert Fantasy Premier League analyst specialising in chip strategy. Your role is to select the optimal 15-player squad when a chip is activated.

Rules you MUST follow:
1. Pick EXACTLY: 2 GK, 5 DEF, 5 MID, 3 FWD
2. Maximum 3 players from any single club
3. Total cost of all 15 players MUST be ≤ the stated budget
4. Wildcard — optimise for predicted4GW (strongest 4-gameweek horizon)
5. Free Hit — optimise for predictedNextGW (next gameweek only; squad reverts automatically)
6. Output the starting XI (11 players) and bench order (4 players). Bench GK goes last in benchOrder.
7. Point values in text: always round to whole numbers. Write "19 points" not "19.2 points".
8. Reasoning: frame all reasoning in terms of predicted future performance — fixtures, predicted points, form. Do NOT make definitive claims about past results.

Always respond with valid JSON matching the schema exactly.`;

export function buildChipPlanPrompt(req: ChipPlanRequest): string {
  const chipLabel = req.chipType === "wildcard" ? "WILDCARD" : "FREE HIT";
  const optimiseFor =
    req.chipType === "wildcard"
      ? "predicted4GW (optimise for the best 4 gameweek horizon)"
      : "predictedNextGW (single gameweek only — squad reverts after this gameweek)";

  const budgetMillion = (req.budget / 10).toFixed(1);

  const formatCandidate = (c: ChipPlanCandidate) =>
    `[${c.id}] ${c.name} (${c.team}) £${c.cost.toFixed(1)}m — Next GW: ${c.predictedNextGW}pts, 4 GW: ${c.predicted4GW}pts, Form: ${c.form}, Difficulty: ${c.upcomingDifficulty}`;

  const currentSquadStr = req.currentSquad
    .map(
      (p) =>
        `[${p.id}] ${p.name} (${p.position}) £${p.sellingPrice.toFixed(1)}m selling price`,
    )
    .join("\n");

  const candidatesStr = (["GK", "DEF", "MID", "FWD"] as const)
    .map(
      (pos) =>
        `### ${pos}\n${req.candidates[pos].map(formatCandidate).join("\n") || "(none available)"}`,
    )
    .join("\n\n");

  return `Build the optimal GW${req.gameweek} squad for a ${chipLabel} chip activation.

Optimise for: ${optimiseFor}

## Budget
Total available: £${budgetMillion}m (sum of all 15 current selling prices + bank balance)
You MUST select 15 players whose combined cost is ≤ £${budgetMillion}m.

## Current Squad (for context — you are replacing ALL of these)
${currentSquadStr}

## Available Players by Position
${candidatesStr}

Respond with JSON matching this schema exactly:
{
  "predictedTeamPoints": <number — estimated total team score for GW${req.gameweek}>,
  "squad": {
    "GK":  [{"id": <number>, "name": "<string>", "cost": <number>}, {"id": <number>, "name": "<string>", "cost": <number>}],
    "DEF": [5 players with same shape],
    "MID": [5 players with same shape],
    "FWD": [3 players with same shape]
  },
  "startingXI": [<11 player IDs>],
  "benchOrder": [<4 player IDs — GK bench LAST>],
  "captain": {
    "playerId": <number>,
    "name": "<string>",
    "reasoning": "<1-2 sentence explanation>"
  },
  "notes": "<any additional strategic notes>"
}`;
}

// =============================================================================
// Response Parser
// =============================================================================

const EMPTY_RESULT: ChipPlanRawResult = {
  predictedTeamPoints: 0,
  squad: { GK: [], DEF: [], MID: [], FWD: [] },
  startingXI: [],
  benchOrder: [],
  captain: { playerId: 0, name: "Unknown", reasoning: "Parse error" },
  notes: "Parse error — see raw response",
};

export function parseChipPlanResult(text: string): ChipPlanRawResult {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1]?.trim() || text.trim();

  try {
    const parsed = JSON.parse(jsonStr) as Partial<ChipPlanRawResult>;
    return {
      predictedTeamPoints: parsed.predictedTeamPoints ?? 0,
      squad: {
        GK: parsed.squad?.GK ?? [],
        DEF: parsed.squad?.DEF ?? [],
        MID: parsed.squad?.MID ?? [],
        FWD: parsed.squad?.FWD ?? [],
      },
      startingXI: parsed.startingXI ?? [],
      benchOrder: parsed.benchOrder ?? [],
      captain: parsed.captain ?? {
        playerId: 0,
        name: "Unknown",
        reasoning: "",
      },
      notes: parsed.notes ?? "",
    };
  } catch {
    return EMPTY_RESULT;
  }
}

// =============================================================================
// API Client
// =============================================================================

export async function generateChipPlan(
  req: ChipPlanRequest,
): Promise<ChipPlanResponse> {
  const startTime = Date.now();

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error(
      "Anthropic API key not configured. Please add your API key in Settings.",
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: CLAUDE_CONFIG.MODEL,
    max_tokens: 12000,
    thinking: {
      type: "enabled",
      budget_tokens: 8000,
    },
    system: CHIP_PLAN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildChipPlanPrompt(req) }],
  });

  let thinking = "";
  let text = "";

  for (const block of response.content) {
    if (block.type === "thinking") {
      thinking = block.thinking;
    } else if (block.type === "text") {
      text = block.text;
    }
  }

  const result = parseChipPlanResult(text);

  return {
    thinking,
    result,
    processingTime: Date.now() - startTime,
  };
}
````

**Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/claude/__tests__/chip-plan-client.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/claude/chip-plan-client.ts lib/claude/__tests__/chip-plan-client.test.ts
git commit -m "feat: add chip-plan-client for Claude-powered wildcard/free hit squad generation"
```

---

## Task 3: `POST /api/gw-plan/chip-plan` route

**Files:**

- Create: `app/api/gw-plan/chip-plan/route.ts`
- Create: `app/api/gw-plan/chip-plan/__tests__/route.test.ts`

**Step 1: Write the failing tests**

`app/api/gw-plan/chip-plan/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db/sessions", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/db/gw-plan", () => ({
  saveGwPlan: vi.fn(),
  getGwPlanById: vi.fn(),
}));
vi.mock("@/lib/db/settings", () => ({
  hasAnthropicApiKey: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/fpl/auth-client", () => ({ getFplSession: vi.fn() }));
vi.mock("@/lib/fpl/client", () => ({
  fplClient: {
    getManagerHistory: vi.fn(),
    getManagerPicks: vi.fn(),
    getBootstrapStatic: vi.fn(),
    getFixtures: vi.fn(),
  },
}));
vi.mock("@/lib/claude/chip-plan-client", () => ({ generateChipPlan: vi.fn() }));
vi.mock("@/lib/fpl/points-model", () => ({
  predictPoints: vi.fn().mockReturnValue([]),
}));

import { POST } from "../route";
import { getSession } from "@/lib/db/sessions";
import { saveGwPlan } from "@/lib/db/gw-plan";
import { getFplSession } from "@/lib/fpl/auth-client";
import { fplClient } from "@/lib/fpl/client";
import { generateChipPlan } from "@/lib/claude/chip-plan-client";
import type { ManagerHistory } from "@/lib/fpl/types";

const SESSION_ID = "a0000000-0000-4000-8000-000000000001";

const mockSession = {
  id: SESSION_ID,
  fpl_manager_id: 999,
  display_name: null,
  created_at: "",
  updated_at: "",
};

const mockHistory: Partial<ManagerHistory> = {
  chips: [], // no chips used
  current: [],
  past: [],
};

const mockPicks = {
  active_chip: null,
  entry_history: { bank: 20, total_transfers: 1, event: 28 },
  picks: [
    {
      element: 1,
      position: 1,
      multiplier: 1,
      is_captain: false,
      is_vice_captain: false,
      selling_price: 55,
    },
    {
      element: 2,
      position: 12,
      multiplier: 0,
      is_captain: false,
      is_vice_captain: false,
      selling_price: 45,
    },
  ],
};

const mockBootstrap = {
  elements: [
    {
      id: 1,
      web_name: "Raya",
      element_type: 1,
      team: 1,
      now_cost: 55,
      form: "7.0",
    },
    {
      id: 2,
      web_name: "Flekken",
      element_type: 1,
      team: 8,
      now_cost: 45,
      form: "5.0",
    },
  ],
  teams: [
    { id: 1, short_name: "ARS" },
    { id: 8, short_name: "BRE" },
  ],
  events: [],
};

const mockChipResult = {
  thinking: "I thought hard",
  result: {
    predictedTeamPoints: 80,
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
    captain: { playerId: 8, name: "Salah", reasoning: "Best pick" },
    notes: "Go get 'em",
  },
  processingTime: 5000,
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/gw-plan/chip-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setupMocks() {
  vi.mocked(getSession).mockReturnValue(mockSession);
  vi.mocked(getFplSession).mockReturnValue({
    csrfToken: "tok",
    plProfile: "pro",
  } as ReturnType<typeof getFplSession>);
  vi.mocked(fplClient.getManagerHistory).mockResolvedValue(
    mockHistory as ManagerHistory,
  );
  vi.mocked(fplClient.getManagerPicks).mockResolvedValue(
    mockPicks as Awaited<ReturnType<typeof fplClient.getManagerPicks>>,
  );
  vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue(
    mockBootstrap as Awaited<ReturnType<typeof fplClient.getBootstrapStatic>>,
  );
  vi.mocked(fplClient.getFixtures).mockResolvedValue([]);
  vi.mocked(generateChipPlan).mockResolvedValue(mockChipResult);
  vi.mocked(saveGwPlan).mockReturnValue({
    id: "plan-123",
    sessionId: SESSION_ID,
    gameweek: 28,
    plan: {} as ReturnType<typeof saveGwPlan>["plan"],
    thinking: "",
    generatedAt: new Date().toISOString(),
    chipType: "wildcard",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  setupMocks();
});

describe("POST /api/gw-plan/chip-plan", () => {
  it("returns 400 for missing chipType", async () => {
    const req = makeRequest({ sessionId: SESSION_ID, gameweek: 28 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when session has no FPL manager", async () => {
    vi.mocked(getSession).mockReturnValue({
      ...mockSession,
      fpl_manager_id: null,
    } as ReturnType<typeof getSession>);
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "wildcard",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 409 when chip already used this season", async () => {
    vi.mocked(fplClient.getManagerHistory).mockResolvedValue({
      ...mockHistory,
      chips: [{ name: "wildcard", time: "2025-10-01T10:00:00Z", event: 10 }],
    } as ManagerHistory);
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "wildcard",
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 200 with plan on happy path", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "wildcard",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { chipType?: string };
    expect(json.chipType).toBe("wildcard");
  });

  it("calls generateChipPlan with correct chipType", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "freehit",
    });
    await POST(req);
    expect(vi.mocked(generateChipPlan)).toHaveBeenCalledWith(
      expect.objectContaining({ chipType: "freehit" }),
    );
  });

  it("calls saveGwPlan with chipType", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "wildcard",
    });
    await POST(req);
    expect(vi.mocked(saveGwPlan)).toHaveBeenCalledWith(
      SESSION_ID,
      28,
      expect.any(Object),
      expect.any(String),
      "wildcard",
    );
  });
});
```

**Step 2: Run to verify tests fail**

```bash
npx vitest run app/api/gw-plan/chip-plan/__tests__/route.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement `app/api/gw-plan/chip-plan/route.ts`**

Key design decisions:

- Budget = sum of all 15 current selling prices + bank (all in 0.1m units), converted to £m for the prompt
- Candidate pool: top 15 GKs, 25 DEFs, 25 MIDs, 20 FWDs from `predictPoints`, filtered to cost ≤ budget/11 as rough pre-filter
- Transfer pairs: pair current squad players with new squad players position-by-position; players in both get no-op (id=id) transfers excluded
- Wildcard chip check: allowed twice per season — GWs 1–19 (first half) and GWs 20–38 (second half). Check history.chips for `name === "wildcard"` in the current half only
- Free Hit: allowed once per season; any previous use → 409

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
  createErrorFromUnknown,
} from "@/lib/api/errors";
import { getSession } from "@/lib/db/sessions";
import { saveGwPlan } from "@/lib/db/gw-plan";
import { getFplSession } from "@/lib/fpl/auth-client";
import { fplClient } from "@/lib/fpl/client";
import { generateChipPlan } from "@/lib/claude/chip-plan-client";
import { predictPoints } from "@/lib/fpl/points-model";
import { hasAnthropicApiKey } from "@/lib/db/settings";
import type {
  ChipPlanRequest,
  ChipPlanCurrentPlayer,
  ChipPlanCandidate,
} from "@/lib/claude/chip-plan-client";
import type { GwPlanResult } from "@/lib/db/gw-plan";

export const runtime = "nodejs";
export const maxDuration = 60;

const POS_MAP: Record<number, "GK" | "DEF" | "MID" | "FWD"> = {
  1: "GK",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  gameweek: z.number().int().min(1).max(38),
  chipType: z.enum(["wildcard", "freehit"]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "claude");
  if (rl) return rl;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const { sessionId, gameweek, chipType } = parsed.data;

  const session = getSession(sessionId);
  if (!session?.fpl_manager_id) {
    return createErrorResponse(
      "No FPL manager connected to this session",
      "UNAUTHORIZED",
    );
  }

  const fplSession = getFplSession();
  if (!fplSession) {
    return createErrorResponse(
      "FPL session expired. Please reconnect in Settings.",
      "UNAUTHORIZED",
    );
  }

  if (!hasAnthropicApiKey()) {
    return createErrorResponse(
      "Anthropic API key not configured. Please add your API key in Settings.",
      "SERVICE_UNAVAILABLE",
    );
  }

  const managerId = session.fpl_manager_id;

  try {
    // Check chip availability
    const history = await fplClient.getManagerHistory(managerId);
    if (chipType === "freehit") {
      const used = history.chips.some((c) => c.name === "freehit");
      if (used) {
        return createErrorResponse(
          "Free Hit chip has already been used this season",
          "CONFLICT",
        );
      }
    } else {
      // Wildcard: allowed once per half (GWs 1–19 = first half, 20–38 = second half)
      const isFirstHalf = gameweek <= 19;
      const usedInThisHalf = history.chips.some(
        (c) =>
          c.name === "wildcard" &&
          (isFirstHalf ? c.event <= 19 : c.event >= 20),
      );
      if (usedInThisHalf) {
        return createErrorResponse(
          "Wildcard chip has already been used in this half of the season",
          "CONFLICT",
        );
      }
    }

    // Fetch current squad + bootstrap
    const [picks, bootstrap, fixtures] = await Promise.all([
      fplClient.getManagerPicks(managerId, gameweek).catch(async () => {
        // Try previous GW if current not available yet
        return fplClient.getManagerPicks(managerId, gameweek - 1);
      }),
      fplClient.getBootstrapStatic(),
      fplClient.getFixtures(),
    ]);

    const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));
    const playerMap = new Map(bootstrap.elements.map((e) => [e.id, e]));

    // Build current squad for context
    const currentSquad: ChipPlanCurrentPlayer[] = picks.picks.map((pick) => {
      const element = playerMap.get(pick.element);
      return {
        id: pick.element,
        name: element?.web_name ?? `Player ${pick.element}`,
        position: POS_MAP[element?.element_type ?? 1] ?? "GK",
        sellingPrice:
          Math.round(
            ((pick.selling_price ?? element?.now_cost ?? 0) / 10) * 10,
          ) / 10,
      };
    });

    // Compute budget: sum of all 15 selling prices + bank (both in 0.1m units)
    const totalSellingPrice = picks.picks.reduce(
      (sum, pick) =>
        sum +
        (pick.selling_price ?? playerMap.get(pick.element)?.now_cost ?? 0),
      0,
    );
    const budget = totalSellingPrice + picks.entry_history.bank; // in 0.1m units

    // Build candidate pools using points model
    const pointsPredictions = predictPoints(
      bootstrap.elements,
      fixtures,
      gameweek,
    );
    const pointsMap = new Map(pointsPredictions.map((p) => [p.player.id, p]));

    // Rough affordability pre-filter: max individual cost ≤ budget / 11
    const maxIndividualCost = Math.floor(budget / 11);

    const CANDIDATES_PER_POSITION: Record<string, number> = {
      GK: 15,
      DEF: 25,
      MID: 25,
      FWD: 20,
    };

    const candidatesByPos: Record<string, ChipPlanCandidate[]> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };

    for (const element of bootstrap.elements) {
      if (element.now_cost > maxIndividualCost) continue;
      const pos = POS_MAP[element.element_type];
      if (!pos) continue;
      const pts = pointsMap.get(element.id);
      candidatesByPos[pos].push({
        id: element.id,
        name: element.web_name,
        team: teamMap.get(element.team) ?? "???",
        position: pos,
        cost: Math.round((element.now_cost / 10) * 10) / 10,
        predictedNextGW: pts ? Math.round(pts.predictedPoints * 10) / 10 : 0,
        predicted4GW: pts ? Math.round(pts.predictedPoints * 4 * 10) / 10 : 0,
        form: element.form ?? "0.0",
        upcomingDifficulty: 3,
      });
    }

    // Sort each position by predicted score, cap at max
    const sortField =
      chipType === "wildcard" ? "predicted4GW" : "predictedNextGW";
    for (const pos of ["GK", "DEF", "MID", "FWD"] as const) {
      candidatesByPos[pos] = candidatesByPos[pos]
        .sort((a, b) => b[sortField] - a[sortField])
        .slice(0, CANDIDATES_PER_POSITION[pos]);
    }

    const chipReq: ChipPlanRequest = {
      chipType,
      gameweek,
      budget,
      currentSquad,
      candidates: {
        GK: candidatesByPos.GK,
        DEF: candidatesByPos.DEF,
        MID: candidatesByPos.MID,
        FWD: candidatesByPos.FWD,
      },
    };

    const { thinking, result } = await generateChipPlan(chipReq);

    // Compute transfer pairs: current squad by position → new squad by position
    // Players retained (same ID in both) are no-ops and excluded
    const currentByPos: Record<string, number[]> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };
    for (const p of currentSquad) {
      currentByPos[p.position].push(p.id);
    }

    const newByPos: Record<string, number[]> = {
      GK: result.squad.GK.map((p) => p.id),
      DEF: result.squad.DEF.map((p) => p.id),
      MID: result.squad.MID.map((p) => p.id),
      FWD: result.squad.FWD.map((p) => p.id),
    };

    const allNewIds = new Set(Object.values(newByPos).flat());

    const transfers: GwPlanResult["transfers"] = [];
    for (const pos of ["GK", "DEF", "MID", "FWD"] as const) {
      const outs = currentByPos[pos].filter((id) => !allNewIds.has(id));
      const newIds = new Set(currentByPos[pos]);
      const ins = newByPos[pos].filter((id) => !newIds.has(id));
      const len = Math.min(outs.length, ins.length);
      for (let i = 0; i < len; i++) {
        const outPlayer = playerMap.get(outs[i]);
        const inPlayer = playerMap.get(ins[i]);
        transfers.push({
          playerOut: {
            id: outs[i],
            name: outPlayer?.web_name ?? `Player ${outs[i]}`,
            predicted4GW: pointsMap.get(outs[i])
              ? Math.round(pointsMap.get(outs[i])!.predictedPoints * 4 * 10) /
                10
              : 0,
          },
          playerIn: {
            id: ins[i],
            name: inPlayer?.web_name ?? `Player ${ins[i]}`,
            predicted4GW: pointsMap.get(ins[i])
              ? Math.round(pointsMap.get(ins[i])!.predictedPoints * 4 * 10) / 10
              : 0,
          },
          pointsGain: 0,
          hitCost: 0,
          reasoning: `${pos} position swap for ${chipType === "wildcard" ? "Wildcard" : "Free Hit"}`,
        });
      }
    }

    // Build substitutions from startingXI + benchOrder
    const startingSet = new Set(result.startingXI);
    const allSquadPlayers = [
      ...result.squad.GK,
      ...result.squad.DEF,
      ...result.squad.MID,
      ...result.squad.FWD,
    ];
    const playerNameMap = new Map(allSquadPlayers.map((p) => [p.id, p.name]));

    // Substitutions are implied by the bench order — no starter ↔ bench swaps to suggest
    // since the chip plan directly outputs startingXI and benchOrder
    const substitutions: GwPlanResult["substitutions"] = [];

    const gwPlanResult: GwPlanResult = {
      predictedTeamPoints: result.predictedTeamPoints,
      captain: {
        playerId: result.captain.playerId,
        name: result.captain.name,
        reasoning: result.captain.reasoning,
      },
      transfers,
      substitutions,
      notes: result.notes,
    };

    const saved = saveGwPlan(
      sessionId,
      gameweek,
      gwPlanResult,
      thinking,
      chipType,
    );

    return NextResponse.json(saved);
  } catch (error) {
    console.error("Chip plan generation error:", error);
    return createErrorFromUnknown(error, "generating chip plan");
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run app/api/gw-plan/chip-plan/__tests__/route.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/gw-plan/chip-plan/route.ts app/api/gw-plan/chip-plan/__tests__/route.test.ts
git commit -m "feat: add chip-plan API route for wildcard/free hit squad generation"
```

---

## Task 4: Extend `POST /api/gw-plan/submit` to activate chips

**Files:**

- Modify: `app/api/gw-plan/submit/route.ts` (lines 16–22, 123–130)
- Modify: `app/api/gw-plan/submit/__tests__/route.test.ts` (extend existing tests)

**Step 1: Write the failing test**

Find the existing test file at `app/api/gw-plan/submit/__tests__/route.test.ts`. Add one test at the end of the `describe` block:

```typescript
it("passes wildcard: true when chipType is 'wildcard'", async () => {
  const req = makeRequest({
    sessionId: SESSION_ID,
    planId: PLAN_ID,
    confirm: true,
    chipType: "wildcard",
  });
  const res = await POST(req);
  expect(res.status).toBe(200);

  const fplCall = vi
    .mocked(authenticatedFetch)
    .mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("transfers"),
    );
  const body = JSON.parse(fplCall![1]!.body as string) as {
    wildcard: boolean;
    freehit: boolean;
  };
  expect(body.wildcard).toBe(true);
  expect(body.freehit).toBe(false);
});
```

**Step 2: Run to verify it fails**

```bash
npx vitest run app/api/gw-plan/submit/__tests__/route.test.ts
```

Expected: the new test FAILS (chipType not supported yet).

**Step 3: Modify the submit route**

In `app/api/gw-plan/submit/route.ts`:

a) Add `chipType` to the Zod schema (line 22, after `transferIndices`):

```typescript
chipType: z.enum(["wildcard", "freehit"]).optional(),
```

b) Destructure `chipType` from `parsed.data` (line 33):

```typescript
const { sessionId, planId, confirm, transferIndices, chipType } = parsed.data;
```

c) Replace the hardcoded `wildcard: false, freehit: false` (lines 128–129) with:

```typescript
wildcard: chipType === "wildcard",
freehit: chipType === "freehit",
```

d) Also update the dry-run response (line 243) to reflect the chip:

```typescript
wildcardActive: chipType === "wildcard",
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run app/api/gw-plan/submit/__tests__/route.test.ts
```

Expected: all tests PASS

**Step 5: Commit**

```bash
git add app/api/gw-plan/submit/route.ts app/api/gw-plan/submit/__tests__/route.test.ts
git commit -m "feat: extend submit route to activate wildcard/freehit chip flag"
```

---

## Task 5: UI — chip availability check + buttons in `GwPlanWidget`

**Files:**

- Modify: `components/dashboard/gw-plan-widget.tsx`
- Modify: `components/dashboard/submit-plan-modal.tsx`

There are no pre-existing unit tests for `GwPlanWidget` (it's a React component with side effects). No tests needed for this task — the component will be verified visually. The `SubmitPlanModal` change is a one-liner prop pass-through.

**Step 1: Add `chipType` prop to `SubmitPlanModal`**

In `components/dashboard/submit-plan-modal.tsx`:

a) Extend the props interface (after line 15):

```typescript
/** When set, the submit route will activate this chip. */
chipType?: "wildcard" | "freehit";
```

b) Destructure in the function signature:

```typescript
export function SubmitPlanModal({
  open, onClose, plan, sessionId,
  selectedTransferIndices, selectedSubstitutionIndices,
  onSuccess, chipType,
}: SubmitPlanModalProps) {
```

c) Pass `chipType` to the submit fetch body (line 84–91, inside `if (hasTransfers)`):

```typescript
body: JSON.stringify({
  sessionId,
  planId: plan.id,
  confirm: true,
  ...(selectedTransferIndices !== undefined && {
    transferIndices: selectedTransferIndices,
  }),
  ...(chipType !== undefined && { chipType }),
}),
```

d) Update the modal title and warning for chips:
After line 74 (the `modalTitle` derivation), add:

```typescript
const chipLabel =
  chipType === "wildcard"
    ? "WILDCARD"
    : chipType === "freehit"
      ? "FREE HIT"
      : null;
```

Update the warning paragraph (around line 200):

```typescript
<p className="mb-6 rounded-lg bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
  {chipLabel
    ? `⚠ This will activate your ${chipLabel} chip and replace your entire squad. It cannot be undone.`
    : "⚠ This will change your FPL team. It cannot be undone."}
</p>
```

**Step 2: Update `GwPlanWidget` for chip availability + buttons**

In `components/dashboard/gw-plan-widget.tsx`, make the following changes:

a) Add `chipType` state alongside existing state declarations (after line 34):

```typescript
const [chipType, setChipType] = useState<"wildcard" | "freehit" | undefined>(
  undefined,
);
const [availableChips, setAvailableChips] = useState<{
  wildcard: boolean;
  freehit: boolean;
}>({ wildcard: false, freehit: false });
```

b) Add chip availability fetch to the mount effect that checks FPL auth status (after line 59):

```typescript
useEffect(() => {
  void fetch(`/api/fpl-auth/status?sessionId=${encodeURIComponent(sessionId)}`)
    .then((r) => r.json())
    .then(async (d) => {
      const isConnected = (d as { connected: boolean }).connected;
      setFplConnected(isConnected);
      if (isConnected) {
        // Fetch manager history to check chip availability
        try {
          const histRes = await fetch(
            `/api/fpl/entry/${encodeURIComponent(sessionId)}/history`, // see note below
          );
          // NOTE: we'll actually need to use the manager ID — but the widget
          // already knows sessionId and the API can look it up. Actually the
          // FPL history endpoint needs managerId, not sessionId.
          // Use the session API to get managerId first, then fetch history.
        } catch {
          /* non-critical */
        }
      }
    })
    .catch(() => {});
}, [sessionId, gameweek]);
```

**Important implementation note:** The widget doesn't have direct access to `managerId`. To check chip availability:

1. After confirming `fplConnected`, call `GET /api/session?id={sessionId}` to get `fpl_manager_id`
2. Call `GET /api/fpl/entry/{managerId}/history` to get chip history

Here is the complete replacement for the FPL auth status `useEffect` (lines 53–60):

```typescript
useEffect(() => {
  const checkAuthAndChips = async () => {
    try {
      const authRes = await fetch(
        `/api/fpl-auth/status?sessionId=${encodeURIComponent(sessionId)}`,
      );
      const authData = (await authRes.json()) as {
        connected: boolean;
        managerId?: number;
      };
      const isConnected = authData.connected;
      setFplConnected(isConnected);

      if (isConnected && authData.managerId) {
        try {
          const histRes = await fetch(
            `/api/fpl/entry/${authData.managerId}/history`,
          );
          if (histRes.ok) {
            const hist = (await histRes.json()) as {
              chips: Array<{ name: string; event: number }>;
            };
            const usedWildcardFirstHalf = hist.chips.some(
              (c) => c.name === "wildcard" && c.event <= 19,
            );
            const usedWildcardSecondHalf = hist.chips.some(
              (c) => c.name === "wildcard" && c.event >= 20,
            );
            const usedFreeHit = hist.chips.some((c) => c.name === "freehit");

            setAvailableChips({
              wildcard:
                gameweek <= 19
                  ? !usedWildcardFirstHalf
                  : !usedWildcardSecondHalf,
              freehit: !usedFreeHit,
            });
          }
        } catch {
          /* non-critical */
        }
      }
    } catch {
      /* ignore */
    }
  };
  void checkAuthAndChips();
}, [sessionId, gameweek]);
```

**Check if `fpl-auth/status` returns managerId.** Read `app/api/fpl-auth/status/route.ts` first — if it doesn't return `managerId`, add it to the response.

c) Add a `generateChip` function alongside the existing `generate` function:

```typescript
const generateChip = async (ct: "wildcard" | "freehit") => {
  setLoading(true);
  setError(null);
  setChipType(undefined);

  try {
    const res = await fetch("/api/gw-plan/chip-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, gameweek, chipType: ct }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      if (res.status === 409) {
        throw new Error(
          ct === "wildcard"
            ? "Wildcard chip already used this half of the season"
            : "Free Hit chip already used this season",
        );
      }
      throw new Error(data.error ?? "Failed to generate chip plan");
    }

    const data = (await res.json()) as GwPlan;
    setPlan(data);
    setChipType(ct);
    // Select all transfers (chip plans are all-or-nothing)
    setSelectedTransfers(new Set(data.plan.transfers.map((_, i) => i)));
    setSelectedSubstitutions(new Set());
    await fetchPredictions();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Failed to generate chip plan",
    );
  } finally {
    setLoading(false);
  }
};
```

d) Update the loading label to reflect chip mode. Replace the single `"Generating..."` text (line ~194) with:

```typescript
{loading && (
  <div className="mt-4 flex items-center gap-2 text-sm text-fpl-muted">
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-fpl-cyan border-t-transparent" />
    {chipType !== undefined ? `Generating ${chipType === "wildcard" ? "Wildcard" : "Free Hit"} plan…` : "Generating…"}
  </div>
)}
```

Wait — `chipType` is cleared at the start of `generateChip`. Use a separate `loadingLabel` state instead, or set a `pendingChipType` separate from the settled `chipType`. Simplest fix: add a `loadingChipType` state:

```typescript
const [loadingChipType, setLoadingChipType] = useState<
  "wildcard" | "freehit" | undefined
>(undefined);
```

In `generateChip`, set it before `setLoading(true)`:

```typescript
setLoadingChipType(ct);
```

Clear it in the `finally` block:

```typescript
setLoadingChipType(undefined);
```

Then use `loadingChipType` in the loading label.

e) Add chip buttons below the `Generate GW Plan` button section. Replace the `!plan && !loading && !error` block (lines 199–212) with:

```typescript
{!plan && !loading && !error && (
  <div className="mt-4 space-y-3">
    <p className="text-sm text-fpl-muted">
      Generate an AI-powered gameweek plan with captain recommendation and
      transfer advice.
    </p>
    <button
      onClick={() => void generate()}
      className="rounded-lg bg-fpl-purple px-4 py-2 text-sm font-semibold text-white hover:bg-fpl-purple/80 transition-colors"
    >
      Generate GW Plan
    </button>
    {fplConnected && (availableChips.wildcard || availableChips.freehit) && (
      <div className="flex gap-2 pt-1">
        {availableChips.wildcard && (
          <button
            onClick={() => void generateChip("wildcard")}
            className="rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-300 hover:bg-yellow-400/20 transition-colors"
          >
            ⚡ Wildcard
          </button>
        )}
        {availableChips.freehit && (
          <button
            onClick={() => void generateChip("freehit")}
            className="rounded-lg border border-blue-400/40 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-400/20 transition-colors"
          >
            🎯 Free Hit
          </button>
        )}
      </div>
    )}
  </div>
)}
```

f) Add a chip badge in the plan display section, before the predicted score block (line ~229):

```typescript
{plan && !loading && (
  <div className="mt-4 space-y-4">
    {/* Chip badge */}
    {chipType && (
      <div className="inline-flex items-center rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-yellow-300">
        {chipType === "wildcard" ? "⚡ Wildcard Plan" : "🎯 Free Hit Plan"}
      </div>
    )}
    {/* Predicted team score */}
    ...
```

g) Update the `buildSubmitLabel` function and submit button for chip mode (below line 153). Extend it to accept an optional chip type:

```typescript
function buildSubmitLabel(
  transferCount: number,
  subCount: number,
  ct?: "wildcard" | "freehit",
): string {
  if (ct === "wildcard")
    return `Submit Wildcard (${transferCount} transfers) ▶`;
  if (ct === "freehit") return `Submit Free Hit (${transferCount} transfers) ▶`;
  if (transferCount > 0 && subCount > 0) {
    return `Submit ${transferCount} Transfer${transferCount === 1 ? "" : "s"} + ${subCount} Sub${subCount === 1 ? "" : "s"}`;
  }
  if (subCount > 0) return `Submit ${subCount} Sub${subCount === 1 ? "" : "s"}`;
  return transferCount === 1
    ? "Submit 1 Transfer"
    : `Submit ${transferCount} Transfers`;
}
```

Update the call on line ~161:

```typescript
const submitLabel = buildSubmitLabel(
  selectedCount,
  selectedSubstitutions.size,
  chipType,
);
```

h) Pass `chipType` through to `SubmitPlanModal`:

```typescript
<SubmitPlanModal
  ...
  chipType={chipType}
/>
```

**Step 3: Add `managerId` to `fpl-auth/status` response**

`app/api/fpl-auth/status/route.ts` currently returns `{ connected, managerName, expiresAt }` but does NOT include `managerId`. The widget needs it to check chip history. Update both response paths in that route:

```typescript
// connected: false path
return NextResponse.json({
  connected: false,
  managerName: null,
  expiresAt: null,
  managerId: session.fpl_manager_id ?? null, // ADD
});

// connected: true path
return NextResponse.json({
  connected: true,
  managerName: fplSession.managerName,
  expiresAt: fplSession.expiresAt,
  managerId: session.fpl_manager_id ?? null, // ADD
});
```

Also update the test at `app/api/fpl-auth/status/__tests__/route.test.ts` to expect `managerId` in responses.

**Step 4: Run the full test suite to check nothing is broken**

```bash
npx vitest run
```

Expected: all existing tests PASS (no regressions)

**Step 5: Commit**

```bash
git add components/dashboard/gw-plan-widget.tsx components/dashboard/submit-plan-modal.tsx app/api/fpl-auth/status/route.ts
git commit -m "feat: add wildcard/free hit chip buttons to GW Plan widget"
```

---

## Task 6: Final integration check

**Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS

**Step 2: Build check**

```bash
npm run build
```

Expected: clean build, no TypeScript errors

**Step 3: Commit if any minor fixes needed**

---

## What Does NOT Change

- `SubmitPlanModal` core rendering — only gains optional `chipType` prop
- Transfer tracker — chip transfers are tracked same as regular ones
- `submit-lineup` route — untouched
- `GwPlanResult` interface — unchanged (transfers/captain/substitutions/notes/predictedTeamPoints)
- Regular `POST /api/gw-plan` — unchanged
