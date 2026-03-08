# Formation Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show the recommended formation (e.g. "4-3-3") with reasoning in both chip plans and regular GW plans.

**Architecture:** Add `formation` and `formationReasoning` fields to Claude's response schemas for both plan types. Add `lineupPlan` to regular GW plans (chip plans already have it). Display formation badge + reasoning in the widget. All formation data comes from Claude's explicit recommendation.

**Tech Stack:** TypeScript, Claude API prompts, React component, Vitest

---

### Task 1: Add formation fields to GwPlanResult type

**Files:**
- Modify: `lib/db/gw-plan.ts:4-47`

**Step 1: Add fields**

In `lib/db/gw-plan.ts`, add to `GwPlanResult` interface after `currentSquadPredictedPoints` and before `notes`:

```typescript
/** Recommended formation e.g. "4-3-3", "3-5-2" */
formation?: string;
/** Why this formation was chosen */
formationReasoning?: string;
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add lib/db/gw-plan.ts
git commit -m "feat: add formation fields to GwPlanResult type"
```

---

### Task 2: Update chip plan prompt and parser for formation

**Files:**
- Modify: `lib/claude/chip-plan-client.ts:60-67,133-150,166-192`
- Test: `lib/claude/__tests__/chip-plan-client.test.ts`

**Step 1: Write failing tests**

Add to `lib/claude/__tests__/chip-plan-client.test.ts`:

```typescript
it("prompt schema includes formation and formationReasoning", () => {
  const prompt = buildChipPlanPrompt(BASE_REQ);
  expect(prompt).toContain('"formation"');
  expect(prompt).toContain('"formationReasoning"');
});
```

And in the `parseChipPlanResult` describe:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/claude/__tests__/chip-plan-client.test.ts`
Expected: FAIL

**Step 3: Update ChipPlanRawResult type**

In `lib/claude/chip-plan-client.ts`, add to `ChipPlanRawResult` (line ~66):

```typescript
formation?: string;
formationReasoning?: string;
```

**Step 4: Update chip plan prompt schema**

In `buildChipPlanPrompt`, update the JSON schema section (around line 133) to add before `"notes"`:

```
  "formation": "<DEF-MID-FWD formation e.g. '4-3-3', '3-5-2'>",
  "formationReasoning": "<1-2 sentence explanation of why this formation>",
```

**Step 5: Update parser**

In `parseChipPlanResult` (line ~172), add to the returned object:

```typescript
formation: parsed.formation ?? undefined,
formationReasoning: parsed.formationReasoning ?? undefined,
```

Also add to `EMPTY_RESULT`:

```typescript
formation: undefined,
formationReasoning: undefined,
```

**Step 6: Run tests**

Run: `npx vitest run lib/claude/__tests__/chip-plan-client.test.ts`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add lib/claude/chip-plan-client.ts lib/claude/__tests__/chip-plan-client.test.ts
git commit -m "feat: add formation to chip plan prompt and parser"
```

---

### Task 3: Update regular GW plan prompt and parser for formation + lineup

**Files:**
- Modify: `lib/claude/gw-plan-client.ts:71-96,98-183,189-241`
- Test: `lib/claude/__tests__/gw-plan-client.test.ts`

**Step 1: Write failing tests**

Add to `lib/claude/__tests__/gw-plan-client.test.ts`:

In the `buildGwPlanPrompt` describe:

```typescript
it("includes formation and formationReasoning in JSON schema", () => {
  const prompt = buildGwPlanPrompt(baseRequest);
  expect(prompt).toContain('"formation"');
  expect(prompt).toContain('"formationReasoning"');
});

it("includes lineupPlan in JSON schema", () => {
  const prompt = buildGwPlanPrompt(baseRequest);
  expect(prompt).toContain('"lineupPlan"');
  expect(prompt).toContain('"startingXI"');
  expect(prompt).toContain('"benchOrder"');
});
```

In the `parseGwPlanResult` describe:

```typescript
it("extracts formation, formationReasoning and lineupPlan", () => {
  const json = JSON.stringify({
    predictedTeamPoints: 62,
    captain: { playerId: 1, name: "Salah", reasoning: "good fixtures" },
    transfers: [],
    substitutions: [],
    formation: "4-4-2",
    formationReasoning: "Balanced approach suits mixed fixtures",
    lineupPlan: {
      startingXI: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      benchOrder: [12, 13, 14, 15],
    },
    notes: "",
  });
  const result = parseGwPlanResult(json);
  expect(result.formation).toBe("4-4-2");
  expect(result.formationReasoning).toBe("Balanced approach suits mixed fixtures");
  expect(result.lineupPlan?.startingXI).toHaveLength(11);
  expect(result.lineupPlan?.benchOrder).toHaveLength(4);
});

it("defaults formation and lineupPlan to undefined when absent", () => {
  const json = JSON.stringify({
    predictedTeamPoints: 55,
    captain: { playerId: 1, name: "Salah", reasoning: "" },
    transfers: [],
    notes: "",
  });
  const result = parseGwPlanResult(json);
  expect(result.formation).toBeUndefined();
  expect(result.formationReasoning).toBeUndefined();
  expect(result.lineupPlan).toBeUndefined();
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/claude/__tests__/gw-plan-client.test.ts`
Expected: FAIL

**Step 3: Update system prompt**

In `GW_PLAN_SYSTEM_PROMPT`, add a new principle after item 9:

```
10. Formation: Recommend the optimal formation (e.g. 4-3-3, 3-5-2) AFTER considering transfers and substitutions. Output the final starting XI and bench order. The formation must respect minimum requirements: at least 1 GK, 3 DEF, 2 MID, 1 FWD in the starting XI.
```

**Step 4: Update prompt JSON schema**

In `buildGwPlanPrompt`, update the JSON schema (around line 157) to add before `"notes"`:

```
  "formation": "<DEF-MID-FWD formation e.g. '4-3-3', '3-5-2'>",
  "formationReasoning": "<1-2 sentence explanation of why this formation>",
  "lineupPlan": {
    "startingXI": [<11 player IDs from squad AFTER transfers and substitutions>],
    "benchOrder": [<4 player IDs — GK bench LAST>]
  },
```

**Step 5: Update parser**

In `parseGwPlanResult`, add to the returned object (around line 226):

```typescript
formation: parsed.formation ?? undefined,
formationReasoning: parsed.formationReasoning ?? undefined,
lineupPlan: parsed.lineupPlan
  ? {
      startingXI: (parsed.lineupPlan.startingXI ?? []).map((id: number) => ({
        id,
        name: `Player ${id}`,
      })),
      benchOrder: (parsed.lineupPlan.benchOrder ?? []).map((id: number) => ({
        id,
        name: `Player ${id}`,
      })),
    }
  : undefined,
```

Note: Names are placeholders here — the route will enrich them with real names from playerMap. Also add the `formation` and `formationReasoning` fields to the error fallback return object.

**Step 6: Run tests**

Run: `npx vitest run lib/claude/__tests__/gw-plan-client.test.ts`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add lib/claude/gw-plan-client.ts lib/claude/__tests__/gw-plan-client.test.ts
git commit -m "feat: add formation and lineup to GW plan prompt and parser"
```

---

### Task 4: Pass formation through in chip-plan route

**Files:**
- Modify: `app/api/gw-plan/chip-plan/route.ts:316-340`

**Step 1: Add formation fields to gwPlanResult**

In `app/api/gw-plan/chip-plan/route.ts`, in the `gwPlanResult` construction (around line 316), add:

```typescript
formation: result.formation,
formationReasoning: result.formationReasoning,
```

**Step 2: Run existing tests**

Run: `npx vitest run app/api/gw-plan/chip-plan/__tests__/route.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add app/api/gw-plan/chip-plan/route.ts
git commit -m "feat: pass formation through in chip-plan route"
```

---

### Task 5: Pass formation + lineupPlan through in regular GW plan route

**Files:**
- Modify: `app/api/gw-plan/route.ts:282-286`

**Step 1: Enrich lineupPlan names from playerMap**

In `app/api/gw-plan/route.ts`, after the `generateGwPlan` call (line 283) and before `saveGwPlan` (line 286), add enrichment:

```typescript
// Enrich lineupPlan player names from playerMap (parser only has placeholder names)
if (plan.lineupPlan) {
  plan.lineupPlan.startingXI = plan.lineupPlan.startingXI.map((p) => ({
    id: p.id,
    name: playerMap.get(p.id)?.web_name ?? `Player ${p.id}`,
  }));
  plan.lineupPlan.benchOrder = plan.lineupPlan.benchOrder.map((p) => ({
    id: p.id,
    name: playerMap.get(p.id)?.web_name ?? `Player ${p.id}`,
  }));
}
```

The `formation` and `formationReasoning` fields are already on `plan` from the parser — no extra work needed since they pass through to `saveGwPlan` as part of the `GwPlanResult` object.

**Step 2: Run existing tests**

Run: `npx vitest run app/api/__tests__/gw-plan.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add app/api/gw-plan/route.ts
git commit -m "feat: pass formation and lineup through in regular GW plan route"
```

---

### Task 6: Display formation in widget

**Files:**
- Modify: `components/dashboard/gw-plan-widget.tsx`
- Test: `components/dashboard/__tests__/gw-plan-widget.test.tsx`

**Step 1: Write failing tests**

Add tests to `components/dashboard/__tests__/gw-plan-widget.test.tsx`:

```typescript
describe("Formation display", () => {
  it("shows formation badge when plan has formation", async () => {
    // Setup mock that returns a plan with formation: "4-3-3"
    // and formationReasoning: "Strong midfield"
    // Assert: screen.getByText("4-3-3") exists
    // Assert: screen.getByText("Strong midfield") exists
  });

  it("does not show formation section when formation is absent", async () => {
    // Setup mock that returns a plan WITHOUT formation
    // Assert: screen.queryByText(/\d-\d-\d/) is null (no formation pattern)
  });

  it("shows lineup section for regular plans when lineupPlan exists", async () => {
    // Setup mock with lineupPlan but NO chipType
    // Assert: "Starting XI" and "Bench" sections appear
  });
});
```

Use the existing test patterns (mockFetch setup, waitFor, etc.) from the widget test file.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run components/dashboard/__tests__/gw-plan-widget.test.tsx -t "Formation"`
Expected: FAIL

**Step 3: Implement formation display**

In `gw-plan-widget.tsx`, add a formation section after the captain recommendation and before the squad/transfers section. Show it whenever `plan.plan.formation` exists:

```tsx
{/* Formation */}
{plan.plan.formation && (
  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fpl-muted">
      Formation
    </p>
    <p className="text-lg font-bold text-white">{plan.plan.formation}</p>
    {plan.plan.formationReasoning && (
      <p className="mt-1 text-sm text-fpl-muted">
        {plan.plan.formationReasoning}
      </p>
    )}
  </div>
)}
```

Insert this JSX between the captain section (ending around line 354) and the chip squad / transfers section (starting around line 357).

**Step 4: Run all widget tests**

Run: `npx vitest run components/dashboard/__tests__/gw-plan-widget.test.tsx`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add components/dashboard/gw-plan-widget.tsx components/dashboard/__tests__/gw-plan-widget.test.tsx
git commit -m "feat: display formation badge and reasoning in GW plan widget"
```

---

### Task 7: Full verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: ALL PASS

**Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Lint**

Run: `npm run lint`
Expected: 0 errors

---

### Summary of changes

| File | Change |
|------|--------|
| `lib/db/gw-plan.ts` | Add `formation?` and `formationReasoning?` to `GwPlanResult` |
| `lib/claude/chip-plan-client.ts` | Add formation to prompt schema, raw result type, and parser |
| `lib/claude/gw-plan-client.ts` | Add formation + lineupPlan to system prompt, prompt schema, and parser |
| `app/api/gw-plan/chip-plan/route.ts` | Pass formation through to response |
| `app/api/gw-plan/route.ts` | Enrich lineupPlan names, pass formation through |
| `components/dashboard/gw-plan-widget.tsx` | Display formation badge + reasoning |
| Test files | Tests for prompt schema, parser, and widget display |
