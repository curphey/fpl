# GW Plan Widget Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dashboard widget that generates an on-demand AI gameweek plan — predicted team score, captain recommendation, transfer suggestions with 4-GW points gain, and a week-by-week transfer tracker vs actuals.

**Architecture:** On-demand generation (button click) calls `POST /api/gw-plan` which fetches the manager's squad from FPL, runs the existing scoring models, then calls Claude with extended thinking. Results are cached in SQLite so subsequent loads are instant. A Tuesday scheduler job updates actual points and asks Claude to explain any significant misses.

**Tech Stack:** Next.js App Router, better-sqlite3, Anthropic SDK (extended thinking), Vitest + React Testing Library, node-cron

---

## Task 1: Add SQLite schema

**Files:**

- Modify: `lib/db/client.ts`

**Context:** Add two new tables to the existing `db.exec(...)` block. The `gw_plans` table caches one Claude-generated plan per session per GW. The `transfer_predictions` table stores each recommended transfer and tracks actuals over 4 GWs.

**Step 1: Add the tables to the schema**

Inside the existing `db.exec(` block in `lib/db/client.ts`, append after the last `CREATE INDEX` line:

```sql
  -- GW plans: Cached Claude-generated gameweek plans
  CREATE TABLE IF NOT EXISTS gw_plans (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    gameweek INTEGER NOT NULL,
    plan_json TEXT NOT NULL,
    thinking TEXT,
    generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_gw_plans_session_gw ON gw_plans(session_id, gameweek);

  -- Transfer predictions: Per-transfer tracking (predicted vs actual over 4 GWs)
  CREATE TABLE IF NOT EXISTS transfer_predictions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    gameweek_made INTEGER NOT NULL,
    player_out_id INTEGER NOT NULL,
    player_out_name TEXT NOT NULL,
    player_in_id INTEGER NOT NULL,
    player_in_name TEXT NOT NULL,
    predicted_gain_pts REAL NOT NULL,
    actual_gain_pts REAL,
    gw_actuals TEXT DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    reasoning TEXT,
    tracking_notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_transfer_predictions_session
    ON transfer_predictions(session_id, gameweek_made DESC);
```

**Step 2: Verify the app starts without errors**

```bash
npm run dev
```

Expected: No SQLite errors on startup.

**Step 3: Commit**

```bash
git add lib/db/client.ts
git commit -m "feat: add gw_plans and transfer_predictions SQLite tables"
```

---

## Task 2: DB repository

**Files:**

- Create: `lib/db/gw-plan.ts`
- Create: `lib/db/__tests__/gw-plan.test.ts`

**Context:** Repository functions for the two new tables. Use the same pattern as `lib/db/notifications.ts`: import `db` from `./client`, use `db.prepare().get/all/run()`. For tests, mock the `db` module with `vi.mock`.

**Step 1: Write the failing tests**

Create `lib/db/__tests__/gw-plan.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockPrepare = vi
  .fn()
  .mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });

vi.mock("@/lib/db/client", () => ({
  db: { prepare: mockPrepare },
}));

import {
  getGwPlan,
  saveGwPlan,
  getTransferPredictions,
  insertTransferPrediction,
  updateTransferActuals,
} from "../gw-plan";

describe("getGwPlan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no plan exists", () => {
    mockGet.mockReturnValue(undefined);
    expect(getGwPlan("sess1", 28)).toBeNull();
  });

  it("parses plan_json and returns GwPlan", () => {
    const plan = {
      predictedTeamPoints: 62,
      captain: { playerId: 1, name: "Salah", reasoning: "great fixtures" },
      transfers: [],
      notes: "",
    };
    mockGet.mockReturnValue({
      id: "abc",
      session_id: "sess1",
      gameweek: 28,
      plan_json: JSON.stringify(plan),
      thinking: "my thoughts",
      generated_at: "2026-02-25",
    });
    const result = getGwPlan("sess1", 28);
    expect(result).not.toBeNull();
    expect(result!.plan.predictedTeamPoints).toBe(62);
    expect(result!.thinking).toBe("my thoughts");
  });
});

describe("saveGwPlan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls INSERT OR REPLACE with serialized plan", () => {
    const plan = {
      predictedTeamPoints: 55,
      captain: { playerId: 2, name: "Haaland", reasoning: "goals" },
      transfers: [],
      notes: "",
    };
    saveGwPlan("sess1", 27, plan, "thinking text");
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO gw_plans"),
    );
    expect(mockRun).toHaveBeenCalledWith(
      expect.any(String),
      "sess1",
      27,
      JSON.stringify(plan),
      "thinking text",
    );
  });

  it("returns the saved GwPlan with the provided data", () => {
    const plan = {
      predictedTeamPoints: 55,
      captain: { playerId: 2, name: "Haaland", reasoning: "goals" },
      transfers: [],
      notes: "",
    };
    const result = saveGwPlan("sess1", 27, plan, "");
    expect(result.sessionId).toBe("sess1");
    expect(result.gameweek).toBe(27);
    expect(result.plan).toEqual(plan);
  });
});

describe("getTransferPredictions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no predictions", () => {
    mockAll.mockReturnValue([]);
    expect(getTransferPredictions("sess1")).toEqual([]);
  });

  it("maps rows to TransferPrediction objects", () => {
    mockAll.mockReturnValue([
      {
        id: "p1",
        session_id: "sess1",
        gameweek_made: 25,
        player_out_id: 100,
        player_out_name: "Saka",
        player_in_id: 200,
        player_in_name: "Salah",
        predicted_gain_pts: 8.2,
        actual_gain_pts: null,
        gw_actuals: "{}",
        status: "pending",
        reasoning: "great fixtures",
        tracking_notes: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ]);
    const result = getTransferPredictions("sess1");
    expect(result).toHaveLength(1);
    expect(result[0].playerOutName).toBe("Saka");
    expect(result[0].playerInName).toBe("Salah");
    expect(result[0].predictedGainPts).toBe(8.2);
    expect(result[0].gwActuals).toEqual({});
    expect(result[0].status).toBe("pending");
  });
});

describe("insertTransferPrediction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts a new prediction row", () => {
    insertTransferPrediction(
      "sess1",
      28,
      100,
      "Saka",
      200,
      "Salah",
      8.2,
      "good fixtures",
    );
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO transfer_predictions"),
    );
    expect(mockRun).toHaveBeenCalled();
  });

  it("returns the inserted prediction with status pending", () => {
    const result = insertTransferPrediction(
      "sess1",
      28,
      100,
      "Saka",
      200,
      "Salah",
      8.2,
      "good fixtures",
    );
    expect(result.status).toBe("pending");
    expect(result.actualGainPts).toBeNull();
    expect(result.gwActuals).toEqual({});
  });
});

describe("updateTransferActuals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates gw_actuals, actual_gain_pts, status, tracking_notes", () => {
    updateTransferActuals("pred1", { "28": 12, "29": 3 }, 15, "on_track", null);
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE transfer_predictions"),
    );
    expect(mockRun).toHaveBeenCalledWith(
      JSON.stringify({ "28": 12, "29": 3 }),
      15,
      "on_track",
      null,
      "pred1",
    );
  });
});
```

**Step 2: Run tests — expect failures**

```bash
npm test lib/db/__tests__/gw-plan.test.ts
```

Expected: `Cannot find module '../gw-plan'`

**Step 3: Implement the repository**

Create `lib/db/gw-plan.ts`:

```typescript
import { randomUUID } from "crypto";
import { db } from "./client";

export interface GwPlanResult {
  predictedTeamPoints: number;
  captain: {
    playerId: number;
    name: string;
    reasoning: string;
  };
  transfers: Array<{
    playerOut: { id: number; name: string; predicted4GW: number };
    playerIn: { id: number; name: string; predicted4GW: number };
    pointsGain: number;
    reasoning: string;
  }>;
  notes: string;
}

export interface GwPlan {
  id: string;
  sessionId: string;
  gameweek: number;
  plan: GwPlanResult;
  thinking: string;
  generatedAt: string;
}

export interface TransferPrediction {
  id: string;
  sessionId: string;
  gameweekMade: number;
  playerOutId: number;
  playerOutName: string;
  playerInId: number;
  playerInName: string;
  predictedGainPts: number;
  actualGainPts: number | null;
  gwActuals: Record<string, number>;
  status: "pending" | "on_track" | "hit" | "miss";
  reasoning: string;
  trackingNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getGwPlan(sessionId: string, gameweek: number): GwPlan | null {
  const row = db
    .prepare("SELECT * FROM gw_plans WHERE session_id = ? AND gameweek = ?")
    .get(sessionId, gameweek) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToGwPlan(row);
}

export function saveGwPlan(
  sessionId: string,
  gameweek: number,
  plan: GwPlanResult,
  thinking: string,
): GwPlan {
  const id = randomUUID();
  db.prepare(
    `INSERT OR REPLACE INTO gw_plans (id, session_id, gameweek, plan_json, thinking)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, sessionId, gameweek, JSON.stringify(plan), thinking);
  return {
    id,
    sessionId,
    gameweek,
    plan,
    thinking,
    generatedAt: new Date().toISOString(),
  };
}

export function getTransferPredictions(
  sessionId: string,
): TransferPrediction[] {
  const rows = db
    .prepare(
      "SELECT * FROM transfer_predictions WHERE session_id = ? ORDER BY gameweek_made DESC",
    )
    .all(sessionId) as Record<string, unknown>[];
  return rows.map(rowToTransferPrediction);
}

export function getActiveTransferPredictions(): TransferPrediction[] {
  const rows = db
    .prepare(
      "SELECT * FROM transfer_predictions WHERE status IN ('pending', 'on_track')",
    )
    .all() as Record<string, unknown>[];
  return rows.map(rowToTransferPrediction);
}

export function insertTransferPrediction(
  sessionId: string,
  gameweekMade: number,
  playerOutId: number,
  playerOutName: string,
  playerInId: number,
  playerInName: string,
  predictedGainPts: number,
  reasoning: string,
): TransferPrediction {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO transfer_predictions
     (id, session_id, gameweek_made, player_out_id, player_out_name,
      player_in_id, player_in_name, predicted_gain_pts, gw_actuals, reasoning)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    sessionId,
    gameweekMade,
    playerOutId,
    playerOutName,
    playerInId,
    playerInName,
    predictedGainPts,
    "{}",
    reasoning,
  );
  return {
    id,
    sessionId,
    gameweekMade,
    playerOutId,
    playerOutName,
    playerInId,
    playerInName,
    predictedGainPts,
    actualGainPts: null,
    gwActuals: {},
    status: "pending",
    reasoning,
    trackingNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function updateTransferActuals(
  id: string,
  gwActuals: Record<string, number>,
  actualGainPts: number,
  status: TransferPrediction["status"],
  trackingNotes: string | null,
): void {
  db.prepare(
    `UPDATE transfer_predictions
     SET gw_actuals = ?, actual_gain_pts = ?, status = ?, tracking_notes = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(JSON.stringify(gwActuals), actualGainPts, status, trackingNotes, id);
}

function rowToGwPlan(row: Record<string, unknown>): GwPlan {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    gameweek: row.gameweek as number,
    plan: JSON.parse(row.plan_json as string) as GwPlanResult,
    thinking: (row.thinking as string) ?? "",
    generatedAt: row.generated_at as string,
  };
}

function rowToTransferPrediction(
  row: Record<string, unknown>,
): TransferPrediction {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    gameweekMade: row.gameweek_made as number,
    playerOutId: row.player_out_id as number,
    playerOutName: row.player_out_name as string,
    playerInId: row.player_in_id as number,
    playerInName: row.player_in_name as string,
    predictedGainPts: row.predicted_gain_pts as number,
    actualGainPts: (row.actual_gain_pts as number | null) ?? null,
    gwActuals: JSON.parse((row.gw_actuals as string) ?? "{}") as Record<
      string,
      number
    >,
    status: (row.status as TransferPrediction["status"]) ?? "pending",
    reasoning: (row.reasoning as string) ?? "",
    trackingNotes: (row.tracking_notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
```

**Step 4: Run tests — expect all pass**

```bash
npm test lib/db/__tests__/gw-plan.test.ts
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add lib/db/gw-plan.ts lib/db/__tests__/gw-plan.test.ts
git commit -m "feat: add GW plan SQLite repository"
```

---

## Task 3: Claude GW plan client

**Files:**

- Create: `lib/claude/gw-plan-client.ts`
- Create: `lib/claude/__tests__/gw-plan-client.test.ts`

**Context:** Prompt builder + JSON parser for the GW plan Claude call. Follow the same pattern as `lib/claude/simulator-client.ts` — system prompt, user prompt builder, parse function, and an `async` export that calls the Anthropic SDK. Tests cover prompt building and JSON parsing only (not the API call).

**Step 1: Write the failing tests**

Create `lib/claude/__tests__/gw-plan-client.test.ts`:

````typescript
import { describe, it, expect } from "vitest";
import { buildGwPlanPrompt, parseGwPlanResult } from "../gw-plan-client";
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
    expect(result.notes).toBe("No chip needed");
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
});
````

**Step 2: Run tests — expect failures**

```bash
npm test lib/claude/__tests__/gw-plan-client.test.ts
```

Expected: `Cannot find module '../gw-plan-client'`

**Step 3: Implement the client**

Create `lib/claude/gw-plan-client.ts`:

````typescript
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_CONFIG } from "./client";
import { getAnthropicApiKey } from "@/lib/db/settings";
import type { GwPlanResult } from "@/lib/db/gw-plan";

export interface GwPlanRequest {
  gameweek: number;
  squad: Array<{
    id: number;
    name: string;
    team: string;
    position: string;
    predictedPtsNextGW: number;
    predicted4GW: number;
    form: string;
    upcomingDifficulty: number;
  }>;
  freeTransfers: number;
  bank: number;
  topTargets: Array<{
    id: number;
    name: string;
    team: string;
    position: string;
    score: number;
    predicted4GW: number;
    form: string;
    upcomingDifficulty: number;
  }>;
  captainOptions: Array<{
    id: number;
    name: string;
    score: number;
    opponentShortName: string;
    isHome: boolean;
  }>;
}

export interface GwPlanResponse {
  thinking: string;
  plan: GwPlanResult;
  processingTime: number;
}

const SYSTEM_PROMPT = `You are a concise Fantasy Premier League advisor. Given a manager's squad and transfer options, provide a clear gameweek plan: predicted team score, captain pick with brief reasoning, recommended transfers (out → in) with 4-GW points gain and reasoning. Be concise and data-driven. Only recommend transfers within the available free transfers. Always respond with valid JSON matching the expected schema.`;

export function buildGwPlanPrompt(req: GwPlanRequest): string {
  const squadStr = req.squad
    .map(
      (p) =>
        `${p.name} (${p.position}, ${p.team}) — next GW: ${p.predictedPtsNextGW} pts, 4-GW: ${p.predicted4GW} pts, form: ${p.form}, fixture diff: ${p.upcomingDifficulty.toFixed(1)}`,
    )
    .join("\n");

  const targetsStr = req.topTargets
    .slice(0, 20)
    .map(
      (p) =>
        `${p.name} (${p.position}, ${p.team}) — score: ${p.score.toFixed(1)}, 4-GW: ${p.predicted4GW} pts, form: ${p.form}, fixture diff: ${p.upcomingDifficulty.toFixed(1)}`,
    )
    .join("\n");

  const captainsStr = req.captainOptions
    .slice(0, 5)
    .map(
      (p) =>
        `${p.name} (score: ${p.score.toFixed(1)}) — vs ${p.opponentShortName} ${p.isHome ? "H" : "A"}`,
    )
    .join("\n");

  return `Generate a GW${req.gameweek} plan for this FPL squad:

## Current Squad
${squadStr}

## Resources
Free transfers: ${req.freeTransfers}
Bank: £${(req.bank / 10).toFixed(1)}m

## Top Transfer Targets
${targetsStr}

## Captain Options
${captainsStr}

For each transfer, pointsGain = playerIn.predicted4GW - playerOut.predicted4GW.
Only recommend transfers up to the free transfer limit.

Respond with JSON:
{
  "predictedTeamPoints": <expected next GW score for optimal XI>,
  "captain": {
    "playerId": <id>,
    "name": "<name>",
    "reasoning": "<1-2 sentences>"
  },
  "transfers": [
    {
      "playerOut": { "id": <id>, "name": "<name>", "predicted4GW": <number> },
      "playerIn": { "id": <id>, "name": "<name>", "predicted4GW": <number> },
      "pointsGain": <number>,
      "reasoning": "<1-2 sentences>"
    }
  ],
  "notes": "<chip recommendation or general note, 1 sentence>"
}`;
}

export function parseGwPlanResult(text: string): GwPlanResult {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1]?.trim() || text.trim();

  try {
    const parsed = JSON.parse(jsonStr) as Partial<GwPlanResult>;
    return {
      predictedTeamPoints: parsed.predictedTeamPoints ?? 0,
      captain: parsed.captain ?? {
        playerId: 0,
        name: "Unknown",
        reasoning: "",
      },
      transfers: parsed.transfers ?? [],
      notes: parsed.notes ?? "",
    };
  } catch {
    return {
      predictedTeamPoints: 0,
      captain: { playerId: 0, name: "Unknown", reasoning: text },
      transfers: [],
      notes: "Parse error — see raw response",
    };
  }
}

export async function generateGwPlan(
  req: GwPlanRequest,
): Promise<GwPlanResponse> {
  const startTime = Date.now();

  const apiKey = getAnthropicApiKey();
  if (!apiKey)
    throw new Error(
      "Anthropic API key not configured. Please add your API key in Settings.",
    );

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: CLAUDE_CONFIG.MODEL,
    max_tokens: 12000,
    thinking: { type: "enabled", budget_tokens: 8000 },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildGwPlanPrompt(req) }],
  });

  let thinking = "";
  let text = "";
  for (const block of response.content) {
    if (block.type === "thinking") thinking = block.thinking;
    else if (block.type === "text") text = block.text;
  }

  return {
    thinking,
    plan: parseGwPlanResult(text),
    processingTime: Date.now() - startTime,
  };
}
````

**Step 4: Run tests — expect all pass**

```bash
npm test lib/claude/__tests__/gw-plan-client.test.ts
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add lib/claude/gw-plan-client.ts lib/claude/__tests__/gw-plan-client.test.ts
git commit -m "feat: add Claude GW plan client with prompt builder and parser"
```

---

## Task 4: API route

**Files:**

- Create: `app/api/gw-plan/route.ts`
- Create: `app/api/__tests__/gw-plan.test.ts`

**Context:** Two handlers. `GET` returns a cached plan (404 if none). `POST` fetches the manager's squad from FPL using `fplClient`, runs the scoring models, calls Claude, saves the plan and transfer predictions to SQLite, and returns the result. The session's `fpl_manager_id` is looked up from the `sessions` table (check `lib/db/sessions.ts` for the `getSession` function signature). Follow the pattern in `app/api/optimize/route.ts` for rate limiting and Zod validation.

**Step 1: Write failing tests**

Create `app/api/__tests__/gw-plan.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db/gw-plan", () => ({
  getGwPlan: vi.fn(),
  saveGwPlan: vi.fn(),
  insertTransferPrediction: vi.fn(),
}));

vi.mock("@/lib/claude/gw-plan-client", () => ({
  generateGwPlan: vi.fn(),
}));

vi.mock("@/lib/db/sessions", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/fpl/client", () => ({
  fplClient: {
    getBootstrapStatic: vi.fn(),
    getFixtures: vi.fn(),
    getManagerPicks: vi.fn(),
  },
}));

import { GET, POST } from "../gw-plan/route";
import {
  getGwPlan,
  saveGwPlan,
  insertTransferPrediction,
} from "@/lib/db/gw-plan";
import { generateGwPlan } from "@/lib/claude/gw-plan-client";
import { getSession } from "@/lib/db/sessions";
import { fplClient } from "@/lib/fpl/client";

const mockGetGwPlan = vi.mocked(getGwPlan);
const mockSaveGwPlan = vi.mocked(saveGwPlan);
const mockInsertTransfer = vi.mocked(insertTransferPrediction);
const mockGenerateGwPlan = vi.mocked(generateGwPlan);
const mockGetSession = vi.mocked(getSession);
const mockBootstrap = vi.mocked(fplClient.getBootstrapStatic);
const mockFixtures = vi.mocked(fplClient.getFixtures);
const mockPicks = vi.mocked(fplClient.getManagerPicks);

describe("GET /api/gw-plan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when sessionId is missing", async () => {
    const req = new NextRequest("http://localhost/api/gw-plan?gw=28");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when no plan exists", async () => {
    mockGetGwPlan.mockReturnValue(null);
    const req = new NextRequest(
      "http://localhost/api/gw-plan?sessionId=sess1&gw=28",
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns cached plan when it exists", async () => {
    const plan = {
      id: "abc",
      sessionId: "sess1",
      gameweek: 28,
      plan: {
        predictedTeamPoints: 62,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [],
        notes: "",
      },
      thinking: "",
      generatedAt: "2026-02-25",
    };
    mockGetGwPlan.mockReturnValue(plan);
    const req = new NextRequest(
      "http://localhost/api/gw-plan?sessionId=sess1&gw=28",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.predictedTeamPoints).toBe(62);
  });
});

describe("POST /api/gw-plan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when sessionId is missing", async () => {
    const req = new NextRequest("http://localhost/api/gw-plan", {
      method: "POST",
      body: JSON.stringify({ gameweek: 28 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when session has no manager connected", async () => {
    mockGetSession.mockReturnValue({
      id: "sess1",
      fpl_manager_id: null,
      display_name: null,
      created_at: "2026-01-01",
      last_seen_at: "2026-01-01",
    });
    const req = new NextRequest("http://localhost/api/gw-plan", {
      method: "POST",
      body: JSON.stringify({ sessionId: "sess1", gameweek: 28 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("generates and returns a plan when manager is connected", async () => {
    mockGetSession.mockReturnValue({
      id: "sess1",
      fpl_manager_id: 12345,
      display_name: "Test FC",
      created_at: "2026-01-01",
      last_seen_at: "2026-01-01",
    });
    mockBootstrap.mockResolvedValue({
      elements: [],
      teams: [],
      events: [
        {
          id: 28,
          is_current: true,
          is_next: false,
          finished: false,
          deadline_time: "",
        },
      ],
    } as never);
    mockFixtures.mockResolvedValue([]);
    mockPicks.mockResolvedValue({
      picks: [],
      entry_history: { bank: 10, event_transfers_cost: 0 },
    } as never);
    mockGenerateGwPlan.mockResolvedValue({
      thinking: "my thoughts",
      plan: {
        predictedTeamPoints: 58,
        captain: { playerId: 1, name: "Salah", reasoning: "great" },
        transfers: [],
        notes: "",
      },
      processingTime: 5000,
    });
    mockSaveGwPlan.mockReturnValue({
      id: "plan1",
      sessionId: "sess1",
      gameweek: 28,
      plan: {
        predictedTeamPoints: 58,
        captain: { playerId: 1, name: "Salah", reasoning: "great" },
        transfers: [],
        notes: "",
      },
      thinking: "my thoughts",
      generatedAt: "2026-02-25",
    });

    const req = new NextRequest("http://localhost/api/gw-plan", {
      method: "POST",
      body: JSON.stringify({ sessionId: "sess1", gameweek: 28 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.predictedTeamPoints).toBe(58);
  });

  it("inserts transfer predictions for each transfer in the plan", async () => {
    mockGetSession.mockReturnValue({
      id: "sess1",
      fpl_manager_id: 12345,
      display_name: "Test FC",
      created_at: "2026-01-01",
      last_seen_at: "2026-01-01",
    });
    mockBootstrap.mockResolvedValue({
      elements: [],
      teams: [],
      events: [],
    } as never);
    mockFixtures.mockResolvedValue([]);
    mockPicks.mockResolvedValue({
      picks: [],
      entry_history: { bank: 5, event_transfers_cost: 0 },
    } as never);
    mockGenerateGwPlan.mockResolvedValue({
      thinking: "",
      plan: {
        predictedTeamPoints: 60,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [
          {
            playerOut: { id: 100, name: "Saka", predicted4GW: 18 },
            playerIn: { id: 200, name: "Palmer", predicted4GW: 26 },
            pointsGain: 8,
            reasoning: "good form",
          },
        ],
        notes: "",
      },
      processingTime: 3000,
    });
    mockSaveGwPlan.mockReturnValue({
      id: "p1",
      sessionId: "sess1",
      gameweek: 28,
      plan: {
        predictedTeamPoints: 60,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [
          {
            playerOut: { id: 100, name: "Saka", predicted4GW: 18 },
            playerIn: { id: 200, name: "Palmer", predicted4GW: 26 },
            pointsGain: 8,
            reasoning: "good form",
          },
        ],
        notes: "",
      },
      thinking: "",
      generatedAt: "2026-02-25",
    });

    const req = new NextRequest("http://localhost/api/gw-plan", {
      method: "POST",
      body: JSON.stringify({ sessionId: "sess1", gameweek: 28 }),
      headers: { "Content-Type": "application/json" },
    });
    await POST(req);
    expect(mockInsertTransfer).toHaveBeenCalledWith(
      "sess1",
      28,
      100,
      "Saka",
      200,
      "Palmer",
      8,
      "good form",
    );
  });
});
```

**Step 2: Run tests — expect failures**

```bash
npm test app/api/__tests__/gw-plan.test.ts
```

Expected: `Cannot find module '../gw-plan/route'`

**Step 3: Check sessions repo for getSession signature**

```bash
grep -n "export function getSession" lib/db/sessions.ts
```

Note the exact function signature and import path.

**Step 4: Implement the route**

Create `app/api/gw-plan/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import { validationErrorResponse } from "@/lib/api/validation";
import {
  getGwPlan,
  saveGwPlan,
  insertTransferPrediction,
} from "@/lib/db/gw-plan";
import { generateGwPlan } from "@/lib/claude/gw-plan-client";
import { getSession } from "@/lib/db/sessions";
import { fplClient } from "@/lib/fpl/client";
import { enrichPlayers } from "@/lib/fpl/utils";
import { scoreTransferTargets } from "@/lib/fpl/transfer-model";
import { scoreCaptainOptions } from "@/lib/fpl/captain-model";
import { predictPoints } from "@/lib/fpl/points-model";
import { buildTeamMap } from "@/lib/fpl/utils";
import type { EnrichedPlayer } from "@/lib/fpl/utils";
import type { Fixture } from "@/lib/fpl/types";

const getSchema = z.object({
  sessionId: z.string().min(1),
  gw: z.coerce.number().int().min(1).max(38),
});

const postSchema = z.object({
  sessionId: z.string().min(1),
  gameweek: z.coerce.number().int().min(1).max(38),
});

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "claude");
  if (limited) return limited;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = getSchema.safeParse(params);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { sessionId, gw } = parsed.data;
  const plan = getGwPlan(sessionId, gw);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(plan);
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "claude");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { sessionId, gameweek } = parsed.data;

  // Get manager ID from session
  const session = getSession(sessionId);
  if (!session?.fpl_manager_id) {
    return NextResponse.json(
      { error: "No FPL manager connected. Please connect your account first." },
      { status: 404 },
    );
  }
  const managerId = session.fpl_manager_id;

  try {
    // Fetch FPL data in parallel
    const [bootstrap, fixtures, picks] = await Promise.all([
      fplClient.getBootstrapStatic(),
      fplClient.getFixtures(),
      fplClient.getManagerPicks(managerId, gameweek),
    ]);

    // Enrich all players
    const allEnriched = enrichPlayers(bootstrap);
    const enrichedMap = new Map<number, EnrichedPlayer>(
      allEnriched.map((p) => [p.id, p]),
    );
    const teamMap = buildTeamMap(bootstrap.teams);

    // Squad player IDs
    const squadIds = new Set(picks.picks.map((p) => p.element));

    // Build squad data
    const squad = picks.picks
      .map((pick) => {
        const player = enrichedMap.get(pick.element);
        if (!player) return null;
        const pred4GW = compute4GWPoints(player, fixtures, gameweek);
        const nextGWPreds = predictPoints([player], fixtures, gameweek);
        return {
          id: player.id,
          name: player.web_name,
          team: player.team_short_name,
          position: player.position_short,
          predictedPtsNextGW: nextGWPreds[0]?.predictedPoints ?? 0,
          predicted4GW: pred4GW,
          form: player.form,
          upcomingDifficulty: getAvgDifficulty(player, fixtures, gameweek, 4),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Top transfer targets (not in squad)
    const targets = scoreTransferTargets(
      allEnriched.filter((p) => !squadIds.has(p.id)),
      fixtures,
      gameweek,
    )
      .slice(0, 20)
      .map((r) => ({
        id: r.player.id,
        name: r.player.web_name,
        team: r.player.team_short_name,
        position: r.player.position_short,
        score: r.score,
        predicted4GW: compute4GWPoints(r.player, fixtures, gameweek),
        form: r.player.form,
        upcomingDifficulty: getAvgDifficulty(r.player, fixtures, gameweek, 4),
      }));

    // Captain options (from squad starters)
    const starterEnriched = picks.picks
      .filter((p) => p.position <= 11)
      .map((p) => enrichedMap.get(p.element))
      .filter((p): p is EnrichedPlayer => p !== undefined);

    const captainOptions = scoreCaptainOptions(
      starterEnriched,
      fixtures,
      teamMap,
      gameweek,
    )
      .slice(0, 5)
      .map((c) => ({
        id: c.player.id,
        name: c.player.web_name,
        score: c.score,
        opponentShortName: c.opponentShortName,
        isHome: c.isHome,
      }));

    const freeTransfers =
      picks.entry_history.event_transfers_cost === 0 ? 2 : 1;
    const bank = picks.entry_history.bank;

    // Generate plan via Claude
    const result = await generateGwPlan({
      gameweek,
      squad,
      freeTransfers,
      bank,
      topTargets: targets,
      captainOptions,
    });

    // Persist plan
    const savedPlan = saveGwPlan(
      sessionId,
      gameweek,
      result.plan,
      result.thinking,
    );

    // Persist transfer predictions for tracking
    for (const transfer of result.plan.transfers) {
      insertTransferPrediction(
        sessionId,
        gameweek,
        transfer.playerOut.id,
        transfer.playerOut.name,
        transfer.playerIn.id,
        transfer.playerIn.name,
        transfer.pointsGain,
        transfer.reasoning,
      );
    }

    return NextResponse.json(savedPlan);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Sum predicted points for next N gameweeks
function compute4GWPoints(
  player: EnrichedPlayer,
  fixtures: Fixture[],
  fromGw: number,
  gwCount = 4,
): number {
  let total = 0;
  for (let offset = 0; offset < gwCount; offset++) {
    const gw = fromGw + offset;
    if (gw > 38) break;
    const preds = predictPoints([player], fixtures, gw);
    total += preds[0]?.predictedPoints ?? 0;
  }
  return Math.round(total * 10) / 10;
}

// Average fixture difficulty over N gameweeks
function getAvgDifficulty(
  player: EnrichedPlayer,
  fixtures: Fixture[],
  fromGw: number,
  gwCount: number,
): number {
  const diffs: number[] = [];
  for (let offset = 0; offset < gwCount; offset++) {
    const gw = fromGw + offset;
    const fix = fixtures.find(
      (f) =>
        f.event === gw &&
        (f.team_h === player.team || f.team_a === player.team),
    );
    if (fix) {
      diffs.push(
        fix.team_h === player.team
          ? fix.team_h_difficulty
          : fix.team_a_difficulty,
      );
    }
  }
  return diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 3;
}
```

**Step 5: Run tests — expect all pass**

```bash
npm test app/api/__tests__/gw-plan.test.ts
```

Expected: All tests pass.

**Step 6: Commit**

```bash
git add app/api/gw-plan/route.ts app/api/__tests__/gw-plan.test.ts
git commit -m "feat: add POST/GET /api/gw-plan endpoint"
```

---

## Task 5: TransferTracker component

**Files:**

- Create: `components/dashboard/transfer-tracker.tsx`
- Create: `components/dashboard/__tests__/transfer-tracker.test.tsx`

**Context:** A table showing past transfer recommendations vs actuals. Displays status badges (pending / on track / hit / miss), the predicted gain, the running actual gain, and Claude's tracking notes if off-track.

**Step 1: Write failing tests**

Create `components/dashboard/__tests__/transfer-tracker.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransferTracker } from "../transfer-tracker";
import type { TransferPrediction } from "@/lib/db/gw-plan";

function makePrediction(
  overrides: Partial<TransferPrediction> = {},
): TransferPrediction {
  return {
    id: "p1",
    sessionId: "sess1",
    gameweekMade: 25,
    playerOutId: 100,
    playerOutName: "Saka",
    playerInId: 200,
    playerInName: "Salah",
    predictedGainPts: 8.2,
    actualGainPts: null,
    gwActuals: {},
    status: "pending",
    reasoning: "Good fixtures",
    trackingNotes: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

describe("TransferTracker", () => {
  it("renders nothing when predictions list is empty", () => {
    const { container } = render(<TransferTracker predictions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows player names for each prediction", () => {
    render(<TransferTracker predictions={[makePrediction()]} />);
    expect(screen.getByText("Saka")).toBeInTheDocument();
    expect(screen.getByText("Salah")).toBeInTheDocument();
  });

  it("shows the gameweek the transfer was made", () => {
    render(<TransferTracker predictions={[makePrediction()]} />);
    expect(screen.getByText(/GW25/)).toBeInTheDocument();
  });

  it("shows predicted gain", () => {
    render(<TransferTracker predictions={[makePrediction({ predictedGainPts: 8.2 })]}) />);
    expect(screen.getByText(/\+8\.2/)).toBeInTheDocument();
  });

  it("shows pending status", () => {
    render(<TransferTracker predictions={[makePrediction({ status: "pending" })]} />);
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it("shows on_track status", () => {
    render(
      <TransferTracker
        predictions={[makePrediction({ status: "on_track", actualGainPts: 6 })]}
      />,
    );
    expect(screen.getByText(/on track/i)).toBeInTheDocument();
  });

  it("shows hit status", () => {
    render(
      <TransferTracker
        predictions={[makePrediction({ status: "hit", actualGainPts: 9 })]}
      />,
    );
    expect(screen.getByText(/hit/i)).toBeInTheDocument();
  });

  it("shows miss status with tracking notes", () => {
    render(
      <TransferTracker
        predictions={[
          makePrediction({
            status: "miss",
            actualGainPts: 2,
            trackingNotes: "Injured in GW26",
          }),
        ]}
      />,
    );
    expect(screen.getByText(/miss/i)).toBeInTheDocument();
    expect(screen.getByText("Injured in GW26")).toBeInTheDocument();
  });

  it("shows actual points when available", () => {
    render(
      <TransferTracker
        predictions={[makePrediction({ actualGainPts: 12 })]}
      />,
    );
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });
});
```

**Step 2: Run tests — expect failures**

```bash
npm test components/dashboard/__tests__/transfer-tracker.test.tsx
```

Expected: `Cannot find module '../transfer-tracker'`

**Step 3: Implement the component**

Create `components/dashboard/transfer-tracker.tsx`:

```tsx
import type { TransferPrediction } from "@/lib/db/gw-plan";

const STATUS_STYLES: Record<
  TransferPrediction["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "text-fpl-muted" },
  on_track: { label: "On track", className: "text-fpl-green" },
  hit: { label: "Hit ✓", className: "text-fpl-green font-bold" },
  miss: { label: "Miss ✗", className: "text-red-400 font-bold" },
};

export function TransferTracker({
  predictions,
}: {
  predictions: TransferPrediction[];
}) {
  if (predictions.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-fpl-muted">
        Transfer Tracker
      </p>
      <div className="space-y-2">
        {predictions.map((p) => {
          const status = STATUS_STYLES[p.status];
          return (
            <div
              key={p.id}
              className="rounded-md border border-fpl-border bg-fpl-card/50 p-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-fpl-muted">GW{p.gameweekMade}</span>
                <span className="font-medium text-white">
                  {p.playerOutName}
                  <span className="mx-1 text-fpl-muted">→</span>
                  {p.playerInName}
                </span>
                <span className="shrink-0">
                  <span className="text-fpl-muted">pred </span>
                  <span className="text-fpl-green">+{p.predictedGainPts}</span>
                  {p.actualGainPts !== null && (
                    <>
                      <span className="mx-1 text-fpl-muted">·</span>
                      <span className="text-white">
                        actual {p.actualGainPts}
                      </span>
                    </>
                  )}
                </span>
                <span className={`shrink-0 ${status.className}`}>
                  {status.label}
                </span>
              </div>
              {p.trackingNotes && (
                <p className="mt-1 text-fpl-muted">{p.trackingNotes}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 4: Run tests — expect all pass**

```bash
npm test components/dashboard/__tests__/transfer-tracker.test.tsx
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add components/dashboard/transfer-tracker.tsx components/dashboard/__tests__/transfer-tracker.test.tsx
git commit -m "feat: add TransferTracker dashboard component"
```

---

## Task 6: GwPlanWidget component

**Files:**

- Create: `components/dashboard/gw-plan-widget.tsx`
- Create: `components/dashboard/__tests__/gw-plan-widget.test.tsx`

**Context:** The main widget. It uses `useManagerContext` for sessionId/managerId, accepts `gameweek` as a prop (passed from dashboard). On mount it checks for a cached plan via GET. Shows a "Generate GW Plan" button if no cache. On click it calls POST. Shows the plan (predicted score, captain, transfers) and renders `<TransferTracker>`.

**Step 1: Write failing tests**

Create `components/dashboard/__tests__/gw-plan-widget.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GwPlanWidget } from "../gw-plan-widget";

vi.mock("@/lib/fpl/manager-context", () => ({
  useManagerContext: vi.fn().mockReturnValue({
    managerId: 12345,
    sessionId: "sess1",
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GwPlanWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows connect prompt when no manager connected", () => {
    const { useManagerContext } = await import("@/lib/fpl/manager-context");
    vi.mocked(useManagerContext).mockReturnValueOnce({
      managerId: null,
      sessionId: "sess1",
    } as never);
    render(<GwPlanWidget gameweek={28} />);
    expect(screen.getByText(/connect/i)).toBeInTheDocument();
  });

  it("shows loading state while checking cache", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<GwPlanWidget gameweek={28} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows generate button when no cached plan exists", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as never);
    render(<GwPlanWidget gameweek={28} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /generate gw plan/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows predicted team score when plan is loaded", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "p1",
        sessionId: "sess1",
        gameweek: 28,
        plan: {
          predictedTeamPoints: 62,
          captain: { playerId: 1, name: "Salah", reasoning: "great fixtures" },
          transfers: [],
          notes: "",
        },
        thinking: "",
        generatedAt: "2026-02-25",
      }),
    } as never);
    render(<GwPlanWidget gameweek={28} />);
    await waitFor(() =>
      expect(screen.getByText(/62/)).toBeInTheDocument(),
    );
  });

  it("shows captain recommendation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "p1",
        sessionId: "sess1",
        gameweek: 28,
        plan: {
          predictedTeamPoints: 62,
          captain: {
            playerId: 1,
            name: "Salah",
            reasoning: "Easy run vs Palace",
          },
          transfers: [],
          notes: "",
        },
        thinking: "",
        generatedAt: "2026-02-25",
      }),
    } as never);
    render(<GwPlanWidget gameweek={28} />);
    await waitFor(() => {
      expect(screen.getByText("Salah")).toBeInTheDocument();
      expect(screen.getByText(/Easy run vs Palace/)).toBeInTheDocument();
    });
  });

  it("shows transfer recommendation with points gain", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "p1",
        sessionId: "sess1",
        gameweek: 28,
        plan: {
          predictedTeamPoints: 60,
          captain: { playerId: 1, name: "Salah", reasoning: "" },
          transfers: [
            {
              playerOut: { id: 100, name: "Saka", predicted4GW: 18 },
              playerIn: { id: 200, name: "Palmer", predicted4GW: 26 },
              pointsGain: 8.0,
              reasoning: "Palmer in form",
            },
          ],
          notes: "",
        },
        thinking: "",
        generatedAt: "2026-02-25",
      }),
    } as never);
    render(<GwPlanWidget gameweek={28} />);
    await waitFor(() => {
      expect(screen.getByText("Saka")).toBeInTheDocument();
      expect(screen.getByText("Palmer")).toBeInTheDocument();
      expect(screen.getByText(/\+8/)).toBeInTheDocument();
      expect(screen.getByText(/Palmer in form/)).toBeInTheDocument();
    });
  });

  it("shows regenerate button after plan is loaded", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "p1", sessionId: "sess1", gameweek: 28,
        plan: { predictedTeamPoints: 62, captain: { playerId: 1, name: "Salah", reasoning: "" }, transfers: [], notes: "" },
        thinking: "", generatedAt: "2026-02-25",
      }),
    } as never);
    render(<GwPlanWidget gameweek={28} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /regenerate/i }),
      ).toBeInTheDocument(),
    );
  });
});
```

**Step 2: Run tests — expect failures**

```bash
npm test components/dashboard/__tests__/gw-plan-widget.test.tsx
```

Expected: `Cannot find module '../gw-plan-widget'`

**Step 3: Implement the component**

Create `components/dashboard/gw-plan-widget.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useManagerContext } from "@/lib/fpl/manager-context";
import { TransferTracker } from "./transfer-tracker";
import type { GwPlan, TransferPrediction } from "@/lib/db/gw-plan";

export function GwPlanWidget({
  gameweek,
  predictions = [],
}: {
  gameweek: number;
  predictions?: TransferPrediction[];
}) {
  const { managerId, sessionId } = useManagerContext();
  const [plan, setPlan] = useState<GwPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !managerId) {
      setLoading(false);
      return;
    }
    fetch(`/api/gw-plan?sessionId=${sessionId}&gw=${gameweek}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setPlan(data as GwPlan);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId, managerId, gameweek]);

  async function generate() {
    if (!sessionId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/gw-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, gameweek }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Generation failed");
      }
      const data = await res.json();
      setPlan(data as GwPlan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (!managerId) {
    return (
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-4 text-sm text-fpl-muted">
        Connect your FPL account to generate a GW plan.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-4 text-sm text-fpl-muted">
        Loading GW plan...
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">
          GW Plan — Gameweek {gameweek}
        </h2>
        {plan && (
          <button
            onClick={generate}
            disabled={generating}
            className="text-xs text-fpl-muted hover:text-fpl-green disabled:opacity-50"
          >
            {generating ? "Generating…" : "Regenerate ↺"}
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded bg-red-900/30 p-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {!plan ? (
        <button
          onClick={generate}
          disabled={generating}
          className="w-full rounded-md border border-fpl-green bg-fpl-green/10 py-2 text-sm font-semibold text-fpl-green hover:bg-fpl-green/20 disabled:opacity-50"
        >
          {generating ? "Generating GW Plan…" : "Generate GW Plan"}
        </button>
      ) : (
        <div className="space-y-3">
          {/* Predicted score + captain */}
          <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
            <div>
              <p className="text-[10px] text-fpl-muted uppercase tracking-wide">
                Predicted score
              </p>
              <p className="text-lg font-bold text-fpl-green">
                {plan.plan.predictedTeamPoints} pts
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-fpl-muted uppercase tracking-wide">
                Captain
              </p>
              <p className="text-sm font-bold text-white">
                {plan.plan.captain.name} (C)
              </p>
              <p className="text-[10px] text-fpl-muted">
                {plan.plan.captain.reasoning}
              </p>
            </div>
          </div>

          {/* Transfers */}
          {plan.plan.transfers.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fpl-muted">
                Transfers
              </p>
              <div className="space-y-2">
                {plan.plan.transfers.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-fpl-border bg-white/5 p-2 text-xs"
                  >
                    <div className="flex items-center gap-1 font-medium">
                      <span className="text-red-400">
                        OUT {t.playerOut.name}
                      </span>
                      <span className="text-fpl-muted">→</span>
                      <span className="text-fpl-green">
                        IN {t.playerIn.name}
                      </span>
                      <span className="ml-auto text-fpl-green">
                        +{t.pointsGain} pts (4 GW)
                      </span>
                    </div>
                    <p className="mt-1 text-fpl-muted">{t.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {plan.plan.notes && (
            <p className="text-xs text-fpl-muted">{plan.plan.notes}</p>
          )}

          {/* Transfer tracker */}
          <TransferTracker predictions={predictions} />
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run tests — expect all pass**

```bash
npm test components/dashboard/__tests__/gw-plan-widget.test.tsx
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add components/dashboard/gw-plan-widget.tsx components/dashboard/__tests__/gw-plan-widget.test.tsx
git commit -m "feat: add GwPlanWidget dashboard component"
```

---

## Task 7: Dashboard integration

**Files:**

- Modify: `app/page.tsx`

**Context:** Add `<GwPlanWidget>` to the dashboard. It needs the current gameweek number (already available in `bootstrap`) and the transfer predictions (fetched client-side). Also need to fetch transfer predictions from the DB — add a `/api/gw-plan/predictions` route OR pass them via a new hook. Simplest approach: add a `GET /api/gw-plan/predictions?sessionId=` endpoint that returns predictions.

**Step 1: Add predictions endpoint**

Add to `app/api/gw-plan/route.ts` — create `app/api/gw-plan/predictions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import { validationErrorResponse } from "@/lib/api/validation";
import { getTransferPredictions } from "@/lib/db/gw-plan";

const schema = z.object({
  sessionId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "notifications");
  if (limited) return limited;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const predictions = getTransferPredictions(parsed.data.sessionId);
  return NextResponse.json(predictions);
}
```

**Step 2: Update GwPlanWidget to fetch its own predictions**

Update `components/dashboard/gw-plan-widget.tsx` to fetch predictions via `useEffect` from `/api/gw-plan/predictions?sessionId=` and pass them to `<TransferTracker>` internally (remove the `predictions` prop).

**Step 3: Add widget to dashboard**

In `app/page.tsx`, import and add `<GwPlanWidget>` after `<GameweekBanner>`:

```tsx
import { GwPlanWidget } from "@/components/dashboard/gw-plan-widget";

// Inside the return, after <GameweekBanner ...>:
{
  currentGw && <GwPlanWidget gameweek={currentGw.id} />;
}
```

Where `currentGw` is the result of `getCurrentGameweek(bootstrap.events)` or `bootstrap.events.find(e => e.is_current || e.is_next)`.

**Step 4: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add app/page.tsx app/api/gw-plan/predictions/route.ts components/dashboard/gw-plan-widget.tsx
git commit -m "feat: add GwPlanWidget to dashboard with predictions feed"
```

---

## Task 8: Scheduler tracking job

**Files:**

- Create: `lib/scheduler/gw-plan-tracker.ts`
- Create: `lib/scheduler/__tests__/gw-plan-tracker.test.ts`

**Context:** A Tuesday 7am UTC job that fetches actual points for each active transfer prediction, updates the DB, and calls Claude to explain significant misses (>20% below predicted, ≥2 GWs into the 4-GW window). Follow the `deadline-reminder.ts` pattern: async function, env check, fetch FPL API, call internal API.

**Step 1: Write tests for tracking status logic**

The core logic — computing new status and calling Claude for misses — can be extracted into a pure helper function and tested independently.

Create `lib/scheduler/__tests__/gw-plan-tracker.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  computeTrackingStatus,
  shouldRequestExplanation,
} from "../gw-plan-tracker";

describe("computeTrackingStatus", () => {
  it("returns pending when gwsElapsed < 1", () => {
    expect(computeTrackingStatus(0, 10, 8)).toBe("pending");
  });

  it("returns on_track when actual >= 80% of predicted", () => {
    expect(computeTrackingStatus(2, 10, 8)).toBe("on_track"); // 8 = 80% of 10
  });

  it("returns hit when 4 GWs elapsed and actual >= 80%", () => {
    expect(computeTrackingStatus(4, 10, 9)).toBe("hit");
  });

  it("returns miss when 4 GWs elapsed and actual < 80%", () => {
    expect(computeTrackingStatus(4, 10, 5)).toBe("miss"); // 5 = 50%
  });

  it("returns miss when >= 2 GWs elapsed and very low actual", () => {
    expect(computeTrackingStatus(2, 10, 3)).toBe("miss"); // 3 = 30%
  });
});

describe("shouldRequestExplanation", () => {
  it("returns false when < 2 GWs have elapsed", () => {
    expect(shouldRequestExplanation("miss", 1)).toBe(false);
  });

  it("returns true when status is miss and >= 2 GWs elapsed", () => {
    expect(shouldRequestExplanation("miss", 2)).toBe(true);
    expect(shouldRequestExplanation("miss", 4)).toBe(true);
  });

  it("returns false when status is not miss", () => {
    expect(shouldRequestExplanation("on_track", 3)).toBe(false);
    expect(shouldRequestExplanation("hit", 4)).toBe(false);
  });
});
```

**Step 2: Run tests — expect failures**

```bash
npm test lib/scheduler/__tests__/gw-plan-tracker.test.ts
```

Expected: `Cannot find module '../gw-plan-tracker'`

**Step 3: Implement the scheduler job**

Create `lib/scheduler/gw-plan-tracker.ts`:

```typescript
import {
  getActiveTransferPredictions,
  updateTransferActuals,
} from "@/lib/db/gw-plan";
import type { TransferPrediction } from "@/lib/db/gw-plan";

export function computeTrackingStatus(
  gwsElapsed: number,
  predictedGain: number,
  actualSoFar: number,
): TransferPrediction["status"] {
  if (gwsElapsed < 1) return "pending";

  const isComplete = gwsElapsed >= 4;
  const ratio = predictedGain > 0 ? actualSoFar / predictedGain : 1;

  if (isComplete) {
    return ratio >= 0.8 ? "hit" : "miss";
  }

  // Mid-window: flag as miss if badly underperforming after ≥2 GWs
  if (gwsElapsed >= 2 && ratio < 0.5) return "miss";

  return "on_track";
}

export function shouldRequestExplanation(
  status: TransferPrediction["status"],
  gwsElapsed: number,
): boolean {
  return status === "miss" && gwsElapsed >= 2;
}

export async function updateTransferPredictions(
  currentGameweek: number,
): Promise<void> {
  const apiKey = process.env.NOTIFICATIONS_API_KEY;
  if (!apiKey) {
    console.log("[gw-plan-tracker] Skipping — NOTIFICATIONS_API_KEY not set");
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const active = getActiveTransferPredictions();

  if (active.length === 0) {
    console.log("[gw-plan-tracker] No active predictions to update");
    return;
  }

  console.log(`[gw-plan-tracker] Updating ${active.length} predictions`);

  for (const pred of active) {
    try {
      await updateSinglePrediction(pred, currentGameweek, appUrl, apiKey);
    } catch (err) {
      console.error(
        `[gw-plan-tracker] Failed to update prediction ${pred.id}:`,
        err,
      );
    }
  }
}

async function updateSinglePrediction(
  pred: TransferPrediction,
  currentGw: number,
  appUrl: string,
  apiKey: string,
): Promise<void> {
  const gwsElapsed = currentGw - pred.gameweekMade;
  if (gwsElapsed <= 0) return;

  // Fetch actual points for player_in for completed GWs
  const updatedActuals = { ...pred.gwActuals };

  for (
    let gw = pred.gameweekMade + 1;
    gw <= Math.min(pred.gameweekMade + 4, currentGw);
    gw++
  ) {
    if (updatedActuals[String(gw)] !== undefined) continue; // already fetched

    const liveRes = await fetch(`${appUrl}/api/fpl/event/${gw}/live`);
    if (!liveRes.ok) continue;

    const live = (await liveRes.json()) as {
      elements: Array<{ id: number; stats: { total_points: number } }>;
    };
    const el = live.elements.find((e) => e.id === pred.playerInId);
    if (el) {
      updatedActuals[String(gw)] = el.stats.total_points;
    }
  }

  const actualSum = Object.values(updatedActuals).reduce((a, b) => a + b, 0);
  const gwCount = Object.keys(updatedActuals).length;
  const status = computeTrackingStatus(
    gwCount,
    pred.predictedGainPts,
    actualSum,
  );

  let trackingNotes = pred.trackingNotes;

  if (shouldRequestExplanation(status, gwCount) && !pred.trackingNotes) {
    trackingNotes = await fetchExplanation(pred, actualSum, appUrl, apiKey);
  }

  updateTransferActuals(
    pred.id,
    updatedActuals,
    actualSum,
    status,
    trackingNotes,
  );
}

async function fetchExplanation(
  pred: TransferPrediction,
  actualSoFar: number,
  appUrl: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${appUrl}/api/gw-plan/explain-miss`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        playerName: pred.playerInName,
        predictedGain: pred.predictedGainPts,
        actualSoFar,
        gwActuals: pred.gwActuals,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { explanation?: string };
    return data.explanation ?? null;
  } catch {
    return null;
  }
}
```

**Step 4: Run tests — expect all pass**

```bash
npm test lib/scheduler/__tests__/gw-plan-tracker.test.ts
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add lib/scheduler/gw-plan-tracker.ts lib/scheduler/__tests__/gw-plan-tracker.test.ts
git commit -m "feat: add GW plan transfer prediction tracker scheduler job"
```

---

## Task 9: Register scheduler job

**Files:**

- Modify: `lib/scheduler/index.ts`

**Context:** Add a Tuesday 7:00 UTC cron job that calls `updateTransferPredictions`. It needs the current gameweek, which it fetches from the FPL bootstrap. Follow the existing `checkLeagueUpdates` pattern.

**Step 1: Add import and cron job to scheduler**

In `lib/scheduler/index.ts`, add import and new job:

```typescript
import { updateTransferPredictions } from "./gw-plan-tracker";
import { fplClient, getCurrentGameweek } from "@/lib/fpl/client";

// Add inside startScheduler(), after existing jobs:
// Tuesday 7:00 UTC — update transfer prediction actuals
cron.schedule("0 7 * * 2", () => {
  console.log("[scheduler] Running GW plan tracker...");
  fplClient
    .getBootstrapStatic()
    .then((bootstrap) => {
      const gw = getCurrentGameweek(bootstrap);
      return updateTransferPredictions(gw);
    })
    .catch(console.error);
});
```

**Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests pass (scheduler code only runs in production, not in test).

**Step 3: Commit**

```bash
git add lib/scheduler/index.ts
git commit -m "feat: register GW plan tracker as Tuesday 7am UTC cron job"
```

---

## Task 10: Final check and push

**Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass. Note the count — should be 718 + new tests.

**Step 2: TypeScript check**

```bash
npm run build
```

Expected: Clean build with no TypeScript errors.

**Step 3: Smoke test in Docker**

```bash
docker compose up -d --build
```

Visit `http://localhost:3000` — the dashboard should show the GW Plan widget. Connect an FPL account and click "Generate GW Plan".

**Step 4: Push**

```bash
git push
```
