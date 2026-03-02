# GW Plan Dashboard Widget — Design

**Date:** 2026-02-25
**Status:** Approved

## Overview

A "GW Plan" card on the dashboard that generates an AI-powered gameweek plan on demand. Claude analyses the user's squad, recommends transfers with a 4-GW points gain forecast and reasoning, suggests a captain, and predicts the team's total score for the upcoming GW. Transfer recommendations are persisted in SQLite and tracked week-by-week against actuals, with Claude explaining any significant underperformance.

---

## Widget Layout

```
┌──────────────────────────────────────────────────┐
│ GW Plan — Gameweek 28              [Regenerate ↺] │
├──────────────────────────────────────────────────┤
│ Predicted team score:  62 pts                    │
│ Captain: Salah (C) — Easy run vs Palace, Brighton │
├──────────────────────────────────────────────────┤
│ TRANSFERS  (2 free)                              │
│  OUT Saka → IN Salah   +8.2 pts over 4 GWs       │
│  "Salah has Palace, Brighton, Ipswich, Wolves —  │
│   best fixture run of any premium this month"    │
├──────────────────────────────────────────────────┤
│ TRANSFER TRACKER                                 │
│  GW25 Haaland IN — predicted +12, actual +9      │
│  ⚠ Off track: suspended GW26, back on track GW27 │
└──────────────────────────────────────────────────┘
```

- First visit each GW: shows a "Generate GW Plan" button (no auto-load, no API cost on page render)
- After generation: cached in SQLite, subsequent loads are instant
- "Regenerate" button re-calls Claude (e.g. after a squad change or new injury news)
- Transfer Tracker section only appears once at least one transfer prediction exists

---

## Data Architecture

### New SQLite tables (added to `lib/db/client.ts`)

**`gw_plans`** — one cached plan per session per GW:

```sql
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
```

**`transfer_predictions`** — one row per tracked transfer recommendation:

```sql
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
  gw_actuals TEXT,        -- JSON: { "28": 4, "29": 6, ... }
  status TEXT DEFAULT 'pending',  -- pending | on_track | hit | miss
  reasoning TEXT,
  tracking_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_transfer_predictions_session ON transfer_predictions(session_id, gameweek_made DESC);
```

---

## Claude Integration

### What Claude receives (`POST /api/gw-plan`)

- Current 15-player squad with per-player: predicted next-GW points, 4-GW predicted points, form, fixture difficulty ratings
- Free transfers available + bank balance
- Top 20 transfer targets from the existing `scoreTransferTargets()` model
- Captain options ranked by the existing `scoreCaptainOptions()` model
- Current gameweek number

### What Claude returns (structured JSON)

```json
{
  "predictedTeamPoints": 62,
  "captain": {
    "playerId": 328,
    "name": "Salah",
    "reasoning": "Palace, Brighton, Ipswich run — best fixtures of any premium"
  },
  "transfers": [
    {
      "playerOut": { "id": 123, "name": "Saka", "predicted4GW": 18 },
      "playerIn": { "id": 456, "name": "Salah", "predicted4GW": 26 },
      "pointsGain": 8.2,
      "reasoning": "Salah has the best fixture run of any premium over the next 4 GWs..."
    }
  ],
  "notes": "No chip recommended this GW. Hold Wildcard for DGW32."
}
```

Uses Claude with extended thinking (existing `CLAUDE_CONFIG.MODEL`, `budget_tokens: 8000`, `max_tokens: 12000`).

---

## API Route

**`GET /api/gw-plan?sessionId=&gw=`** — fetch cached plan (returns 404 if not generated yet)
**`POST /api/gw-plan`** — generate new plan, save to SQLite, return result
Body: `{ sessionId, gameweek, squad, freeTransfers, bank }`

---

## Code Structure

### New files

| File                                        | Purpose                                                          |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `app/api/gw-plan/route.ts`                  | GET (fetch cache) + POST (generate) endpoint                     |
| `lib/db/gw-plan.ts`                         | SQLite repo: save/load plans, insert/update transfer predictions |
| `lib/claude/gw-plan-client.ts`              | Claude prompt builder + response parser                          |
| `components/dashboard/gw-plan-widget.tsx`   | Widget: state, loading, generate button, renders plan            |
| `components/dashboard/transfer-tracker.tsx` | Tracker table: past transfers vs actuals                         |
| `lib/scheduler/gw-plan-tracker.ts`          | Tuesday job: fetch actuals, update DB, call Claude if off-track  |

### Modified files

| File                     | Change                                                      |
| ------------------------ | ----------------------------------------------------------- |
| `lib/db/client.ts`       | Add `gw_plans` and `transfer_predictions` table definitions |
| `app/page.tsx`           | Add `<GwPlanWidget>` to dashboard                           |
| `lib/scheduler/index.ts` | Register `gw-plan-tracker` Tuesday 7am UTC job              |

---

## Weekly Tracking Scheduler

Runs **Tuesday 7:00 UTC** (after FPL finalises the previous GW's scores).

1. Fetch all `transfer_predictions` with `status = 'pending' OR status = 'on_track'`
2. For each, fetch actual points for `player_in_id` from FPL API
3. Update `gw_actuals` JSON + recalculate `actual_gain_pts`
4. If we're ≥ GW 2 of the 4-GW window and actual is >20% below predicted → call Claude to explain, store in `tracking_notes`, set `status = 'miss'`
5. If 4 GWs complete: set final `status` to `hit` or `miss`

---

## Testing Strategy

All new code written test-first (TDD):

- Unit tests for `lib/db/gw-plan.ts` repository functions
- Unit tests for `lib/claude/gw-plan-client.ts` prompt building and JSON parsing
- Unit tests for tracking status calculation logic
- Component tests for `<GwPlanWidget>` (loading, empty, populated states)
- Component tests for `<TransferTracker>` (pending, on_track, hit, miss states)
