# FPL Insights - Future Roadmap

This document outlines recommended improvements, new features, and technical debt to address. Based on comprehensive code review, UX analysis, and competitive analysis.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Fixes (Completed)](#critical-fixes-completed)
3. [High Priority - Security & Performance](#high-priority---security--performance)
4. [New Features for FPL Enthusiasts](#new-features-for-fpl-enthusiasts)
5. [UX Improvements](#ux-improvements)
6. [Technical Debt](#technical-debt)
7. [Documentation Gaps](#documentation-gaps)
8. [Testing Coverage](#testing-coverage)
9. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

FPL Insights is a sophisticated, differentiated FPL analytics tool with:

- **Best-in-class Claude AI integration** (extended thinking for complex decisions)
- **Strong core features** (transfers, captain, chips, leagues analysis)
- **Modern PWA architecture** (offline support, push notifications)
- **Clean codebase** with 159+ tests and strict TypeScript

**Main opportunities:**

- Leverage Claude AI for scenarios competitors can't offer (counterfactual analysis, rival gameplan prediction)
- Add Expected Points leaderboard (high value, uses existing API data)
- Implement list virtualization for performance
- Expand test coverage to API routes and components

---

## Critical Fixes (Completed)

These issues have been fixed in the latest commit:

| Issue                            | File                                         | Fix                                                    |
| -------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| Memory leak in SW registration   | `components/pwa/service-worker-register.tsx` | Added cleanup for setInterval                          |
| Timing-attack vulnerable API key | `app/api/notifications/send/route.ts`        | Using constant-time comparison                         |
| Missing env vars                 | `.env.example`                               | Added NOTIFICATIONS_API_KEY, NEXT_PUBLIC_APP_URL, etc. |

---

## High Priority - Security & Performance

### Security

#### 1. Add Rate Limiting to API Routes

**Priority:** HIGH
**Effort:** 1-2 days

All API routes are unprotected from abuse. `/api/optimize` uses Claude API which has cost implications.

**Recommendation:**

- Use Upstash Redis for rate limiting
- Implement tiered limits: 100 req/min for FPL proxy, 10 req/min for Claude endpoints
- Return 429 with retry-after header

```typescript
// Example implementation with @upstash/ratelimit
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),
});
```

#### 2. Add Input Validation with Zod

**Priority:** HIGH
**Effort:** 2-3 days

Several API routes lack comprehensive input validation.

**Files to update:**

- `app/api/fpl/fixtures/route.ts` - validate gameweek is 1-38
- `app/api/fpl/entry/[id]/route.ts` - validate manager ID range
- `app/api/optimize/route.ts` - validate request body schema
- `app/api/notifications/send/route.ts` - validate notification payload

### Performance

#### 3. Implement Request Deduplication

**Priority:** HIGH
**Effort:** 2-3 days

Multiple components mounting simultaneously make duplicate requests.

**Recommendation:**

- Use TanStack Query (React Query) or SWR for client-side caching
- Provides automatic deduplication, stale-while-revalidate, and background refetching

```typescript
// Example with TanStack Query
import { useQuery } from "@tanstack/react-query";

export function useBootstrapStatic() {
  return useQuery({
    queryKey: ["bootstrap-static"],
    queryFn: () => fetch("/api/fpl/bootstrap-static").then((r) => r.json()),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

#### 4. Add List Virtualization

**Priority:** HIGH
**Effort:** 1-2 days

Player tables can have 700+ items. Fixture grids can be 20 teams × 38 gameweeks.

**Files to update:**

- `components/dashboard/top-players-table.tsx`
- `components/league-analyzer/effective-ownership-table.tsx`
- `components/fixtures/fixture-grid.tsx`

**Recommendation:**

- Use `@tanstack/react-virtual` or `react-window`
- Only render visible rows + buffer

#### 5. Add React.memo to List Items

**Priority:** MEDIUM
**Effort:** 1 day

Table row components are recreated on every render.

**Files to update:**

- `components/transfers/transfer-table.tsx`
- `components/captain/captain-card.tsx`
- All table row components

---

## New Features for FPL Enthusiasts

### Phase 1: Quick Wins (1-2 weeks)

#### Expected Points Leaderboard

**Why:** Managers check this 10+ times per week. FPL API provides `ep_next` but it's not displayed.

**Implementation:**

- Add new page `/app/expected-points/page.tsx`
- Rank players by `ep_next` from bootstrap data
- Show vs. ownership (high ep/low ownership = differentials)
- Filter by GW, position, team, fixture difficulty

#### Ownership Momentum Tracker

**Why:** Identifies falling assets (about to drop in price) and rising differentials.

**Implementation:**

- Track `transfers_in_event` and `transfers_out_event` from API
- Calculate momentum = (transfers_in - transfers_out) / total_transfers
- Visualize as sparklines over last 5 GWs
- Alert when players cross threshold (>5% ownership change)

#### Bench Boost Analyzer

**Why:** Most misused chip; high ROI if timed correctly.

**Implementation:**

- Parse manager history for bench points per GW
- Identify optimal bench boost timing (when bench has green fixtures)
- Calculate "missed opportunity" score

### Phase 2: AI-Powered Features (2-3 weeks)

#### GW Decision Simulator (Claude AI)

**Why:** Differentiates against non-AI competitors.

**User stories:**

- "If I captain Haaland instead of Salah in GW5, what's my expected rank change?"
- "Should I use Free Hit in GW7 (blank) or GW8 (DGW)?"

**Implementation:**

- New endpoint `/api/simulate` using Claude extended thinking
- Input: current squad, proposed action, rival context
- Output: expected rank change, confidence interval, reasoning

#### Rival Gameplan Analyzer

**Why:** Psychological edge in mini-leagues.

**Implementation:**

- Analyze rival's chip usage patterns (e.g., "always plays TC in DGWs")
- Predict next chip based on fixtures and history
- Suggest counter-strategy

#### Injury Return Predictor

**Why:** Most uncertain factor in team building.

**Implementation:**

- Input injury type + player to Claude
- Use historical precedents for return timeline
- Confidence-adjusted expected points on return

### Phase 3: Data Integration (3-4 weeks)

#### Historical Season Analyzer

**Why:** Pattern recognition is cornerstone of expert play.

**Implementation:**

- Store FPL seasons 2016-2024 in Supabase
- Compare player trajectories across seasons
- Identify seasonal patterns (e.g., "defenders peak in Feb-Mar")

#### Team Underlying Stats Dashboard

**Why:** Football nerds love this; enables advanced prediction.

**Implementation:**

- Parse existing fixture data for xG, xGA per team
- Correlate team stats to player FPL output
- Flag defensive collapses (xGA spiked but DEF still scored)

### Phase 4: New Formats (4-6 weeks)

#### Head-to-Head (H2H) Mode

**Why:** H2H players are ~20% of UK FPL audience but underserved.

**Implementation:**

- Support H2H classic leagues (weekly head-to-head scoring)
- Different captain logic (only vs opponent)
- Weekly matchup analyzer

#### Draft Mode Support

**Why:** Growing format with different strategy.

**Implementation:**

- Auction/snake draft simulator
- Auto-suggest picks based on ADP vs value
- Keeper league support

---

## UX Improvements

### High Priority

#### 1. Move "My Team" to Primary Mobile Nav

**Why:** Most important page for FPL managers, but hidden in hamburger menu.

**File:** `components/layout/nav-items.ts`

#### 2. Add Squad Context to AI Optimizer

**Why:** Optimizer doesn't know user's current squad unless manually described.

**Implementation:**

- If manager connected, auto-populate squad context
- Add toggle "Based on your current squad"

#### 3. Improve Deadline Urgency Visualization

**Why:** Green countdown doesn't escalate as deadline approaches.

**Implementation:**

- Yellow when under 24 hours
- Red with pulse animation when under 6 hours
- Add "Get deadline reminders" CTA near countdown

#### 4. Create Page-Specific Loading Skeletons

**Why:** Every page uses DashboardSkeleton even when layout differs.

**Create:**

- `PitchSkeleton` for My Team page
- `FixtureGridSkeleton` for Fixtures page
- `LeagueStandingsSkeleton` for Leagues page

### Medium Priority

#### 5. Add Onboarding Banner for New Users

**Why:** "Connect" button is small and muted; new users may not understand benefit.

**Implementation:**

- Show banner on dashboard for users without manager ID
- Explain benefits: "Connect your FPL account to unlock personalized insights"
- Dismissible with localStorage

#### 6. Add Player Comparison Feature

**Why:** Players are shown in tables but can't compare side-by-side.

**Implementation:**

- Checkbox selection on player rows
- "Compare (2)" button opens modal
- Side-by-side stats with visual diff

#### 7. Show DGW/BGW Indicators in Fixture Grid

**Why:** DGWs are crucial for FPL strategy but not visually distinct.

**Implementation:**

- "2×" badge for DGW fixtures
- Striped/hatched pattern for BGW
- Legend in grid header

#### 8. Add Contextual Error Messages

**Why:** "Something went wrong" doesn't help users.

**Implementation:**

- API timeout: "FPL servers are slow. Try again in a moment."
- 404: "This manager/league doesn't exist."
- Network error: "Check your internet connection."

### Lower Priority

#### 9. Add Gesture Support for Mobile Sidebar

**Why:** Swipe to close isn't implemented.

**Implementation:** Use `@use-gesture/react` for swipe-to-close

#### 10. Add "Add to Calendar" for Deadline

**Why:** Users can't add deadline to calendar.

**Implementation:** Generate .ics file download

---

## Technical Debt

### Architecture

#### 1. Extract League Analyzer Logic to Custom Hook

**File:** `app/leagues/analyze/page.tsx` (291 lines, 15+ hooks)

```typescript
// Create: lib/fpl/hooks/use-league-analysis.ts
export function useLeagueAnalysis(leagueId: number, managerId: number) {
  // Move all analysis logic here
}
```

#### 2. Create Barrel Exports for All Lib Modules

**Missing:**

- `lib/claude/index.ts`
- `lib/notifications/index.ts`
- `lib/utils/index.ts`

#### 3. Standardize Null/Undefined Handling

**Issue:** Mixed patterns across codebase.

**Recommendation:** Use `null` for "no value" in API responses, `undefined` for optional parameters.

### Code Quality

#### 4. Extract Magic Numbers to Named Constants

**Files:**

- `lib/fpl/transfer-model.ts` - model weights
- `lib/fpl/captain-model.ts` - scoring weights
- `lib/claude/client.ts` - token budgets

```typescript
// Example
const TRANSFER_WEIGHTS = {
  FORM: 0.3,
  FIXTURE: 0.25,
  VALUE: 0.25,
  XGI: 0.2,
} as const;
```

#### 5. Add Type Guards for Runtime Validation

**Files with type assertions:**

- `lib/fpl/league-analyzer.ts:438` - `elementType as 1 | 2 | 3 | 4`
- `lib/claude/client.ts:186-188` - unsafe JSON parsing

**Recommendation:** Use Zod for runtime validation of external data.

---

## Documentation Gaps

### Priority 1: Update Existing Docs

- [ ] Add missing env vars to README.md environment table
- [ ] Update CLAUDE.md with scheduled functions (done)
- [ ] Add troubleshooting section to README.md

### Priority 2: Create New Docs

- [ ] Create `docs/API.md` with all API routes, params, responses
- [ ] Create `CONTRIBUTING.md` with PR process, code style, testing
- [ ] Create `CHANGELOG.md` using Keep a Changelog format

### Priority 3: Code Documentation

- [ ] Add JSDoc to key interfaces in `lib/fpl/types.ts`
- [ ] Add `@example` tags to utility functions
- [ ] Document units (e.g., `now_cost` is in tenths: 100 = £10.0m)

---

## Testing Coverage

### Current State

- 159+ unit tests for models and utilities
- Good coverage of `lib/fpl/` modules
- Zero tests for API routes
- Zero tests for React components

### Priority 1: API Route Tests

```typescript
// Example: app/api/fpl/bootstrap-static/route.test.ts
import { GET } from "./route";
import { NextRequest } from "next/server";

describe("/api/fpl/bootstrap-static", () => {
  it("returns bootstrap data", async () => {
    const req = new NextRequest("http://localhost/api/fpl/bootstrap-static");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
```

### Priority 2: Component Tests

```typescript
// Example: components/captain/captain-card.test.tsx
import { render, screen } from "@testing-library/react";
import { CaptainCard } from "./captain-card";

describe("CaptainCard", () => {
  it("displays player name and score", () => {
    render(<CaptainCard player={mockPlayer} rank={1} />);
    expect(screen.getByText("Haaland")).toBeInTheDocument();
  });
});
```

### Priority 3: Integration Tests

- Test data flow from hooks to components
- Test manager context provider with Supabase mock
- Test notification subscription flow

### Priority 4: E2E Tests

Consider adding Playwright for critical user flows:

- Connect manager ID
- View team and navigate gameweeks
- Analyze mini-league

---

## Implementation Roadmap

### Sprint 1 (Week 1-2): Security & Performance

- [ ] Add rate limiting to API routes
- [ ] Implement Zod validation
- [ ] Add TanStack Query for request deduplication
- [ ] Add list virtualization to large tables

### Sprint 2 (Week 3-4): Quick Win Features

- [ ] Expected Points Leaderboard
- [ ] Ownership Momentum Tracker
- [ ] Bench Boost Analyzer

### Sprint 3 (Week 5-6): AI Features

- [ ] GW Decision Simulator
- [ ] Rival Gameplan Analyzer
- [ ] Injury Return Predictor

### Sprint 4 (Week 7-8): UX Polish

- [ ] Mobile nav improvements
- [ ] Page-specific skeletons
- [ ] Onboarding flow
- [ ] Player comparison

### Sprint 5 (Week 9-10): Testing & Docs

- [ ] API route tests
- [ ] Component tests
- [ ] API documentation
- [ ] CONTRIBUTING.md

### Sprint 6 (Week 11-12): New Formats

- [ ] H2H Mode support
- [ ] Historical season data
- [ ] Team underlying stats

---

## Competitive Positioning

### What FPL Insights Does Better

| Feature                    | FPL Insights | LiveFPL | FPL Review | Scout |
| -------------------------- | ------------ | ------- | ---------- | ----- |
| AI-Powered Recommendations | ✓            | ✗       | ✗          | ✗     |
| Real-Time News Search      | ✓            | ✗       | Partial    | ✓     |
| Push Notifications         | ✓            | ✗       | ✗          | ✓     |
| PWA/Offline Support        | ✓            | ✗       | ✗          | ✗     |
| MCP Server for Claude Code | ✓            | ✗       | ✗          | ✗     |

### Gaps to Close

| Feature                   | Status  | Priority |
| ------------------------- | ------- | -------- |
| Expected Points interface | Missing | HIGH     |
| Historical season data    | Missing | MEDIUM   |
| H2H mode support          | Missing | MEDIUM   |
| StatsBomb-level data      | Missing | LOW      |

---

## Monetization Opportunities (Future)

If considering freemium model:

**Free Tier:**

- Dashboard, Fixtures, Live Tracker
- Basic Transfer Hub
- No AI features

**Pro Tier ($3-5/month):**

- AI Optimizer (extended thinking)
- Full League Analyzer
- Historical data
- Expected points

**Premium Tier ($8-10/month):**

- All Pro features
- Real-time price alerts
- Injury return ML model
- Email summaries

---

_Last updated: January 2026_
