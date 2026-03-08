# Chip Plan Score Comparison

## Problem

The chip plan widget shows a "Predicted Team Score" (e.g. 212) which for wildcard is a 4-gameweek sum. Without knowing what the current squad would score over the same period, users can't tell if the chip plan is actually an improvement or by how much.

## Design

### Backend (`app/api/gw-plan/chip-plan/route.ts`)

- After fetching current squad picks and building prediction maps, sum the current squad's predicted points across the same gameweeks used for the chip squad (4 GWs for wildcard, 1 GW for free hit)
- Return as `currentSquadPredictedPoints` on the response

### Types (`lib/db/gw-plan.ts`)

- Add optional `currentSquadPredictedPoints?: number` to `GwPlanResult`

### Frontend (`components/dashboard/gw-plan-widget.tsx`)

- When `chipType` is set and `currentSquadPredictedPoints` exists, replace single score with comparison:
  - "Current squad: X" (muted)
  - "Wildcard/Free Hit squad: Y" (green)
  - "Improvement: +Z pts" (green if positive, red if negative)
- Add "(over 4 gameweeks)" label for wildcard, "(this gameweek)" for free hit

### Non-chip plans

No changes. Single GW score is already intuitive for regular transfer plans.
