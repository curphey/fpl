# Wildcard & Free Hit Chip Planner — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Wildcard and Free Hit buttons to the GW Plan widget that use Claude to recommend a complete 15-player squad rebuild and submit it to FPL with the chip activated.

**Architecture:** New `chip-plan` API route + Claude client for full squad generation, stored in the existing `gw_plans` table with a new `chip_type` column, with a small extension to the `submit` route to activate the chip flag. The GW Plan widget gets chip availability checking and two new buttons.

**Tech Stack:** Next.js App Router, TypeScript, SQLite (better-sqlite3), Anthropic SDK, Zod, Vitest, React

---

## Scope

Wildcard and Free Hit only. Both involve a full squad rebuild. Triple Captain and Bench Boost are out of scope.

- **Wildcard**: optimise for next 4 gameweeks. Squad changes are permanent.
- **Free Hit**: optimise for next 1 gameweek only. FPL reverts the squad automatically after the gameweek.

---

## Data Model

### `gw_plans` table — new column

```sql
ALTER TABLE gw_plans ADD COLUMN chip_type TEXT; -- NULL | 'wildcard' | 'freehit'
```

Added to `lib/db/gw-plan.ts` schema initialisation. Existing rows default to NULL (regular plan).

### TypeScript — `GwPlan` interface extension

```typescript
// lib/db/gw-plan.ts
export interface GwPlan {
  id: string;
  sessionId: string;
  gameweek: number;
  thinking: string;
  plan: GwPlanResult;
  generatedAt: string;
  chipType?: "wildcard" | "freehit"; // new
}
```

The `GwPlanResult` structure is **unchanged** — `transfers` holds the up-to-15 player swap pairs, `captain` holds the captain pick, `substitutions` holds the starting XI / bench ordering changes, `notes` holds any caveats.

---

## Claude Prompt — Chip Plan

### New file: `lib/claude/chip-plan-client.ts`

**Inputs (`ChipPlanRequest`):**

```typescript
export interface ChipPlanRequest {
  chipType: "wildcard" | "freehit";
  gameweek: number;
  budget: number; // sum of all 15 current selling prices + bank, in 0.1m units
  currentSquad: ChipPlanCurrentPlayer[]; // 15 current players (for context)
  candidates: ChipPlanCandidatesByPosition; // top affordable players per position
}

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
  GK: ChipPlanCandidate[]; // top ~15 affordable GKs
  DEF: ChipPlanCandidate[]; // top ~25 affordable DEFs
  MID: ChipPlanCandidate[]; // top ~25 affordable MIDs
  FWD: ChipPlanCandidate[]; // top ~20 affordable FWDs
}
```

**System prompt key rules:**

1. Pick exactly: 2 GK, 5 DEF, 5 MID, 3 FWD
2. Max 3 players from any single club
3. Total cost of all 15 players ≤ budget
4. Wildcard: optimise for predicted4GW (4-gameweek horizon)
5. Free Hit: optimise for predictedNextGW (single gameweek only — squad reverts)
6. Output the starting XI (11 players) and bench order (4 players, GK bench last)

**Output schema from Claude:**

```json
{
  "predictedTeamPoints": 85,
  "squad": {
    "GK":  [{"id": 1,  "name": "Raya",    "cost": 5.5}, {"id": 2, "name": "Flekken", "cost": 4.5}],
    "DEF": [5 players],
    "MID": [5 players],
    "FWD": [3 players]
  },
  "startingXI": [1, 10, 25, 30, ...],  // 11 player IDs
  "benchOrder": [3, 14, 22, 2],        // 4 player IDs, GK bench last
  "captain": { "playerId": 30, "name": "Salah", "reasoning": "..." },
  "notes": "..."
}
```

**Server-side transfer computation:**
After parsing Claude's response, pair current players with new players by position to build the `GwPlanResult.transfers` array:

- Current 2 GKs → New 2 GKs (2 pairs)
- Current 5 DEFs → New 5 DEFs (5 pairs)
- Current 5 MIDs → New 5 MIDs (5 pairs)
- Current 3 FWDs → New 3 FWDs (3 pairs)

Any player appearing in both current and new squad gets paired with themselves (no-op transfer, excluded from the transfers array).

**`generateChipPlan()` function** follows the same pattern as `generateGwPlan()` — uses Claude extended thinking, returns `{ thinking, plan, processingTime }`.

---

## API Routes

### New: `POST /api/gw-plan/chip-plan`

**Request body (Zod schema):**

```typescript
z.object({
  sessionId: z.string().uuid(),
  gameweek: z.number().int().min(1).max(38),
  chipType: z.enum(["wildcard", "freehit"]),
});
```

**Flow:**

1. Rate limit (claude tier)
2. Validate session + FPL manager connected
3. Get `ManagerHistory` via `fplClient.getManagerHistory(managerId)` — check `history.chips` array to confirm chip not already used this season; return 409 if already used
4. Fetch `ManagerPicks` via `fplClient.getManagerPicks(managerId, gameweek)` — get current 15 players + their selling prices from authenticated `/my-team/` endpoint
5. Fetch bootstrap-static — build candidate pools: top players per position sorted by points model score, filtered to cost ≤ (budget / 11) as rough affordability pre-filter, max 25 per position
6. Call `generateChipPlan(req)` → parse result
7. Compute transfer pairs from current squad → new squad
8. Save to `gw_plans` with `chip_type` set
9. Return the `GwPlan` (same response shape as `GET /api/gw-plan`)

**Error responses:**

- 400: missing/invalid fields
- 401: no session or FPL not connected
- 409: chip already used this season
- 500: Claude API error

### Modified: `POST /api/gw-plan/submit`

Add one optional field to the existing Zod schema:

```typescript
chipType: z.enum(["wildcard", "freehit"]).optional(),
```

When `chipType` is present, pass it to the FPL transfers API:

```typescript
body: JSON.stringify({
  confirmed: confirm,
  entry: managerId,
  event: gameweek,
  transfers,
  wildcard: chipType === "wildcard",
  freehit: chipType === "freehit",
});
```

Also pass `chipType` through the `SubmitPlanModal` → submit route call.

---

## UI — `GwPlanWidget`

### Chip availability check

On mount (alongside the existing FPL auth status check), fetch manager history and determine which chips are available:

```typescript
const [availableChips, setAvailableChips] = useState<{
  wildcard: boolean;
  freehit: boolean;
}>({ wildcard: false, freehit: false });
```

Fetch `GET /api/fpl/entry/{managerId}/history` — check `chips` array for entries with `name === "wildcard"` / `name === "freehit"`. If not found → chip is available. Only run this check when `fplConnected` is true.

Note: Wildcard can be played twice (once in each half of the season, GWs 1–19 and 20–38). Need to check if the chip has been used in the current half.

### New buttons

Below the existing "Generate GW Plan" button, show chip buttons when available:

```
[ Generate GW Plan ]
[ Wildcard ]  [ Free Hit ]          ← only shown if available + fplConnected
```

Clicking a chip button:

1. Sets `loading = true` with label "Generating Wildcard plan…"
2. POSTs to `/api/gw-plan/chip-plan`
3. On success: sets `plan` state (same as regular plan), sets `chipType` state
4. All transfers pre-selected (chip plans are all-or-nothing by nature)

### Plan display in chip mode

A small badge above the predicted score:

```
[ WILDCARD PLAN ]   or   [ FREE HIT PLAN ]
Predicted Team Score: 85
```

The transfers section shows all 15 swaps. The "Submit" button label reflects the chip:

```
Submit Wildcard (15 transfers) ▶
```

The confirm modal gets `chipType` passed through so the submit route activates the chip.

---

## Testing

Each new file gets a `__tests__/` unit test:

- `lib/claude/chip-plan-client.test.ts` — prompt builder output, response parser (valid JSON, malformed JSON)
- `app/api/gw-plan/chip-plan/__tests__/route.test.ts` — 401 no session, 409 chip already used, 200 happy path (mock Claude + FPL calls)
- `app/api/gw-plan/submit/__tests__/route.test.ts` — extend existing tests: confirm `wildcard: true` passed when `chipType: "wildcard"`

---

## What Does NOT Change

- `SubmitPlanModal` — no changes needed; already handles N transfers
- `lib/db/gw-plan.ts` repository functions — minor: include `chip_type` in INSERT and SELECT
- Transfer tracker — chip transfers are tracked the same way as regular transfers
- The lineup submission route (`submit-lineup`) — untouched
