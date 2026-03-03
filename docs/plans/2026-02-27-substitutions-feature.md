# Substitutions Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI-powered substitution recommendations to the GW Plan widget, structured identically to transfers — Claude recommends lineup swaps, each shown with a tick box, submitted to FPL via the my-team API when confirmed.

**Architecture:** Add a `substitutions` field to `GwPlanResult`, update the Claude prompt to output structured substitutions JSON alongside transfers, create a new `/api/gw-plan/submit-lineup` API route that swaps pick positions via FPL's my-team endpoint, and extend the widget + modal to present and submit lineup changes.

**Tech Stack:** TypeScript, Next.js App Router, Zod, FPL API (`POST /api/my-team/{id}/`), Vitest + React Testing Library

---

### Task 1: Extend `GwPlanResult` type and response parser

**Files:**

- Modify: `lib/db/gw-plan.ts` (lines 4-22)
- Modify: `lib/claude/gw-plan-client.ts` (lines 181-221)

**What we're building:** Add a `substitutions` array to `GwPlanResult` for structured lineup-swap recommendations (replacing the free-text `benchAdvice` field with something Claude can fill in as structured data). Keep `benchAdvice` as optional for backward compatibility with any cached plans.

**Step 1: Write the failing test**

In `lib/db/__tests__/gw-plan.test.ts` (or the existing test file for this module), add:

```typescript
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
  expect(result.substitutions![0].playerOut.name).toBe("Garner");
  expect(result.substitutions![0].playerIn.name).toBe("Dalot");
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
```

**Step 2: Run test to verify it fails**

```bash
npm test lib/db/__tests__/gw-plan.test.ts
```

Expected: FAIL — `result.substitutions` is `undefined`

**Step 3: Add `substitutions` to `GwPlanResult` interface in `lib/db/gw-plan.ts`**

```typescript
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
    hitCost: number;
    reasoning: string;
  }>;
  substitutions: Array<{
    playerOut: { id: number; name: string };
    playerIn: { id: number; name: string };
    reasoning: string;
  }>;
  /** @deprecated Free-text bench advice. Replaced by structured substitutions. */
  benchAdvice?: string;
  notes: string;
}
```

**Step 4: Update `parseGwPlanResult` in `lib/claude/gw-plan-client.ts`**

In the `try` block of `parseGwPlanResult`, add substitutions parsing:

```typescript
substitutions: (parsed.substitutions ?? []).map(
  (s: {
    playerOut: { id: number; name: string };
    playerIn: { id: number; name: string };
    reasoning: string;
  }) => ({
    playerOut: s.playerOut,
    playerIn: s.playerIn,
    reasoning: s.reasoning,
  }),
),
```

Also add to the catch/fallback:

```typescript
substitutions: [],
```

**Step 5: Run tests to verify they pass**

```bash
npm test lib/db/__tests__/gw-plan.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add lib/db/gw-plan.ts lib/claude/gw-plan-client.ts lib/db/__tests__/gw-plan.test.ts
git commit -m "feat: add substitutions field to GwPlanResult"
```

---

### Task 2: Update Claude prompt to output structured substitutions

**Files:**

- Modify: `lib/claude/gw-plan-client.ts` (lines 71-174)
- Test: `lib/claude/__tests__/gw-plan-client.test.ts` (if it exists, otherwise check for relevant tests)

**What we're building:** Update the system prompt and JSON schema so Claude outputs a `substitutions` array instead of free-text `benchAdvice`. Claude should recommend which bench player should start over which starter, based on predicted points.

**Step 1: Write a failing test for the prompt**

In `lib/claude/__tests__/gw-plan-client.test.ts`:

```typescript
import { buildGwPlanPrompt, GW_PLAN_SYSTEM_PROMPT } from "../gw-plan-client";

it("system prompt instructs Claude to output substitutions array", () => {
  expect(GW_PLAN_SYSTEM_PROMPT).toContain('"substitutions"');
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
});
```

**Step 2: Run test to verify it fails**

```bash
npm test lib/claude/__tests__/gw-plan-client.test.ts
```

Expected: FAIL

**Step 3: Update `GW_PLAN_SYSTEM_PROMPT` in `lib/claude/gw-plan-client.ts`**

Replace rule #7 (bench analysis) with:

```
7. Substitutions: Review the starting XI and bench (priority order: Slot 1 = highest auto-sub priority). If any bench player has higher predicted points than a starting player in the same position role (e.g. outfield or GK), recommend swapping them. Output these as structured substitutions with reasoning. If no swap is beneficial, output an empty substitutions array.
```

**Step 4: Update JSON schema in `buildGwPlanPrompt`**

Replace the `benchAdvice` field in the schema with a `substitutions` array:

```json
"substitutions": [
  {
    "playerOut": { "id": <number — starter being dropped>, "name": "<string>" },
    "playerIn": { "id": <number — bench player coming on>, "name": "<string>" },
    "reasoning": "<1-2 sentence explanation>"
  }
],
```

Remove the `benchAdvice` field from the schema entirely (Claude no longer needs to output it).

**Step 5: Run tests to verify they pass**

```bash
npm test lib/claude/__tests__/gw-plan-client.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add lib/claude/gw-plan-client.ts lib/claude/__tests__/gw-plan-client.test.ts
git commit -m "feat: update GW plan prompt to output structured substitutions"
```

---

### Task 3: Create `/api/gw-plan/submit-lineup` route

**Files:**

- Create: `app/api/gw-plan/submit-lineup/route.ts`
- Create: `app/api/gw-plan/submit-lineup/__tests__/route.test.ts`

**What we're building:** An API route that:

1. Validates the request (sessionId, planId, substitutionIndices, confirm)
2. Fetches the current my-team picks from FPL (which has position 1-15)
3. For each selected substitution, swaps the `position` values between playerOut and playerIn
4. POSTs the updated picks array to `https://fantasy.premierleague.com/api/my-team/{managerId}/`

**FPL my-team endpoint details:**

- GET: `https://fantasy.premierleague.com/api/my-team/{managerId}/` returns `{ picks: [{element, position, selling_price, purchase_price, multiplier, is_captain, is_vice_captain}] }`
- POST (lineup change): `{ picks: [{element, position, is_captain, is_vice_captain}] }` — only these 4 fields needed

**Step 1: Write the failing test**

```typescript
// app/api/gw-plan/submit-lineup/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db/sessions", () => ({
  getSession: vi.fn(),
}));
vi.mock("@/lib/db/gw-plan", () => ({
  getGwPlanById: vi.fn(),
}));
vi.mock("@/lib/fpl/auth-client", () => ({
  getFplSession: vi.fn(),
  authenticatedFetch: vi.fn(),
}));

import { POST } from "../route";
import { getSession } from "@/lib/db/sessions";
import { getGwPlanById } from "@/lib/db/gw-plan";
import { getFplSession, authenticatedFetch } from "@/lib/fpl/auth-client";
import { NextRequest } from "next/server";

const mockPlan = {
  id: "plan-123",
  sessionId: "session-abc",
  gameweek: 28,
  thinking: "",
  generatedAt: new Date().toISOString(),
  plan: {
    predictedTeamPoints: 55,
    captain: { playerId: 1, name: "Salah", reasoning: "" },
    transfers: [],
    substitutions: [
      {
        playerOut: { id: 10, name: "Garner" },
        playerIn: { id: 20, name: "Dalot" },
        reasoning: "Dalot predicted higher",
      },
    ],
    notes: "",
  },
};

const mockMyTeamPicks = [
  { element: 10, position: 8, is_captain: false, is_vice_captain: false },
  { element: 20, position: 12, is_captain: false, is_vice_captain: false },
  { element: 30, position: 1, is_captain: true, is_vice_captain: false },
];

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/gw-plan/submit-lineup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSession).mockReturnValue({
    id: "session-abc",
    fpl_manager_id: 999,
    display_name: null,
    created_at: "",
    updated_at: "",
  });
  vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
  vi.mocked(getFplSession).mockReturnValue({
    csrfToken: "tok",
    plProfile: "pro",
  });
  vi.mocked(authenticatedFetch)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ picks: mockMyTeamPicks }),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
});

describe("POST /api/gw-plan/submit-lineup", () => {
  it("returns 400 for missing sessionId", async () => {
    const req = makeRequest({ planId: "plan-123", confirm: true });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("swaps positions and POSTs to FPL when confirm=true", async () => {
    const req = makeRequest({
      sessionId: "session-abc",
      planId: "plan-123",
      confirm: true,
      substitutionIndices: [0],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.submitted).toBe(true);

    // Verify authenticatedFetch was called with correct swapped picks
    const postCall = vi.mocked(authenticatedFetch).mock.calls[1];
    const body = JSON.parse(postCall[1]!.body as string) as {
      picks: Array<{ element: number; position: number }>;
    };
    const garnerPick = body.picks.find((p) => p.element === 10);
    const dalotPick = body.picks.find((p) => p.element === 20);
    // Garner (was pos 8) should now be pos 12; Dalot (was pos 12) should now be pos 8
    expect(garnerPick?.position).toBe(12);
    expect(dalotPick?.position).toBe(8);
  });

  it("dry-runs when confirm=false", async () => {
    const req = makeRequest({
      sessionId: "session-abc",
      planId: "plan-123",
      confirm: false,
      substitutionIndices: [0],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(true);
    // Should only have called authenticatedFetch once (for GET my-team, not POST)
    expect(vi.mocked(authenticatedFetch)).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test app/api/gw-plan/submit-lineup/__tests__/route.test.ts
```

Expected: FAIL — route file doesn't exist

**Step 3: Create the route file**

```typescript
// app/api/gw-plan/submit-lineup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/errors";
import { getSession } from "@/lib/db/sessions";
import { getGwPlanById } from "@/lib/db/gw-plan";
import { getFplSession, authenticatedFetch } from "@/lib/fpl/auth-client";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  planId: z.string().uuid("Invalid plan ID"),
  confirm: z.boolean(),
  /** Indices into plan.plan.substitutions to apply. If absent, all are applied. */
  substitutionIndices: z.array(z.number().int().min(0)).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "fpl");
  if (rl) return rl;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const { sessionId, planId, confirm, substitutionIndices } = parsed.data;

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

  const gwPlan = getGwPlanById(planId, sessionId);
  if (!gwPlan) {
    return createErrorResponse("Plan not found", "NOT_FOUND");
  }

  const allSubs = gwPlan.plan.substitutions ?? [];
  const selectedSubs =
    substitutionIndices !== undefined
      ? allSubs.filter((_, i) => substitutionIndices.includes(i))
      : allSubs;

  if (selectedSubs.length === 0) {
    return createErrorResponse("No substitutions selected", "BAD_REQUEST");
  }

  const managerId = session.fpl_manager_id;

  // Fetch current my-team picks to get current positions
  const myTeamResp = await authenticatedFetch(
    `https://fantasy.premierleague.com/api/my-team/${managerId}/`,
  );
  if (!myTeamResp.ok) {
    if (myTeamResp.status === 401 || myTeamResp.status === 403) {
      return createErrorResponse("FPL session expired", "UNAUTHORIZED");
    }
    return createErrorResponse(
      "Failed to fetch current squad",
      "FPL_API_ERROR",
    );
  }

  const myTeam = (await myTeamResp.json()) as {
    picks: Array<{
      element: number;
      position: number;
      is_captain: boolean;
      is_vice_captain: boolean;
    }>;
  };

  // Build a mutable position map: element id → position
  const positionMap = new Map(myTeam.picks.map((p) => [p.element, p.position]));

  // Apply each substitution: swap positions between playerOut and playerIn
  for (const sub of selectedSubs) {
    const outPos = positionMap.get(sub.playerOut.id);
    const inPos = positionMap.get(sub.playerIn.id);
    if (outPos === undefined || inPos === undefined) {
      return createErrorResponse(
        `Player ${sub.playerOut.name} or ${sub.playerIn.name} not found in current squad`,
        "VALIDATION_ERROR",
      );
    }
    positionMap.set(sub.playerOut.id, inPos);
    positionMap.set(sub.playerIn.id, outPos);
  }

  // Build updated picks for FPL API
  const updatedPicks = myTeam.picks.map((p) => ({
    element: p.element,
    position: positionMap.get(p.element) ?? p.position,
    is_captain: p.is_captain,
    is_vice_captain: p.is_vice_captain,
  }));

  if (!confirm) {
    return NextResponse.json({ valid: true, picks: updatedPicks });
  }

  try {
    const fplResp = await authenticatedFetch(
      `https://fantasy.premierleague.com/api/my-team/${managerId}/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: updatedPicks }),
      },
    );

    if (!fplResp.ok) {
      if (fplResp.status === 401 || fplResp.status === 403) {
        return createErrorResponse("FPL session expired", "UNAUTHORIZED");
      }
      const errBody = (await fplResp.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      console.error(
        "FPL lineup API error",
        fplResp.status,
        JSON.stringify(errBody),
      );
      return createErrorResponse("FPL lineup request failed", "FPL_API_ERROR");
    }

    return NextResponse.json({
      submitted: true,
      substitutionsMade: selectedSubs.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FPL_SESSION_EXPIRED") {
      return createErrorResponse(
        "FPL session expired. Please reconnect in Settings.",
        "UNAUTHORIZED",
      );
    }
    console.error("Lineup submission error:", error);
    return createErrorResponse("Lineup submission failed", "INTERNAL_ERROR");
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test app/api/gw-plan/submit-lineup/__tests__/route.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/gw-plan/submit-lineup/route.ts app/api/gw-plan/submit-lineup/__tests__/route.test.ts
git commit -m "feat: add submit-lineup API route for applying substitutions to FPL"
```

---

### Task 4: Update `SubmitPlanModal` to handle lineup changes

**Files:**

- Modify: `components/dashboard/submit-plan-modal.tsx`
- Modify: `components/dashboard/__tests__/submit-plan-modal.test.tsx`

**What we're building:** Extend the modal to optionally submit substitutions (lineup changes) after transfers. When only substitutions are selected (no transfers), the modal heading reads "Confirm Lineup Changes". When both are present, it reads "Confirm Changes". The submission is sequential: transfers first (if any), then lineup.

**Step 1: Write the failing tests**

Add these tests to `components/dashboard/__tests__/submit-plan-modal.test.tsx`:

```typescript
const planWithSubs: GwPlan = {
  ...mockPlan,
  plan: {
    ...mockPlan.plan,
    transfers: [],
    substitutions: [
      {
        playerOut: { id: 10, name: "Garner" },
        playerIn: { id: 20, name: "Dalot" },
        reasoning: "Dalot is better this week",
      },
    ],
  },
};

it("shows substitution in confirm view when substitutions present", () => {
  render(
    <SubmitPlanModal
      open={true}
      onClose={vi.fn()}
      plan={planWithSubs}
      sessionId="sess-1"
      selectedTransferIndices={[]}
      selectedSubstitutionIndices={[0]}
    />,
  );
  expect(screen.getByText("Garner")).toBeInTheDocument();
  expect(screen.getByText("Dalot")).toBeInTheDocument();
});

it("submits lineup when only substitutions selected", async () => {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ submitted: true }),
  } as Response);

  render(
    <SubmitPlanModal
      open={true}
      onClose={vi.fn()}
      plan={planWithSubs}
      sessionId="sess-1"
      selectedTransferIndices={[]}
      selectedSubstitutionIndices={[0]}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument());

  expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
    "/api/gw-plan/submit-lineup",
    expect.objectContaining({ method: "POST" }),
  );
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test components/dashboard/__tests__/submit-plan-modal.test.tsx
```

Expected: FAIL — `selectedSubstitutionIndices` prop doesn't exist

**Step 3: Update `SubmitPlanModal`**

Add the new prop and update the component:

```typescript
export interface SubmitPlanModalProps {
  open: boolean;
  onClose: () => void;
  plan: GwPlan;
  sessionId: string;
  selectedTransferIndices?: number[];
  selectedSubstitutionIndices?: number[];
  onSuccess?: () => void;
}
```

Update `handleConfirm` to:

1. Submit transfers first (if any selected transfers)
2. Submit lineup changes (if any selected substitutions)

```typescript
async function handleConfirm() {
  setState("submitting");
  setErrorMsg(null);
  try {
    // Submit transfers if any
    if (selectedTransfers.length > 0) {
      const res = await fetch("/api/gw-plan/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          planId: plan.id,
          confirm: true,
          ...(selectedTransferIndices !== undefined && {
            transferIndices: selectedTransferIndices,
          }),
        }),
      });
      const json = (await res.json()) as {
        submitted?: boolean;
        alreadyApplied?: boolean;
        error?: string;
      };
      if (!res.ok || !json.submitted) {
        setErrorMsg(json.error ?? "Transfer submission failed");
        setState("error");
        return;
      }
      setAlreadyApplied(json.alreadyApplied ?? false);
    }

    // Submit lineup changes if any
    if (selectedSubstitutions.length > 0) {
      const res = await fetch("/api/gw-plan/submit-lineup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          planId: plan.id,
          confirm: true,
          substitutionIndices: selectedSubstitutionIndices,
        }),
      });
      const json = (await res.json()) as {
        submitted?: boolean;
        error?: string;
      };
      if (!res.ok || !json.submitted) {
        setErrorMsg(json.error ?? "Lineup submission failed");
        setState("error");
        return;
      }
    }

    setState("success");
  } catch {
    setErrorMsg("Network error during submission");
    setState("error");
  }
}
```

Update `selectedSubstitutions` derived value:

```typescript
const selectedSubstitutions =
  selectedSubstitutionIndices !== undefined
    ? (gwPlan.plan.substitutions ?? []).filter((_, i) =>
        selectedSubstitutionIndices.includes(i),
      )
    : (gwPlan.plan.substitutions ?? []);
```

Update modal title logic:

- Both transfers + subs: "Confirm Changes"
- Only transfers: "Confirm Transfers" (existing)
- Only subs: "Confirm Lineup Changes"

Show substitutions in the confirm view with same styling as transfers (but without hit cost).

Update success message:

- "Changes submitted ✓" when both transfers and subs were made

**Step 4: Run tests to verify they pass**

```bash
npm test components/dashboard/__tests__/submit-plan-modal.test.tsx
```

Expected: PASS (all 10 existing + 2 new = 12 tests)

**Step 5: Commit**

```bash
git add components/dashboard/submit-plan-modal.tsx components/dashboard/__tests__/submit-plan-modal.test.tsx
git commit -m "feat: extend SubmitPlanModal to handle lineup changes alongside transfers"
```

---

### Task 5: Update `GwPlanWidget` to show substitution tick boxes

**Files:**

- Modify: `components/dashboard/gw-plan-widget.tsx`
- Modify: `components/dashboard/__tests__/gw-plan-widget.test.tsx`

**What we're building:** Add a "Substitutions" section to the GW Plan widget with the same tick-box UX as the Transfers section. A single submit button covers both selected transfers and selected substitutions. The `SubmitPlanModal` is opened with both sets of selected indices.

**Step 1: Write the failing tests**

Add to `components/dashboard/__tests__/gw-plan-widget.test.tsx`:

```typescript
const planWithSubs: GwPlan = {
  ...mockGwPlan,
  plan: {
    ...mockGwPlan.plan,
    substitutions: [
      {
        playerOut: { id: 10, name: "Garner" },
        playerIn: { id: 20, name: "Dalot" },
        reasoning: "Dalot has better predicted points this week",
      },
    ],
  },
};

it("renders substitution section when plan has substitutions", async () => {
  vi.mocked(global.fetch)
    .mockResolvedValueOnce({ ok: false } as Response) // fpl-auth/status
    .mockResolvedValueOnce({ ok: false } as Response); // gw-plan cache miss

  render(<GwPlanWidget sessionId="sess-1" gameweek={28} />);

  vi.mocked(global.fetch)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => planWithSubs,
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ predictions: [] }),
    } as Response);

  fireEvent.click(screen.getByRole("button", { name: /generate gw plan/i }));

  await waitFor(() =>
    expect(screen.getByText("Substitutions")).toBeInTheDocument(),
  );
  expect(screen.getByText("Garner")).toBeInTheDocument();
  expect(screen.getByText("Dalot")).toBeInTheDocument();
});

it("shows substitution checkbox checked by default", async () => {
  // ... similar setup with planWithSubs ...
  // After plan loads, verify substitution checkbox is checked
  await waitFor(() => {
    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox is for substitution (no transfers in planWithSubs)
    expect(checkboxes[0]).toBeChecked();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test components/dashboard/__tests__/gw-plan-widget.test.tsx
```

Expected: FAIL — "Substitutions" text not found

**Step 3: Update the widget**

In `gw-plan-widget.tsx`:

1. Add `selectedSubstitutions` state: `const [selectedSubstitutions, setSelectedSubstitutions] = useState<Set<number>>(new Set());`

2. In `generate()` and cached-plan load: after `setPlan(data)`, also set `setSelectedSubstitutions(new Set(data.plan.substitutions?.map((_, i) => i) ?? []))`

3. Add `toggleSubstitution` function (same pattern as `toggleTransfer`)

4. After the transfers section, add substitutions section:

```tsx
{
  /* Substitutions */
}
{
  (plan.plan.substitutions?.length ?? 0) > 0 && (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fpl-muted">
        Substitutions
      </p>
      <div className="space-y-2">
        {plan.plan.substitutions!.map((sub, idx) => (
          <label
            key={idx}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedSubstitutions.has(idx)}
              onChange={() => toggleSubstitution(idx)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-fpl-green"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-red-400">{sub.playerOut.name}</span>
                <span className="text-fpl-muted">&#8594;</span>
                <span className="text-fpl-green">{sub.playerIn.name}</span>
              </div>
              <p className="mt-1 text-xs text-fpl-muted">{sub.reasoning}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
```

5. Update submit button logic — show it when either transfers OR substitutions are selected:

```tsx
{fplConnected && (selectedCount > 0 || selectedSubstitutions.size > 0) && (
  <button onClick={() => setShowSubmitModal(true)} ...>
    {submitted ? "Submitted ✓" : buildSubmitLabel(selectedCount, selectedSubstitutions.size)}
  </button>
)}
```

Where `buildSubmitLabel` returns e.g. "Submit 1 Transfer + 1 Sub" or "Submit 1 Sub" or "Submit 2 Transfers".

6. Pass `selectedSubstitutionIndices` to `SubmitPlanModal`:

```tsx
<SubmitPlanModal
  ...
  selectedSubstitutionIndices={Array.from(selectedSubstitutions).sort((a, b) => a - b)}
  ...
/>
```

**Step 4: Run tests to verify they pass**

```bash
npm test components/dashboard/__tests__/gw-plan-widget.test.tsx
```

Expected: PASS (all existing 14 + new = 16+ tests)

**Step 5: Run all tests**

```bash
npm test
```

Expected: All passing

**Step 6: Commit**

```bash
git add components/dashboard/gw-plan-widget.tsx components/dashboard/__tests__/gw-plan-widget.test.tsx
git commit -m "feat: add substitution tick boxes to GW plan widget"
```

---

### Final: Run full test suite

```bash
npm test
```

Expected: All tests pass. No regressions.
