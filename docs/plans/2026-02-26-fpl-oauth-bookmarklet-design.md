# FPL OAuth Bookmarklet Auth Design

**Date:** 2026-02-26

## Problem

FPL permanently deprecated `users.premierleague.com/accounts/login/` (credential POST)
in favour of PingOne OAuth at `account.premierleague.com/as`. The old email/password
form always fails now. We need a new auth mechanism.

## Investigation Findings

- FPL PingOne client ID: `bfcbaf69-aade-4c1b-8f00-c1cb8a193030`
- Issuer: `https://account.premierleague.com/as`
- Supported grants for this client: `authorization_code` (PKCE), `refresh_token`
- **ROPC (`password`) grant: disabled** — `unsupported_grant_type`
- **Device Code grant: disabled** — `unauthorized_client`
- `redirect_uri` registered to `https://fantasy.premierleague.com/a/login` — we cannot
  intercept PKCE redirects from our own domain
- `Authorization: Bearer <access_token>` **works** against FPL API (`/api/me/` confirmed)
- `refresh_token` grant **works** — confirmed `invalid_grant` (not `unsupported_grant_type`)
  with a dummy token, meaning the grant type itself is accepted

## Chosen Approach: Bookmarklet + Refresh Token

The bookmarklet runs JavaScript **in the context of `fantasy.premierleague.com`**
(same-origin), reads `access_token` and `refresh_token` from FPL's localStorage, and
POSTs them to our server. After the one-time setup, the server silently auto-renews the
access_token using the stored refresh_token. The user only needs to repeat if the
refresh_token expires (~30–90 days).

## Architecture

### Data Layer (`lib/fpl/auth-client.ts`)

Replace cookie-based auth with Bearer + refresh_token:

| Old setting key          | New setting key                  |
| ------------------------ | -------------------------------- |
| `fpl_session_cookie`     | `fpl_access_token`               |
| `fpl_session_expires`    | `fpl_access_token_expires`       |
| `fpl_email_encrypted`    | `fpl_refresh_token_encrypted`    |
| `fpl_password_encrypted` | _(removed)_                      |
| `fpl_manager_name`       | `fpl_manager_name` _(unchanged)_ |
| _(new)_                  | `fpl_entry_id`                   |

New public API surface:

```typescript
// One-time connect: validate tokens via /api/me/, store refresh_token encrypted
export async function connectFplTokens(
  accessToken: string,
  refreshToken: string,
): Promise<{ managerName: string; entryId: number; expiresAt: string }>;

// True if we have a stored refresh_token (connected even if access_token expired)
export function isFplConnected(): boolean;

// Status info for UI — null if not connected
export function getFplSession(): {
  managerName: string;
  entryId: number;
  expiresAt: string;
} | null;

// Auto-refreshes access_token if expired; throws FPL_UNAUTHORIZED if no refresh_token
export async function authenticatedFetch(
  url: string,
  options?: RequestInit,
): Promise<Response>;

// Clear all stored tokens
export function clearFplCredentials(): void;
```

Internal `getValidAccessToken()`:

1. If `fpl_access_token_expires` > 5 min from now → return stored token
2. Else: POST `grant_type=refresh_token` to PingOne with decrypted refresh_token
3. Store new `access_token` + rotated `refresh_token`, return new token

### New API Endpoint: `POST /api/fpl-auth/connect`

Accepts tokens from the bookmarklet (cross-origin from `fantasy.premierleague.com`).

```
Body: { access_token: string, refresh_token: string }
Response: { ok: true, managerName: string, entryId: number, expiresAt: string }
```

CORS headers required:

```
Access-Control-Allow-Origin: https://fantasy.premierleague.com
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

OPTIONS preflight handler needed (returns 200).

### Retire: `POST /api/fpl-auth/login`

Delete `app/api/fpl-auth/login/route.ts` and its tests — replaced by `/connect`.

### The Bookmarklet

Rendered dynamically by the settings page with the app origin embedded:

```javascript
javascript: (function () {
  var at = localStorage.getItem("access_token");
  var rt = localStorage.getItem("refresh_token");
  if (!at || !rt) {
    alert("Please log in to FPL first, then click this bookmarklet.");
    return;
  }
  fetch("__APP_ORIGIN__/api/fpl-auth/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: at, refresh_token: rt }),
  })
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      if (d.ok) alert("Connected! Welcome, " + d.managerName + ".");
      else alert("Error: " + (d.error || "Unknown error"));
    })
    .catch(function () {
      alert("Could not reach FPL Insights. Is the app running?");
    });
})();
```

`__APP_ORIGIN__` is replaced server-side by `process.env.NEXT_PUBLIC_APP_URL` or
`window.location.origin` (rendered client-side in the component).

### Settings UI (`components/settings/fpl-account.tsx`)

**Disconnected state** — replaces email/password form:

- Step 1: Drag the bookmarklet `<a>` to bookmarks bar
- Step 2: Open `fantasy.premierleague.com` (log in if prompted)
- Step 3: Click the bookmarklet
- `window.addEventListener('focus', refetchStatus)` so returning to the tab
  after clicking the bookmarklet triggers a status refresh

**Connected state** — same as today, expiry label shows "refreshes automatically".

## Testing Plan

- `lib/fpl/__tests__/auth-client.test.ts` — full rewrite for new functions:
  - `connectFplTokens`: validates via /me/, stores tokens, parses JWT exp
  - `getValidAccessToken` (internal, tested via `authenticatedFetch`): uses stored token if fresh, refreshes if expired, throws if no refresh_token
  - `authenticatedFetch`: attaches Bearer header, refreshes on 401
  - `isFplConnected` / `getFplSession` / `clearFplCredentials`
- `app/api/fpl-auth/connect/__tests__/route.test.ts` — new tests:
  - CORS preflight (OPTIONS → 200)
  - Missing/invalid body → 400
  - Invalid access_token (FPL /me/ fails) → 401
  - Valid tokens → 200 + stores credentials
- `app/api/fpl-auth/login/` — delete entirely
- `app/api/fpl-auth/status/__tests__/route.test.ts` — update: connected = has refresh_token
- `components/settings/__tests__/fpl-account.test.tsx` — update for new bookmarklet UI
