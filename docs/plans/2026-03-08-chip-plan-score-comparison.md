# Chip Plan Score Comparison — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show current squad's predicted score alongside chip squad's predicted score so users can see the uplift.

**Architecture:** Add `currentSquadPredictedPoints` field to `GwPlanResult`. Calculate it in the chip-plan API route by summing the current squad's predicted points across the same gameweeks. Display side-by-side in the widget with a delta.

**Tech Stack:** TypeScript, Next.js API route, React component, Vitest

---

### Task 1: Add `currentSquadPredictedPoints` to `GwPlanResult` type

**Files:**

- Modify: `lib/db/gw-plan.ts:4-46`
- Test: `lib/db/__tests__/gw-plan.test.ts` (if exists, otherwise skip — type-only change)

**Step 1: Write the failing test**

In `app/api/gw-plan/__tests__/chip-plan-route.test.ts` (or the existing chip plan test file), add a test that asserts the chip plan response includes `currentSquadPredictedPoints` as a number. Since the route test may not exist yet, this will be done in Task 3 alongside the route change.

For now, this is a type-only change — verify via TypeScript compilation.

**Step 2: Add the field to `GwPlanResult`**

In `lib/db/gw-plan.ts`, add to the `GwPlanResult` interface:

```typescript
/** Predicted points for the current squad over the same period (for chip plan comparison) */
currentSquadPredictedPoints?: number;
```

Add it after the `chipSquad` field (line 44), before `notes`.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS (field is optional, no consumers break)

**Step 4: Commit**

```bash
git add lib/db/gw-plan.ts
git commit -m "feat: add currentSquadPredictedPoints to GwPlanResult type"
```

---

### Task 2: Calculate current squad predicted points in chip-plan route

**Files:**

- Modify: `app/api/gw-plan/chip-plan/route.ts:125-146` (after picks fetch, before Claude call)

**Step 1: Write the failing test**

Create or extend `app/api/gw-plan/__tests__/chip-plan-score.test.ts`. Test that the route response JSON includes `plan.currentSquadPredictedPoints` as a number > 0.

Since the route calls external APIs (FPL, Claude), this is best tested via the widget integration test in Task 4. Instead, write a focused unit test for the scoring logic:

Create `lib/fpl/__tests__/current-squad-score.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { predictPoints } from "../points-model";

describe("current squad score calculation", () => {
  it("sums predicted points across multiple gameweeks for current squad players", () => {
    // This test validates the summation logic that will be used in the route.
    // The route sums predictedPoints for each current squad player across gwsToPredict.
    // We test the same pattern here with mock data.

    const mockPlayers = [
      { id: 1, predictedPoints: 5.0 },
      { id: 2, predictedPoints: 4.0 },
      { id: 3, predictedPoints: 6.0 },
    ];

    const currentSquadIds = [1, 2, 3];
    const gwPredictionMaps = [
      new Map(mockPlayers.map((p) => [p.id, p])),
      new Map(
        mockPlayers.map((p) => [
          p.id,
          { ...p, predictedPoints: p.predictedPoints + 1 },
        ]),
      ),
    ];

    // Sum across all GWs for current squad players
    const total = currentSquadIds.reduce((squadSum, playerId) => {
      const playerGwSum = gwPredictionMaps.reduce((gwSum, map) => {
        const p = map.get(playerId);
        return gwSum + (p?.predictedPoints ?? 0);
      }, 0);
      return squadSum + playerGwSum;
    }, 0);

    // GW1: 5+4+6=15, GW2: 6+5+7=18, total=33
    expect(total).toBe(33);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npx vitest run lib/fpl/__tests__/current-squad-score.test.ts`
Expected: PASS (this tests the pure logic pattern)

**Step 3: Add current squad score calculation to chip-plan route**

In `app/api/gw-plan/chip-plan/route.ts`, after line 168 (after `gwPredictionMaps` is built) and after `currentSquad` is built (line 137), add:

```typescript
// Calculate current squad's predicted points for comparison
const currentSquadPredictedPoints = picks.picks.reduce((squadSum, pick) => {
  const playerGwSum = gwPredictionMaps.reduce((gwSum, map) => {
    const p = map.get(pick.element);
    return gwSum + (p?.predictedPoints ?? 0);
  }, 0);
  return squadSum + playerGwSum;
}, 0);
```

This must go AFTER `gwPredictionMaps` is built (line 168) but the variable is used later.

Then in the `gwPlanResult` construction (around line 316), add:

```typescript
currentSquadPredictedPoints: Math.round(currentSquadPredictedPoints),
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/gw-plan/chip-plan/route.ts lib/fpl/__tests__/current-squad-score.test.ts
git commit -m "feat: calculate current squad predicted points in chip plan route"
```

---

### Task 3: Update widget to show score comparison for chip plans

**Files:**

- Modify: `components/dashboard/gw-plan-widget.tsx:335-343`
- Test: `components/dashboard/__tests__/gw-plan-widget.test.tsx`

**Step 1: Write the failing test — comparison display**

Add to `components/dashboard/__tests__/gw-plan-widget.test.tsx`, inside the chip squad describe block (around line 1760):

```typescript
it("shows score comparison with current squad for chip plans", async () => {
  const chipPlan = renderWithChipSquad("wildcard");
  // Override predictedTeamPoints and add currentSquadPredictedPoints
  chipPlan.plan.predictedTeamPoints = 212;
  chipPlan.plan.currentSquadPredictedPoints = 185;

  mockFetch.mockImplementation((url: unknown) => {
    const urlStr = String(url);
    if (urlStr.includes("fpl-auth/status")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ connected: true, managerId: 123 }),
      });
    }
    if (urlStr.includes("/entry/123/history")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ chips: [] }),
      });
    }
    if (urlStr.includes("/api/gw-plan") && !urlStr.includes("chip-plan") && !urlStr.includes("predictions")) {
      return Promise.resolve({
        ok: true,
        json: async () => chipPlan,
      });
    }
    if (urlStr.includes("predictions")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ predictions: [] }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });

  render(<GwPlanWidget sessionId="sess1" gameweek={30} />);

  await waitFor(() => {
    expect(screen.getByText("Current squad:")).toBeInTheDocument();
    expect(screen.getByText("185")).toBeInTheDocument();
    expect(screen.getByText("212")).toBeInTheDocument();
    expect(screen.getByText("+27 pts")).toBeInTheDocument();
  });
});
```

Note: Adapt the mock helper `renderWithChipSquad` to match the existing pattern in the test file — look at how `renderWithLineupPlan` builds the mock data and follow the same structure. The key is that the cached plan returned from `GET /api/gw-plan` must have `chipType` set and `plan.currentSquadPredictedPoints` populated.

**Step 2: Run test to verify it fails**

Run: `npx vitest run components/dashboard/__tests__/gw-plan-widget.test.tsx -t "shows score comparison"`
Expected: FAIL — "Current squad:" not found

**Step 3: Write the failing test — period label**

Add another test:

```typescript
it("shows '(over 4 gameweeks)' label for wildcard chip plans", async () => {
  // Similar setup as above with chipType: "wildcard"
  // Assert: screen.getByText(/over 4 gameweeks/i)
});

it("shows '(this gameweek)' label for free hit chip plans", async () => {
  // Similar setup with chipType: "freehit"
  // Assert: screen.getByText(/this gameweek/i)
});
```

**Step 4: Run tests to verify they fail**

Run: `npx vitest run components/dashboard/__tests__/gw-plan-widget.test.tsx -t "over 4 gameweeks"`
Expected: FAIL

**Step 5: Implement the comparison display**

In `components/dashboard/gw-plan-widget.tsx`, replace lines 335-343 (the predicted team score section):

```tsx
{
  /* Predicted team score */
}
<div className="flex items-center gap-3">
  <div>
    {chipType && plan.plan.currentSquadPredictedPoints != null ? (
      <>
        <p className="text-xs text-fpl-muted">
          Predicted Team Score{" "}
          <span className="opacity-60">
            ({chipType === "wildcard" ? "over 4 gameweeks" : "this gameweek"})
          </span>
        </p>
        <div className="mt-1 flex items-baseline gap-4">
          <div>
            <p className="text-xs text-fpl-muted">Current squad:</p>
            <p className="text-lg font-semibold text-fpl-muted">
              {Math.round(plan.plan.currentSquadPredictedPoints)}
            </p>
          </div>
          <div>
            <p className="text-xs text-fpl-muted">
              {chipType === "wildcard" ? "Wildcard" : "Free Hit"} squad:
            </p>
            <p className="text-2xl font-bold text-fpl-green">
              {Math.round(plan.plan.predictedTeamPoints)}
            </p>
          </div>
          {(() => {
            const delta = Math.round(
              plan.plan.predictedTeamPoints -
                plan.plan.currentSquadPredictedPoints,
            );
            return (
              <div>
                <p className="text-xs text-fpl-muted">Improvement:</p>
                <p
                  className={`text-lg font-bold ${delta >= 0 ? "text-fpl-green" : "text-red-400"}`}
                >
                  {delta >= 0 ? "+" : ""}
                  {delta} pts
                </p>
              </div>
            );
          })()}
        </div>
      </>
    ) : (
      <>
        <p className="text-xs text-fpl-muted">Predicted Team Score</p>
        <p className="text-2xl font-bold text-fpl-green">
          {Math.round(plan.plan.predictedTeamPoints)}
        </p>
      </>
    )}
  </div>
</div>;
```

**Step 6: Run all tests to verify they pass**

Run: `npx vitest run components/dashboard/__tests__/gw-plan-widget.test.tsx`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add components/dashboard/gw-plan-widget.tsx components/dashboard/__tests__/gw-plan-widget.test.tsx
git commit -m "feat: show score comparison for chip plans (current vs chip squad)"
```

---

### Task 4: Verify end-to-end and run full test suite

**Step 1: Run full test suite**

Run: `npm test`
Expected: ALL PASS

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

**Step 4: Final commit if any fixes needed**

---

### Summary of changes

| File                                                     | Change                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `lib/db/gw-plan.ts`                                      | Add `currentSquadPredictedPoints?: number` to `GwPlanResult` |
| `app/api/gw-plan/chip-plan/route.ts`                     | Calculate current squad predicted score, return in response  |
| `components/dashboard/gw-plan-widget.tsx`                | Show side-by-side comparison for chip plans                  |
| `lib/fpl/__tests__/current-squad-score.test.ts`          | Unit test for summation logic                                |
| `components/dashboard/__tests__/gw-plan-widget.test.tsx` | Tests for comparison display and period labels               |
