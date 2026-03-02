# Pending Squad View Design

**Goal:** Show the user's pending squad (with transfers applied) on the My Team page as a "GW{n} Pending" navigation entry, using the authenticated `/my-team/{id}/` endpoint.

**Architecture:** The My Team page currently navigates between completed gameweeks via `useManagerPicks`. A parallel data path is added for the pending view: a new API route proxies the authenticated FPL my-team endpoint and returns picks shaped for PitchView. The page detects when `selectedGw === nextGwId` and switches to this endpoint automatically.

**Tech Stack:** Next.js App Router, React Query, authenticatedFetch (existing), PitchView (existing)

---

## Components

**New API route: `GET /api/fpl/my-team`**

- Query param: `managerId` (number)
- Calls `authenticatedFetch("https://fantasy.premierleague.com/api/my-team/{id}/")`
- Returns `{ picks: Pick[] }` — same Pick shape used by PitchView
- Returns 401 with `code: "UNAUTHORIZED"` if no FPL session

**My Team page changes (`app/team/page.tsx`)**

- Compute `nextGwId` from `bootstrap.events.find(e => e.is_next)?.id`
- `hasNext` becomes `selectedGw < (nextGwId ?? manager.current_event)`
- When `selectedGw === nextGwId`: fetch from `/api/fpl/my-team?managerId={id}` instead of event picks
- `gameweekName` displays `"GW{n} Pending"` for the next GW entry
- Hide `GameweekSummary` for pending view (no entry_history available)
- Pass `autoSubs={[]}` to PitchView for pending view
- Show inline message if 401 (not FPL authenticated)

## Data Flow

```
selectedGw === nextGwId
  → fetch /api/fpl/my-team?managerId=123
    → authenticatedFetch /api/my-team/123/
      → { picks: [...] }
  → PitchView(picks, playerMap, teamMap, livePointsMap=null, autoSubs=[])
```

## Error Handling

- **Not FPL authenticated (401):** Show "Connect your FPL account in Settings to see pending transfers" instead of pitch
- **FPL session expired:** Same message
- **my-team returns 404/500:** Fall back to "No pending squad data available"

## Testing

- API route: 200 with picks when authenticated, 401 when not
- Team page: `hasNext` true when nextGwId exists, `gameweekName` shows "GW28 Pending", GameweekSummary hidden for pending GW, pending message shown on 401
