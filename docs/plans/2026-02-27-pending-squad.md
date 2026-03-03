# Pending Squad View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "GW28 Pending" navigation entry to the My Team page that shows the user's current squad (with transfers applied) using the authenticated FPL `/my-team/{id}/` endpoint.

**Architecture:** A new `GET /api/fpl/my-team` route proxies the authenticated FPL my-team endpoint. A new `usePendingPicks` React Query hook fetches from it. The My Team page detects the `is_next` gameweek from bootstrap and, when the user navigates there, switches to pending picks instead of event picks.

**Tech Stack:** Next.js App Router, React Query (`@tanstack/react-query`), Vitest, authenticatedFetch (existing at `lib/fpl/auth-client.ts`)

---

### Task 1: API route GET /api/fpl/my-team

**Files:**

- Create: `app/api/fpl/my-team/route.ts`
- Create: `app/api/fpl/my-team/__tests__/route.test.ts`

**Context:** Follow the pattern in `app/api/fpl/entry/[id]/event/[gw]/picks/route.ts`. The route calls `authenticatedFetch` (from `lib/fpl/auth-client.ts`), which requires a stored FPL session. `getFplSession()` returns null if not authenticated. `createErrorResponse` and `createValidationErrorResponse` are in `lib/api/errors.ts`. `withRateLimit` is in `lib/api/rate-limit.ts`. The `Pick` type is in `lib/fpl/types.ts`.

**Step 1: Write the failing tests**

Create `app/api/fpl/my-team/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  withRateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/fpl/auth-client", () => ({
  getFplSession: vi.fn(),
  authenticatedFetch: vi.fn(),
}));

import { GET } from "../route";
import { NextRequest } from "next/server";
import { getFplSession, authenticatedFetch } from "@/lib/fpl/auth-client";

const mockSession = {
  managerName: "Tim",
  entryId: 123,
  expiresAt: "2099-01-01T00:00:00Z",
};

function makeReq(managerId?: string) {
  const url = managerId
    ? `http://localhost/api/fpl/my-team?managerId=${managerId}`
    : "http://localhost/api/fpl/my-team";
  return new NextRequest(url);
}

beforeEach(() => vi.resetAllMocks());

describe("GET /api/fpl/my-team", () => {
  it("returns 400 for missing managerId", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it("returns 401 when not FPL authenticated", async () => {
    vi.mocked(getFplSession).mockReturnValue(null);
    const res = await GET(makeReq("123"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns picks when authenticated", async () => {
    vi.mocked(getFplSession).mockReturnValue(mockSession);
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          picks: [
            {
              element: 1,
              position: 1,
              multiplier: 1,
              is_captain: false,
              is_vice_captain: false,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const res = await GET(makeReq("123"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.picks).toHaveLength(1);
    expect(body.picks[0].element).toBe(1);
  });

  it("returns 401 when authenticatedFetch throws FPL_SESSION_EXPIRED", async () => {
    vi.mocked(getFplSession).mockReturnValue(mockSession);
    vi.mocked(authenticatedFetch).mockRejectedValue(
      new Error("FPL_SESSION_EXPIRED"),
    );
    const res = await GET(makeReq("123"));
    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run the tests to verify they fail**

```bash
npm test -- app/api/fpl/my-team/__tests__/route.test.ts
```

Expected: All 4 tests fail with "Cannot find module '../route'".

**Step 3: Create the route**

Create `app/api/fpl/my-team/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/errors";
import { getFplSession, authenticatedFetch } from "@/lib/fpl/auth-client";
import type { Pick } from "@/lib/fpl/types";

export const runtime = "nodejs";

const querySchema = z.object({
  managerId: z
    .string()
    .regex(/^\d+$/, "managerId must be a positive integer")
    .transform(Number),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rl = await withRateLimit(request, "fpl");
  if (rl) return rl;

  const parsed = querySchema.safeParse({
    managerId: request.nextUrl.searchParams.get("managerId"),
  });
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const { managerId } = parsed.data;

  const fplSession = getFplSession();
  if (!fplSession) {
    return createErrorResponse(
      "FPL session expired. Please reconnect in Settings.",
      "UNAUTHORIZED",
    );
  }

  try {
    const resp = await authenticatedFetch(
      `https://fantasy.premierleague.com/api/my-team/${managerId}/`,
    );
    if (!resp.ok) {
      return createErrorResponse(
        "Failed to fetch pending squad",
        "FPL_API_ERROR",
      );
    }
    const data = (await resp.json()) as { picks: Pick[] };
    return NextResponse.json({ picks: data.picks });
  } catch (error) {
    if (error instanceof Error && error.message === "FPL_SESSION_EXPIRED") {
      return createErrorResponse(
        "FPL session expired. Please reconnect in Settings.",
        "UNAUTHORIZED",
      );
    }
    return createErrorResponse(
      "Failed to fetch pending squad",
      "INTERNAL_ERROR",
    );
  }
}
```

**Step 4: Run the tests to verify they pass**

```bash
npm test -- app/api/fpl/my-team/__tests__/route.test.ts
```

Expected: All 4 tests pass.

**Step 5: Commit**

```bash
git add app/api/fpl/my-team/route.ts app/api/fpl/my-team/__tests__/route.test.ts
git commit -m "feat: add GET /api/fpl/my-team route for pending squad"
```

---

### Task 2: usePendingPicks hook

**Files:**

- Modify: `lib/fpl/hooks/use-fpl.ts` (add queryKey + hook after `useManagerPicks`)
- Modify: `lib/fpl/hooks/__tests__/use-fpl.test.tsx` (add test for the new hook)

**Context:** `queryKeys` is an object exported near the top of `use-fpl.ts`. The `useManagerPicks` hook is at line ~209. The pattern to follow exactly: `useQuery` with `queryKey`, `queryFn` calling `fetchFplData<T>(url)`, `staleTime`, and `enabled`. `UseFplDataResult<T>` and `useQueryAdapter` are already in scope. The test file mocks `global.fetch` — add a test block that mocks a 200 response returning `{ picks: [...] }` and a 401 response.

**Step 1: Write the failing test**

Open `lib/fpl/hooks/__tests__/use-fpl.test.tsx`. Find the end of the file and add:

```typescript
describe("usePendingPicks", () => {
  it("fetches pending picks when managerId is provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        picks: [
          {
            element: 440,
            position: 1,
            multiplier: 1,
            is_captain: false,
            is_vice_captain: false,
          },
        ],
      }),
    });

    const { result } = renderHook(() => usePendingPicks(123), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.picks).toHaveLength(1);
    expect(result.current.data?.picks[0].element).toBe(440);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/fpl/my-team?managerId=123"),
      expect.anything(),
    );
  });

  it("does not fetch when managerId is null", () => {
    const { result } = renderHook(() => usePendingPicks(null), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

Also add `usePendingPicks` to the import at the top of the test file where other hooks are imported.

**Step 2: Run test to verify it fails**

```bash
npm test -- lib/fpl/hooks/__tests__/use-fpl.test.tsx
```

Expected: Fails with "usePendingPicks is not exported".

**Step 3: Add the queryKey and hook to use-fpl.ts**

In `lib/fpl/hooks/use-fpl.ts`, find the `queryKeys` object and add the `pendingPicks` key:

```typescript
// Add inside the queryKeys object, after managerPicks:
pendingPicks: (managerId: number) =>
  ["pending-picks", managerId] as const,
```

Then, after the `useManagerPicks` function (around line 224), add:

```typescript
/**
 * Hook to fetch the user's current pending squad via authenticated my-team endpoint.
 * Returns picks with selling_price, reflecting any transfers not yet active.
 */
export function usePendingPicks(
  managerId: number | null,
): UseFplDataResult<{ picks: Pick[] }> {
  const query = useQuery({
    queryKey: queryKeys.pendingPicks(managerId ?? 0),
    queryFn: () =>
      fetchFplData<{ picks: Pick[] }>(
        `/api/fpl/my-team?managerId=${managerId}`,
      ),
    staleTime: STALE_TIMES.manager,
    enabled: managerId !== null && managerId > 0,
  });
  return useQueryAdapter(query);
}
```

Note: `Pick` is already imported in `use-fpl.ts` via `@/lib/fpl/types`. Verify it's in the import list — if not, add it.

**Step 4: Run the tests to verify they pass**

```bash
npm test -- lib/fpl/hooks/__tests__/use-fpl.test.tsx
```

Expected: All tests pass including the 2 new ones.

**Step 5: Commit**

```bash
git add lib/fpl/hooks/use-fpl.ts lib/fpl/hooks/__tests__/use-fpl.test.tsx
git commit -m "feat: add usePendingPicks hook for my-team endpoint"
```

---

### Task 3: My Team page pending view

**Files:**

- Modify: `app/team/page.tsx`
- Create: `app/team/__tests__/page.test.tsx`

**Context:** The My Team page is at `app/team/page.tsx`. It uses `useManagerContext` (returns `{ managerId, manager }`), `useBootstrapStatic`, `useManagerPicks`, `useLiveGameweek`, `useManagerHistory`. `manager.current_event` is the last played GW. `bootstrap.events` contains all GWs; the upcoming one has `is_next: true`. `GameweekSummary` takes `entryHistory` and `activeChip` — it must be hidden for the pending view since my-team has no `entry_history`. `PitchView` takes `picks`, `playerMap`, `teamMap`, `livePointsMap`, `autoSubs` — pass `autoSubs={[]}` for pending view.

The error from a 401 pending fetch will have a message containing "UNAUTHORIZED" or the text "reconnect". Show an inline message rather than the full ErrorState for this case only.

**Step 1: Write the failing tests**

Create `app/team/__tests__/page.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TeamPage from "../page";

// Mock all hooks the page uses
vi.mock("@/lib/fpl/manager-context", () => ({
  useManagerContext: vi.fn(),
}));
vi.mock("@/lib/fpl/hooks/use-fpl", () => ({
  useBootstrapStatic: vi.fn(),
  useManagerPicks: vi.fn(),
  usePendingPicks: vi.fn(),
  useLiveGameweek: vi.fn(),
  useManagerHistory: vi.fn(),
}));
vi.mock("@/components/chat", () => ({ AskAiButton: () => null }));

import { useManagerContext } from "@/lib/fpl/manager-context";
import {
  useBootstrapStatic,
  useManagerPicks,
  usePendingPicks,
  useLiveGameweek,
  useManagerHistory,
} from "@/lib/fpl/hooks/use-fpl";

const mockManager = {
  id: 1,
  current_event: 27,
  started_event: 1,
  player_first_name: "Tim",
  player_last_name: "Smith",
  name: "Test FC",
  summary_overall_points: 1000,
  summary_overall_rank: 5000,
  summary_event_points: 55,
  summary_event_rank: 10000,
  last_deadline_bank: 10,
  last_deadline_value: 1000,
  last_deadline_total_transfers: 5,
};

const mockBootstrap = {
  events: [
    { id: 27, name: "Gameweek 27", is_current: true, is_next: false, is_previous: false, deadline_time: "2026-02-20T11:30:00Z" },
    { id: 28, name: "Gameweek 28", is_current: false, is_next: true, is_previous: false, deadline_time: "2026-02-27T11:30:00Z" },
  ],
  elements: [],
  teams: [],
};

const mockPicks = {
  picks: [
    { element: 694, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false },
  ],
  entry_history: {
    event: 27, points: 55, total_points: 1000, rank: 10000, rank_sort: 10000,
    percentile_rank: 50, overall_rank: 5000, bank: 10, value: 1000,
    event_transfers: 1, event_transfers_cost: 0, points_on_bench: 5,
  },
  active_chip: null,
  automatic_subs: [],
};

const mockPendingPicks = {
  picks: [
    { element: 440, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false },
  ],
};

const noData = { data: undefined, isLoading: false, error: null, refetch: vi.fn() };

function setupMocks(overrides: Record<string, unknown> = {}) {
  vi.mocked(useManagerContext).mockReturnValue({ managerId: 1, manager: mockManager });
  vi.mocked(useBootstrapStatic).mockReturnValue({ data: mockBootstrap, isLoading: false, error: null, refetch: vi.fn() } as ReturnType<typeof useBootstrapStatic>);
  vi.mocked(useManagerPicks).mockReturnValue({ data: mockPicks, isLoading: false, error: null, refetch: vi.fn() } as ReturnType<typeof useManagerPicks>);
  vi.mocked(usePendingPicks).mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() } as ReturnType<typeof usePendingPicks>);
  vi.mocked(useLiveGameweek).mockReturnValue(noData as ReturnType<typeof useLiveGameweek>);
  vi.mocked(useManagerHistory).mockReturnValue(noData as ReturnType<typeof useManagerHistory>);
  Object.assign(overrides);
}

beforeEach(() => {
  vi.resetAllMocks();
  setupMocks();
});

describe("TeamPage pending squad", () => {
  it("shows forward nav arrow when is_next GW exists", () => {
    render(<TeamPage />);
    // GameweekNav renders two arrow buttons — the forward one should not be disabled
    const buttons = screen.getAllByRole("button");
    const nextBtn = buttons.find((b) => b.querySelector("polyline[points='9 18 15 12 9 6']"));
    expect(nextBtn).not.toBeDisabled();
  });

  it("shows 'GW28 Pending' label when navigated to next GW", async () => {
    render(<TeamPage />);
    const buttons = screen.getAllByRole("button");
    const nextBtn = buttons.find((b) => b.querySelector("polyline[points='9 18 15 12 9 6']"))!;
    fireEvent.click(nextBtn);
    await waitFor(() =>
      expect(screen.getByText(/GW28 Pending/i)).toBeInTheDocument(),
    );
  });

  it("hides GameweekSummary when showing pending view", async () => {
    vi.mocked(usePendingPicks).mockReturnValue({
      data: mockPendingPicks,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof usePendingPicks>);

    render(<TeamPage />);
    const buttons = screen.getAllByRole("button");
    const nextBtn = buttons.find((b) => b.querySelector("polyline[points='9 18 15 12 9 6']"))!;
    fireEvent.click(nextBtn);

    // GameweekSummary shows bank/points info — should not be visible
    await waitFor(() =>
      expect(screen.queryByText(/gameweek points/i)).not.toBeInTheDocument(),
    );
  });

  it("shows connect message when pending picks returns 401", async () => {
    const authError = new Error("FPL session expired. Please reconnect in Settings.");
    vi.mocked(usePendingPicks).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: authError,
      refetch: vi.fn(),
    } as ReturnType<typeof usePendingPicks>);

    render(<TeamPage />);
    const buttons = screen.getAllByRole("button");
    const nextBtn = buttons.find((b) => b.querySelector("polyline[points='9 18 15 12 9 6']"))!;
    fireEvent.click(nextBtn);

    await waitFor(() =>
      expect(
        screen.getByText(/connect your fpl account/i),
      ).toBeInTheDocument(),
    );
  });
});
```

**Step 2: Run the tests to verify they fail**

```bash
npm test -- app/team/__tests__/page.test.tsx
```

Expected: All 4 tests fail (page doesn't import `usePendingPicks` yet and has no pending logic).

**Step 3: Update the My Team page**

Edit `app/team/page.tsx`. Make these changes:

**a) Add `usePendingPicks` to the import from `use-fpl`:**

```typescript
import {
  useBootstrapStatic,
  useManagerPicks,
  usePendingPicks,
  useLiveGameweek,
  useManagerHistory,
} from "@/lib/fpl/hooks/use-fpl";
```

**b) After the existing state declarations and before `useBootstrapStatic`, add `nextGwId` and `isPendingView`:**

After `useBootstrapStatic` is called, add:

```typescript
const nextGwId = bootstrap?.events.find((e) => e.is_next)?.id;
const isPendingView = nextGwId !== undefined && selectedGw === nextGwId;
```

**c) Add the `usePendingPicks` hook call after `useManagerHistory`:**

```typescript
const {
  data: pendingPicksData,
  isLoading: pendingPicksLoading,
  error: pendingPicksError,
} = usePendingPicks(isPendingView ? managerId : null);
```

**d) Update `hasNext`:**

```typescript
const hasPrev = !!manager && selectedGw > manager.started_event;
const hasNext = !!manager && selectedGw < (nextGwId ?? manager.current_event);
```

**e) Update `gameweekName`:**

```typescript
const gameweekName = useMemo(() => {
  if (!bootstrap || !gwId) return "";
  if (isPendingView && nextGwId) return `GW${nextGwId} Pending`;
  const gw = bootstrap.events.find((e) => e.id === gwId);
  return gw?.name ?? `Gameweek ${gwId}`;
}, [bootstrap, gwId, isPendingView, nextGwId]);
```

**f) Update loading and error to include pending state:**

```typescript
const isLoading =
  bsLoading ||
  (isPendingView ? pendingPicksLoading : picksLoading) ||
  liveLoading;
const error = bsError || (isPendingView ? null : picksError) || liveError;
```

**g) Replace the main render section** — where `picksData` is checked and `GameweekSummary`/`PitchView` are rendered — with a conditional block:

Replace this block (after the `if (error)` block):

```typescript
if (!picksData) {
  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center">
      <h1 className="text-xl font-bold">My Team</h1>
      <p className="mt-2 text-sm text-fpl-muted">
        No picks data available for this gameweek.
      </p>
    </div>
  );
}
```

With:

```typescript
if (isPendingView) {
  const isAuthError =
    pendingPicksError !== null &&
    (pendingPicksError.message.toLowerCase().includes("reconnect") ||
      pendingPicksError.message.toLowerCase().includes("unauthorized"));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <TeamHeader manager={manager} entryHistory={null} />
      </div>
      <GameweekNav
        gameweekName={gameweekName}
        onPrev={() => setSelectedGw((gw) => gw - 1)}
        onNext={() => setSelectedGw((gw) => gw + 1)}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />
      {isAuthError ? (
        <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center">
          <p className="text-sm text-fpl-muted">
            Connect your FPL account in Settings to see pending transfers.
          </p>
        </div>
      ) : pendingPicksData ? (
        <PitchView
          picks={pendingPicksData.picks}
          playerMap={playerMap}
          teamMap={teamMap}
          livePointsMap={null}
          autoSubs={[]}
        />
      ) : (
        <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center">
          <p className="mt-2 text-sm text-fpl-muted">
            No pending squad data available.
          </p>
        </div>
      )}
    </div>
  );
}

if (!picksData) {
  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center">
      <h1 className="text-xl font-bold">My Team</h1>
      <p className="mt-2 text-sm text-fpl-muted">
        No picks data available for this gameweek.
      </p>
    </div>
  );
}
```

Note: `TeamHeader` currently takes `entryHistory: ManagerHistoryCurrent` — check its props. If it requires a non-null value, pass `picksData.entry_history` from the previous GW OR omit `TeamHeader` for the pending view and just show the manager name inline. Check `components/team/team-header.tsx` first and adjust accordingly.

**Step 4: Run the tests to verify they pass**

```bash
npm test -- app/team/__tests__/page.test.tsx
```

Expected: All 4 tests pass.

**Step 5: Run the full test suite**

```bash
npm test
```

Expected: All tests pass.

**Step 6: Commit**

```bash
git add app/team/page.tsx app/team/__tests__/page.test.tsx
git commit -m "feat: add GW pending view to My Team page"
```
