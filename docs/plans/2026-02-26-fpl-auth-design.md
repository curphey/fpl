# FPL Authentication & Transfer Submission — Design

**Date:** 2026-02-26
**Status:** Approved

## Overview

Add FPL account login to the app. Authenticated API calls unlock exact selling prices, real free transfer counts, and transfer history — improving GW plan accuracy. Once authenticated, users can submit the AI-recommended transfers directly to FPL from the GW Plan widget without leaving the app.

---

## Authentication Approach

Direct HTTP login (Approach A): the server POSTs to `users.premierleague.com/accounts/login/` with browser-like headers and proper CSRF token handling. Cloudflare protection on FPL is calibrated for mass scraping, not single-user logins — this approach is used successfully by most FPL community tooling. If Cloudflare blocks the attempt, the error message tells the user and suggests reconnecting manually.

**Login flow:**

1. GET `https://users.premierleague.com/accounts/login/` → extract CSRF token from response cookies
2. POST `email`, `password`, CSRF token with Chrome User-Agent, `Referer: https://fantasy.premierleague.com/`, `Origin: https://fantasy.premierleague.com`
3. Follow redirect → store returned `pl_profile` + `csrftoken` cookies

---

## Credential & Session Storage

Reuses the existing `app_settings` SQLite table (key-value store):

| Key                      | Value                     |
| ------------------------ | ------------------------- |
| `fpl_email`              | plaintext                 |
| `fpl_password_encrypted` | AES-256-GCM encrypted     |
| `fpl_session_cookie`     | `pl_profile` cookie value |
| `fpl_session_expires`    | ISO timestamp             |

**Encryption key:** from env var `FPL_CREDENTIALS_KEY`. Falls back to SHA-256 of `DATABASE_PATH` for zero-config installs. Implemented in `lib/fpl/auth-crypto.ts`.

**Auto-reconnect:** when any authenticated API call receives a 401/403, the app decrypts the stored credentials, re-runs the login flow, updates the stored cookie, and retries the original request once.

---

## What Auth Unlocks

| Data                     | Without auth              | With auth                                |
| ------------------------ | ------------------------- | ---------------------------------------- |
| `selling_price` per pick | estimated from `now_cost` | exact from FPL                           |
| Free transfers available | hardcoded `1`             | calculated from authenticated entry data |
| Transfers made this GW   | unknown                   | `GET /entry/{id}/transfers/`             |

The GW Plan prompt automatically uses the accurate data — no UI changes needed beyond the login.

---

## New Files

| File                                         | Purpose                                               |
| -------------------------------------------- | ----------------------------------------------------- |
| `lib/fpl/auth-client.ts`                     | Login flow, cookie management, `authenticatedFetch()` |
| `lib/fpl/auth-crypto.ts`                     | AES-256-GCM encrypt/decrypt for stored credentials    |
| `app/api/fpl-auth/login/route.ts`            | POST — authenticate, store encrypted credentials      |
| `app/api/fpl-auth/logout/route.ts`           | DELETE — clear all stored FPL credentials             |
| `app/api/fpl-auth/status/route.ts`           | GET — connection status, manager name, expiry         |
| `app/api/gw-plan/submit/route.ts`            | POST — validate then submit transfers to FPL          |
| `components/settings/fpl-account.tsx`        | Settings UI — login form, connection status           |
| `components/dashboard/submit-plan-modal.tsx` | Confirmation modal for transfer submission            |

## Modified Files

| File                                      | Change                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `lib/db/settings.ts`                      | No schema change needed (uses existing key-value table)                                          |
| `lib/fpl/client.ts`                       | Add `authenticatedFetch()` wrapper; update `getManagerPicks()` to use auth cookie when available |
| `app/api/gw-plan/route.ts`                | Use auth cookie for picks; fetch real free transfer count                                        |
| `components/dashboard/gw-plan-widget.tsx` | Add "Submit to FPL" button + connect modal                                                       |
| `app/settings/page.tsx` (or equivalent)   | Add `<FplAccount />` section above API Keys                                                      |

---

## API Routes

### `POST /api/fpl-auth/login`

```typescript
// Request
{ sessionId: string, email: string, password: string }

// Response 200
{ connected: true, managerName: string, expiresAt: string }

// Response 401
{ error: "Invalid FPL credentials", code: "UNAUTHORIZED" }

// Response 503
{ error: "FPL login blocked by Cloudflare. Try again or reconnect manually.", code: "SERVICE_UNAVAILABLE" }
```

### `GET /api/fpl-auth/status`

```typescript
// Response
{ connected: boolean, managerName: string | null, expiresAt: string | null }
```

### `DELETE /api/fpl-auth/logout`

```typescript
// Request
{
  sessionId: string;
}
// Response 200: { ok: true }
```

### `POST /api/gw-plan/submit`

```typescript
// Request
{ sessionId: string, planId: string, confirm: boolean }

// Response 200 (confirm: false — validation only)
{
  valid: true,
  transfers: [{ elementIn: number, elementOut: number, purchasePrice: number, sellingPrice: number }],
  transferCost: number,   // points hit (0, 4, 8 ...)
  wildcardActive: boolean
}

// Response 200 (confirm: true — submitted)
{ submitted: true, transfersMade: number }

// Error cases
{ error: "Transfer deadline has passed", code: "DEADLINE_PASSED" }
{ error: "Insufficient budget", code: "VALIDATION_ERROR" }
{ error: "FPL session expired", code: "UNAUTHORIZED" }   // triggers auto-reauth
```

---

## GW Plan Widget Changes

**"Submit to FPL" button** — shown only when:

- User is FPL-authenticated (`/api/fpl-auth/status` → `connected: true`)
- Plan has at least one transfer or a captain recommendation
- Current time is before the GW deadline

**Confirmation modal (`<SubmitPlanModal>`):**

```
Confirm transfers

  OUT  Mukiele  →  IN  Alexander-Arnold
  Captain: Salah (C)

  Free transfers used: 1 of 1
  Hit cost: 0 pts

  ⚠ This will change your FPL team. It cannot be undone.

  [Cancel]    [Confirm & Submit ▶]
```

Flow:

1. Click "Submit to FPL" → modal opens → calls `POST /api/gw-plan/submit` with `confirm: false`
2. Modal shows validated transfer details returned by FPL
3. User clicks "Confirm & Submit" → calls with `confirm: true`
4. Success: modal shows "Transfers submitted ✓", button changes to "Submitted"
5. Error: modal shows FPL's error message verbatim

---

## Settings UI

New "FPL Account" section in Settings, above "API Keys":

```
▸ FPL Account
  ✓ Connected as Tim Smith
  Session expires: Apr 2026
  [Disconnect]

  — or, when disconnected —

  Email     [_____________]
  Password  [_____________]
  [Connect to FPL ▶]
```

---

## Free Transfer Count Calculation

The authenticated `GET /entry/{id}/` returns `summary_event_transfers` (transfers made this GW) and `summary_event_transfers_cost` (points hit). Free transfers available = derived from picks `entry_history.bank` combined with the event data. Concretely:

- `transfers_this_gw` = `entry_history.event_transfers`
- `transfers_cost_this_gw` = `entry_history.event_transfers_cost`
- `free_transfers_used` = transfers with no cost (`cost == 0`)
- `free_transfers_available` = max(1, 2 − free_transfers_used_last_gw) — calculated from manager history

For the GW plan prompt, if the exact count is uncertain, default to `1` with a note.

---

## Security Notes

- Passwords stored AES-256-GCM encrypted; never logged or returned by any API
- `FPL_CREDENTIALS_KEY` must be set in `.env` for production; documented in `.env.example`
- Rate-limit `/api/fpl-auth/login` tightly (3 attempts / 15 min) to prevent credential stuffing
- All `/api/fpl-auth/*` routes require a valid `sessionId`

---

## Testing Strategy

- Unit tests for `auth-crypto.ts` (encrypt/decrypt round-trip)
- Unit tests for `auth-client.ts` (login flow with mocked `fetch`, CSRF extraction, cookie storage)
- Unit tests for `gw-plan/submit/route.ts` (validation-only path, submission path, error cases)
- Component tests for `<FplAccount>` (connected state, disconnected state, loading, error)
- Component tests for `<SubmitPlanModal>` (validation step, confirm step, error display)
