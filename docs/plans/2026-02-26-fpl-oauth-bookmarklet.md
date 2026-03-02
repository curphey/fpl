# FPL OAuth Bookmarklet Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken email/password FPL login (deprecated by Premier League) with a bookmarklet that extracts Bearer tokens from FPL's localStorage and stores a refresh_token for silent auto-renewal.

**Architecture:** The bookmarklet runs JavaScript in the context of `fantasy.premierleague.com` (same-origin), reads `access_token` and `refresh_token` from FPL's localStorage, and POSTs them to a new `/api/fpl-auth/connect` endpoint. The server stores the encrypted `refresh_token` and auto-renews the `access_token` (via PingOne `refresh_token` grant) whenever it expires. The email/password form in Settings is replaced with bookmarklet instructions.

**Tech Stack:** Next.js App Router, TypeScript 5, Vitest, Zod, Node.js `crypto` (AES-256-GCM via existing `auth-crypto.ts`), PingOne OAuth (existing `account.premierleague.com/as/token`)

**Design doc:** `docs/plans/2026-02-26-fpl-oauth-bookmarklet-design.md`

---

## Context: What changed

FPL permanently deprecated `users.premierleague.com/accounts/login/` — it now returns 302 to a holding page for everyone. FPL uses PingOne OAuth (`account.premierleague.com/as`). ROPC grant is disabled (`unsupported_grant_type`). Device Code grant is disabled (`unauthorized_client`). Only `authorization_code` (PKCE, redirect locked to `fantasy.premierleague.com`) and `refresh_token` grants work.

The `refresh_token` grant is confirmed working: a real refresh_token will return a new `access_token`. `Authorization: Bearer <token>` works against FPL API (`/api/me/` confirmed).

## Key files

- `lib/fpl/auth-client.ts` — core auth library (full rewrite)
- `lib/fpl/__tests__/auth-client.test.ts` — auth tests (full rewrite)
- `lib/fpl/auth-crypto.ts` — AES-256-GCM encrypt/decrypt (DO NOT TOUCH)
- `lib/db/settings.ts` — `getSetting(key)` / `setSetting(key, value)` — stores key/value in SQLite
- `app/api/fpl-auth/connect/` — NEW endpoint (replaces login)
- `app/api/fpl-auth/login/` — DELETE entire directory
- `app/api/fpl-auth/status/route.ts` — minor update
- `app/api/gw-plan/submit/route.ts` — remove CSRF cookie extraction
- `components/settings/fpl-account.tsx` — replace form with bookmarklet UI

## PingOne constants (DO NOT CHANGE)

```typescript
const PINGONE_TOKEN_URL = "https://account.premierleague.com/as/token";
const FPL_CLIENT_ID = "bfcbaf69-aade-4c1b-8f00-c1cb8a193030";
```

## New settings keys

| Key                           | Value                                     |
| ----------------------------- | ----------------------------------------- |
| `fpl_access_token`            | Raw Bearer token string                   |
| `fpl_access_token_expires`    | ISO timestamp of access_token expiry      |
| `fpl_refresh_token_encrypted` | AES-256-GCM encrypted refresh_token       |
| `fpl_manager_name`            | Manager display name (unchanged key)      |
| `fpl_entry_id`                | FPL entry ID as string (e.g. `"4343974"`) |

Old keys to remove: `fpl_session_cookie`, `fpl_session_expires`, `fpl_email_encrypted`, `fpl_password_encrypted`

---

## Task 1: Rewrite lib/fpl/auth-client.ts

**Files:**

- Modify: `lib/fpl/__tests__/auth-client.test.ts` (full rewrite)
- Modify: `lib/fpl/auth-client.ts` (full rewrite)

### Step 1: Replace the test file with this content

```typescript
// lib/fpl/__tests__/auth-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/settings", () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}));

vi.mock("../auth-crypto", () => ({
  encrypt: vi.fn((s: string) => `enc:${s}`),
  decrypt: vi.fn((s: string) => s.replace("enc:", "")),
}));

import { getSetting, setSetting } from "@/lib/db/settings";
import {
  connectFplTokens,
  isFplConnected,
  getFplSession,
  clearFplCredentials,
  authenticatedFetch,
} from "../auth-client";

const mockGetSetting = vi.mocked(getSetting);
const mockSetSetting = vi.mocked(setSetting);

// Build a JWT-shaped string with a given exp timestamp
function b64url(s: string): string {
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function makeJwt(payload: object): string {
  return `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify(payload))}.sig`;
}
const FUTURE_JWT = makeJwt({
  sub: "test",
  exp: Math.floor(Date.now() / 1000) + 7200,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

// ---------------------------------------------------------------------------
// connectFplTokens
// ---------------------------------------------------------------------------
describe("connectFplTokens", () => {
  it("throws FPL_INVALID_TOKEN when /api/me/ returns non-ok", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 401 }));
    await expect(connectFplTokens(FUTURE_JWT, "rt")).rejects.toThrow(
      "FPL_INVALID_TOKEN",
    );
  });

  it("stores tokens and returns manager info on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          player: { first_name: "Tim", last_name: "Smith" },
          id: 4343974,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const result = await connectFplTokens(FUTURE_JWT, "rt");
    expect(result.managerName).toBe("Tim Smith");
    expect(result.entryId).toBe(4343974);
    expect(mockSetSetting).toHaveBeenCalledWith("fpl_access_token", FUTURE_JWT);
    expect(mockSetSetting).toHaveBeenCalledWith(
      "fpl_refresh_token_encrypted",
      "enc:rt",
    );
    expect(mockSetSetting).toHaveBeenCalledWith(
      "fpl_manager_name",
      "Tim Smith",
    );
    expect(mockSetSetting).toHaveBeenCalledWith("fpl_entry_id", "4343974");
  });

  it("defaults managerName to 'FPL Manager' when player absent", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 99 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await connectFplTokens(FUTURE_JWT, "rt");
    expect(result.managerName).toBe("FPL Manager");
    expect(result.entryId).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// isFplConnected
// ---------------------------------------------------------------------------
describe("isFplConnected", () => {
  it("returns false when no refresh token stored", () => {
    mockGetSetting.mockReturnValue(null);
    expect(isFplConnected()).toBe(false);
  });

  it("returns true when refresh token stored", () => {
    mockGetSetting.mockReturnValue("enc:something");
    expect(isFplConnected()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getFplSession
// ---------------------------------------------------------------------------
describe("getFplSession", () => {
  it("returns null when not connected", () => {
    mockGetSetting.mockReturnValue(null);
    expect(getFplSession()).toBeNull();
  });

  it("returns session info when connected", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "fpl_refresh_token_encrypted") return "enc:tok";
      if (key === "fpl_manager_name") return "Tim Smith";
      if (key === "fpl_entry_id") return "4343974";
      if (key === "fpl_access_token_expires") return future;
      return null;
    });
    const session = getFplSession();
    expect(session).not.toBeNull();
    expect(session?.managerName).toBe("Tim Smith");
    expect(session?.entryId).toBe(4343974);
    expect(session?.expiresAt).toBe(future);
  });
});

// ---------------------------------------------------------------------------
// clearFplCredentials
// ---------------------------------------------------------------------------
describe("clearFplCredentials", () => {
  it("clears all five credential keys", () => {
    clearFplCredentials();
    expect(mockSetSetting).toHaveBeenCalledWith("fpl_access_token", null);
    expect(mockSetSetting).toHaveBeenCalledWith(
      "fpl_access_token_expires",
      null,
    );
    expect(mockSetSetting).toHaveBeenCalledWith(
      "fpl_refresh_token_encrypted",
      null,
    );
    expect(mockSetSetting).toHaveBeenCalledWith("fpl_manager_name", null);
    expect(mockSetSetting).toHaveBeenCalledWith("fpl_entry_id", null);
  });
});

// ---------------------------------------------------------------------------
// authenticatedFetch
// ---------------------------------------------------------------------------
describe("authenticatedFetch", () => {
  it("throws FPL_UNAUTHORIZED when no refresh token and no fresh access token", async () => {
    mockGetSetting.mockReturnValue(null);
    await expect(authenticatedFetch("https://example.com")).rejects.toThrow(
      "FPL_UNAUTHORIZED",
    );
  });

  it("attaches Authorization: Bearer header using stored token", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "fpl_access_token") return "stored_token";
      if (key === "fpl_access_token_expires") return future;
      return null;
    });
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await authenticatedFetch("https://example.com/api/");
    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/api/",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer stored_token",
        }),
      }),
    );
  });

  it("refreshes token when access_token is expired", async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "fpl_access_token") return "old_token";
      if (key === "fpl_access_token_expires") return past;
      if (key === "fpl_refresh_token_encrypted") return "enc:refresh_tok";
      return null;
    });
    const newJwt = makeJwt({
      sub: "x",
      exp: Math.floor(Date.now() / 1000) + 7200,
    });
    vi.mocked(fetch)
      // PingOne refresh call
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: newJwt, expires_in: 7200 }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      // Actual API call
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await authenticatedFetch("https://example.com/api/");
    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/api/",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${newJwt}`,
        }),
      }),
    );
  });

  it("retries with a fresh token after a 401 response", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "fpl_access_token") return "stale_token";
      if (key === "fpl_access_token_expires") return future;
      if (key === "fpl_refresh_token_encrypted") return "enc:refresh_tok";
      return null;
    });
    const freshJwt = makeJwt({
      sub: "x",
      exp: Math.floor(Date.now() / 1000) + 7200,
    });
    vi.mocked(fetch)
      // First call → 401
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      // PingOne refresh
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: freshJwt, expires_in: 7200 }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      // Retry → 200
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

    const resp = await authenticatedFetch("https://example.com/api/");
    expect(resp.status).toBe(200);
  });

  it("throws FPL_SESSION_EXPIRED when refresh fails on 401", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "fpl_access_token") return "stale_token";
      if (key === "fpl_access_token_expires") return future;
      if (key === "fpl_refresh_token_encrypted") return "enc:refresh_tok";
      return null;
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 400 })); // PingOne fails
    await expect(
      authenticatedFetch("https://example.com/api/"),
    ).rejects.toThrow("FPL_SESSION_EXPIRED");
  });
});
```

### Step 2: Run test to confirm it fails

```bash
npx vitest run lib/fpl/__tests__/auth-client.test.ts
```

Expected: multiple failures — `connectFplTokens` not exported, etc.

### Step 3: Replace auth-client.ts with this implementation

```typescript
// lib/fpl/auth-client.ts
import { getSetting, setSetting } from "@/lib/db/settings";
import { encrypt, decrypt } from "./auth-crypto";

const FPL_API_BASE = "https://fantasy.premierleague.com/api";
const PINGONE_TOKEN_URL = "https://account.premierleague.com/as/token";
const FPL_CLIENT_ID = "bfcbaf69-aade-4c1b-8f00-c1cb8a193030";

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: "https://fantasy.premierleague.com/",
  Origin: "https://fantasy.premierleague.com",
};

/** Parse the `exp` claim from a JWT payload without verifying the signature. */
function parseJwtExpiry(jwt: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"),
    ) as { exp?: number };
    if (typeof payload.exp === "number") {
      return new Date(payload.exp * 1000).toISOString();
    }
  } catch {
    // ignore malformed tokens
  }
  return null;
}

/** POST to PingOne with the stored refresh_token; stores and returns new access_token. */
async function performTokenRefresh(): Promise<string> {
  const encryptedRefreshToken = getSetting("fpl_refresh_token_encrypted");
  if (!encryptedRefreshToken) throw new Error("FPL_UNAUTHORIZED");

  let refreshToken: string;
  try {
    refreshToken = decrypt(encryptedRefreshToken);
  } catch {
    throw new Error("FPL_UNAUTHORIZED");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: FPL_CLIENT_ID,
    refresh_token: refreshToken,
  });

  const resp = await fetch(PINGONE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) throw new Error("FPL_SESSION_EXPIRED");

  const data = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const newExpiresAt =
    parseJwtExpiry(data.access_token) ??
    new Date(Date.now() + (data.expires_in ?? 7200) * 1000).toISOString();

  setSetting("fpl_access_token", data.access_token);
  setSetting("fpl_access_token_expires", newExpiresAt);
  if (data.refresh_token) {
    setSetting("fpl_refresh_token_encrypted", encrypt(data.refresh_token));
  }
  return data.access_token;
}

/** Returns a valid access_token, refreshing if needed. */
async function getValidAccessToken(): Promise<string> {
  const token = getSetting("fpl_access_token");
  const expires = getSetting("fpl_access_token_expires");

  // Use stored token if it has more than 5 minutes left
  if (
    token &&
    expires &&
    new Date(expires) > new Date(Date.now() + 5 * 60 * 1000)
  ) {
    return token;
  }

  if (!getSetting("fpl_refresh_token_encrypted")) {
    throw new Error("FPL_UNAUTHORIZED");
  }

  return performTokenRefresh();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate tokens via FPL /api/me/, then store them.
 * Called by the bookmarklet endpoint after receiving tokens from FPL's localStorage.
 */
export async function connectFplTokens(
  accessToken: string,
  refreshToken: string,
): Promise<{ managerName: string; entryId: number; expiresAt: string }> {
  const meResp = await fetch(`${FPL_API_BASE}/me/`, {
    headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${accessToken}` },
  });
  if (!meResp.ok) throw new Error("FPL_INVALID_TOKEN");

  const me = (await meResp.json()) as {
    player?: { first_name: string; last_name: string };
    id?: number;
  };

  const managerName = me.player
    ? `${me.player.first_name} ${me.player.last_name}`.trim()
    : "FPL Manager";
  const entryId = me.id ?? 0;

  const expiresAt =
    parseJwtExpiry(accessToken) ??
    new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  setSetting("fpl_access_token", accessToken);
  setSetting("fpl_access_token_expires", expiresAt);
  setSetting("fpl_refresh_token_encrypted", encrypt(refreshToken));
  setSetting("fpl_manager_name", managerName);
  setSetting("fpl_entry_id", String(entryId));

  return { managerName, entryId, expiresAt };
}

/** True if we have a stored refresh_token (connection persists even if access_token expired). */
export function isFplConnected(): boolean {
  return getSetting("fpl_refresh_token_encrypted") !== null;
}

/** Returns display info for the Settings UI, or null if not connected. */
export function getFplSession(): {
  managerName: string;
  entryId: number;
  expiresAt: string;
} | null {
  if (!getSetting("fpl_refresh_token_encrypted")) return null;
  return {
    managerName: getSetting("fpl_manager_name") ?? "FPL Manager",
    entryId: Number(getSetting("fpl_entry_id") ?? "0"),
    expiresAt:
      getSetting("fpl_access_token_expires") ??
      new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  };
}

/** Clear all stored FPL credentials. */
export function clearFplCredentials(): void {
  for (const key of [
    "fpl_access_token",
    "fpl_access_token_expires",
    "fpl_refresh_token_encrypted",
    "fpl_manager_name",
    "fpl_entry_id",
  ]) {
    setSetting(key, null);
  }
}

/**
 * Fetch a FPL API URL with a valid Bearer token.
 * Auto-refreshes on expiry and retries once on 401.
 * Throws FPL_UNAUTHORIZED if no credentials are stored.
 * Throws FPL_SESSION_EXPIRED if refresh fails.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getValidAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...BROWSER_HEADERS,
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    // Force a refresh and retry once
    const freshToken = await performTokenRefresh();
    return fetch(url, {
      ...options,
      headers: {
        ...BROWSER_HEADERS,
        ...options.headers,
        Authorization: `Bearer ${freshToken}`,
      },
    });
  }

  return response;
}
```

### Step 4: Run tests to confirm they pass

```bash
npx vitest run lib/fpl/__tests__/auth-client.test.ts
```

Expected: all tests pass.

### Step 5: Run full test suite to confirm nothing broken

```bash
npm test
```

Expected: all tests pass. Note: the login route tests will still pass because we haven't deleted them yet.

### Step 6: Commit

```bash
git add lib/fpl/auth-client.ts lib/fpl/__tests__/auth-client.test.ts
git commit -m "feat: replace cookie auth with PingOne Bearer token + refresh_token"
```

---

## Task 2: Create app/api/fpl-auth/connect route

**Files:**

- Create: `app/api/fpl-auth/connect/__tests__/route.test.ts`
- Create: `app/api/fpl-auth/connect/route.ts`

### Step 1: Create the test file

```typescript
// app/api/fpl-auth/connect/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/fpl/auth-client", () => ({
  connectFplTokens: vi.fn(),
}));

import { POST, OPTIONS } from "../route";
import { NextRequest } from "next/server";
import { connectFplTokens } from "@/lib/fpl/auth-client";

const mockConnect = vi.mocked(connectFplTokens);

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/fpl-auth/connect", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Origin: "https://fantasy.premierleague.com",
    },
  });
}

beforeEach(() => vi.clearAllMocks());

describe("OPTIONS /api/fpl-auth/connect", () => {
  it("returns 200 with CORS headers for preflight", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://fantasy.premierleague.com",
    );
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

describe("POST /api/fpl-auth/connect", () => {
  it("returns 400 for missing fields", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty access_token", async () => {
    const res = await POST(
      makeRequest({ access_token: "", refresh_token: "rt" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when connectFplTokens throws FPL_INVALID_TOKEN", async () => {
    mockConnect.mockRejectedValueOnce(new Error("FPL_INVALID_TOKEN"));
    const res = await POST(
      makeRequest({ access_token: "at", refresh_token: "rt" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid FPL token");
  });

  it("returns 200 and CORS header on success", async () => {
    mockConnect.mockResolvedValueOnce({
      managerName: "Tim Smith",
      entryId: 4343974,
      expiresAt: "2026-12-01T00:00:00Z",
    });
    const res = await POST(
      makeRequest({ access_token: "at", refresh_token: "rt" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.managerName).toBe("Tim Smith");
    expect(body.entryId).toBe(4343974);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://fantasy.premierleague.com",
    );
  });

  it("returns 500 when connectFplTokens throws unexpected error", async () => {
    mockConnect.mockRejectedValueOnce(new Error("DB error"));
    const res = await POST(
      makeRequest({ access_token: "at", refresh_token: "rt" }),
    );
    expect(res.status).toBe(500);
  });
});
```

### Step 2: Run test to confirm it fails

```bash
npx vitest run app/api/fpl-auth/connect/__tests__/route.test.ts
```

Expected: FAIL — cannot find module `../route`.

### Step 3: Create the route

First create the directory: `app/api/fpl-auth/connect/`

```typescript
// app/api/fpl-auth/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/errors";
import { connectFplTokens } from "@/lib/fpl/auth-client";

export const runtime = "nodejs";

const CORS_ORIGIN = "https://fantasy.premierleague.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const bodySchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "auth");
  if (rl) return rl;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const res = createValidationErrorResponse(parsed.error);
    Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  const { access_token, refresh_token } = parsed.data;

  try {
    const { managerName, entryId, expiresAt } = await connectFplTokens(
      access_token,
      refresh_token,
    );
    const response = NextResponse.json({
      ok: true,
      managerName,
      entryId,
      expiresAt,
    });
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "FPL_INVALID_TOKEN") {
      const res = createErrorResponse("Invalid FPL token", "UNAUTHORIZED");
      Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const res = createErrorResponse(
      "Failed to connect FPL account",
      "INTERNAL_ERROR",
    );
    Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
}
```

### Step 4: Run tests to confirm they pass

```bash
npx vitest run app/api/fpl-auth/connect/__tests__/route.test.ts
```

Expected: all tests pass.

### Step 5: Commit

```bash
git add app/api/fpl-auth/connect/
git commit -m "feat: add POST /api/fpl-auth/connect endpoint with CORS for bookmarklet"
```

---

## Task 3: Delete app/api/fpl-auth/login route

**Files:**

- Delete: `app/api/fpl-auth/login/route.ts`
- Delete: `app/api/fpl-auth/login/__tests__/route.test.ts`

### Step 1: Delete both files

```bash
rm app/api/fpl-auth/login/route.ts
rm app/api/fpl-auth/login/__tests__/route.test.ts
rmdir app/api/fpl-auth/login/__tests__
rmdir app/api/fpl-auth/login
```

### Step 2: Run full test suite to confirm nothing broken

```bash
npm test
```

Expected: all tests pass.

### Step 3: Commit

```bash
git add -A app/api/fpl-auth/login/
git commit -m "remove: delete deprecated fpl-auth/login route (replaced by /connect)"
```

---

## Task 4: Update app/api/fpl-auth/status route and tests

The status route uses `getFplSession()` which now returns `{ managerName, entryId, expiresAt }` (no `cookie` field). The route logic is the same, but the test mock needs updating to match the new shape.

**Files:**

- Modify: `app/api/fpl-auth/status/__tests__/route.test.ts`
- Modify: `app/api/fpl-auth/status/route.ts`

### Step 1: Update the test — change the mock return value

In `app/api/fpl-auth/status/__tests__/route.test.ts`, find the test "returns connected: true with manager name and expiry" (line 55) and update `getFplSession` mock to use the new shape (no `cookie`):

Old:

```typescript
vi.mocked(getFplSession).mockReturnValue({
  cookie: "pl_profile=X",
  managerName: "Tim Smith",
  expiresAt: "2026-12-01T00:00:00Z",
});
```

New:

```typescript
vi.mocked(getFplSession).mockReturnValue({
  managerName: "Tim Smith",
  entryId: 4343974,
  expiresAt: "2026-12-01T00:00:00Z",
});
```

### Step 2: Run test to confirm it fails (TypeScript type mismatch)

```bash
npx vitest run app/api/fpl-auth/status/__tests__/route.test.ts
```

Expected: type error — `cookie` is not in new `getFplSession` return type.

### Step 3: Verify route.ts needs no logic changes

Open `app/api/fpl-auth/status/route.ts`. The route calls `getFplSession()` and passes `managerName` and `expiresAt` through to the response — those fields still exist. The route compiles cleanly because TypeScript will reject the old `cookie` field in the mock, not in the route itself. No changes to `route.ts` needed.

### Step 4: Run tests to confirm they pass

```bash
npx vitest run app/api/fpl-auth/status/__tests__/route.test.ts
```

Expected: all 4 tests pass.

### Step 5: Commit

```bash
git add app/api/fpl-auth/status/__tests__/route.test.ts
git commit -m "fix: update status route test mock to new getFplSession shape"
```

---

## Task 5: Update gw-plan/submit route — remove CSRF cookie extraction

`app/api/gw-plan/submit/route.ts` currently extracts a CSRF token from `fplSession.cookie` (line 86), which no longer exists. With Bearer auth, CSRF tokens are not needed. Remove the extraction and the `X-CSRFToken` header.

**Files:**

- Modify: `app/api/gw-plan/submit/__tests__/route.test.ts`
- Modify: `app/api/gw-plan/submit/route.ts`

### Step 1: Update the test mock

In `app/api/gw-plan/submit/__tests__/route.test.ts`, update `mockFplSession` (line 37-41) to match the new `getFplSession` return shape:

Old:

```typescript
const mockFplSession = {
  cookie: "pl_profile=X; csrftoken=csrf123",
  managerName: "Tim",
  expiresAt: "2026-12-01T00:00:00Z",
};
```

New:

```typescript
const mockFplSession = {
  managerName: "Tim",
  entryId: 123,
  expiresAt: "2026-12-01T00:00:00Z",
};
```

### Step 2: Run test to confirm it fails

```bash
npx vitest run app/api/gw-plan/submit/__tests__/route.test.ts
```

Expected: TypeScript error — `cookie` property does not exist.

### Step 3: Update route.ts — remove CSRF lines

In `app/api/gw-plan/submit/route.ts`:

**Remove line 86** (the CSRF extraction):

```typescript
// DELETE this line:
const csrfToken = fplSession.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
```

**Remove the `"X-CSRFToken"` header** from the `authenticatedFetch` call (around line 90-95):

```typescript
// BEFORE:
const fplResp = await authenticatedFetch(FPL_TRANSFERS_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": csrfToken,
  },
  ...

// AFTER:
const fplResp = await authenticatedFetch(FPL_TRANSFERS_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  ...
```

### Step 4: Run tests to confirm they pass

```bash
npx vitest run app/api/gw-plan/submit/__tests__/route.test.ts
```

Expected: all 6 tests pass.

### Step 5: Run full test suite

```bash
npm test
```

Expected: all tests pass.

### Step 6: Commit

```bash
git add app/api/gw-plan/submit/route.ts app/api/gw-plan/submit/__tests__/route.test.ts
git commit -m "fix: remove CSRF cookie extraction from transfer submit route (Bearer auth)"
```

---

## Task 6: Update Settings UI — replace email/password form with bookmarklet

**Files:**

- Modify: `components/settings/__tests__/fpl-account.test.tsx`
- Modify: `components/settings/fpl-account.tsx`

### Step 1: Replace the test file

The tests change significantly — the email/password form is gone, replaced by a bookmarklet anchor. Window focus triggers a status refresh.

```typescript
// components/settings/__tests__/fpl-account.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FplAccount } from "../fpl-account";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: not connected
  mockFetch.mockResolvedValue(
    new Response(
      JSON.stringify({ connected: false, managerName: null, expiresAt: null }),
      { headers: { "content-type": "application/json" } },
    ),
  );
});

afterEach(() => vi.restoreAllMocks());

describe("FplAccount", () => {
  it("shows bookmarklet instructions when not connected", async () => {
    render(<FplAccount sessionId="550e8400-e29b-41d4-a716-446655440000" />);
    await waitFor(() =>
      expect(
        screen.getByText(/drag this/i),
      ).toBeInTheDocument(),
    );
    // Bookmarklet anchor should exist with javascript: href
    const anchor = screen.getByRole("link", { name: /send to fpl insights/i });
    expect(anchor).toBeInTheDocument();
    expect(anchor.getAttribute("href")).toMatch(/^javascript:/);
  });

  it("does not show email or password inputs when not connected", async () => {
    render(<FplAccount sessionId="550e8400-e29b-41d4-a716-446655440000" />);
    await waitFor(() => screen.getByText(/drag this/i));
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("shows connected state with manager name", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          connected: true,
          managerName: "Tim Smith",
          expiresAt: "2026-12-01T00:00:00Z",
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    render(<FplAccount sessionId="550e8400-e29b-41d4-a716-446655440000" />);
    await waitFor(() =>
      expect(screen.getByText(/Tim Smith/i)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /disconnect/i }),
    ).toBeInTheDocument();
    // Should show "refreshes automatically" not an expiry date
    expect(screen.getByText(/refreshes automatically/i)).toBeInTheDocument();
  });

  it("shows skeleton while loading", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<FplAccount sessionId="550e8400-e29b-41d4-a716-446655440000" />);
    expect(screen.queryByText(/drag this/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Connected as/i)).not.toBeInTheDocument();
  });

  it("transitions to disconnected state after successful disconnect", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            connected: true,
            managerName: "Tim Smith",
            expiresAt: "2026-12-01T00:00:00Z",
          }),
          { headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    render(<FplAccount sessionId="550e8400-e29b-41d4-a716-446655440000" />);
    await waitFor(() => screen.getByRole("button", { name: /disconnect/i }));
    fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));
    await waitFor(() =>
      expect(screen.getByText(/drag this/i)).toBeInTheDocument(),
    );
  });

  it("shows error and stays connected when disconnect fails", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            connected: true,
            managerName: "Tim Smith",
            expiresAt: "2026-12-01T00:00:00Z",
          }),
          { headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Server error" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );

    render(<FplAccount sessionId="550e8400-e29b-41d4-a716-446655440000" />);
    await waitFor(() => screen.getByRole("button", { name: /disconnect/i }));
    fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));
    await waitFor(() =>
      expect(screen.getByText(/disconnect failed/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/drag this/i)).not.toBeInTheDocument();
  });

  it("re-fetches status when window regains focus", async () => {
    render(<FplAccount sessionId="550e8400-e29b-41d4-a716-446655440000" />);
    await waitFor(() => screen.getByText(/drag this/i));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Simulate window regaining focus
    fireEvent(window, new Event("focus"));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
```

### Step 2: Run test to confirm it fails

```bash
npx vitest run components/settings/__tests__/fpl-account.test.tsx
```

Expected: failures — "drag this" text not found, "refreshes automatically" not found, etc.

### Step 3: Replace fpl-account.tsx

```tsx
// components/settings/fpl-account.tsx
"use client";

import { useState, useEffect, useCallback } from "react";

export interface FplAccountProps {
  sessionId: string;
}

interface AuthStatus {
  connected: boolean;
  managerName: string | null;
  expiresAt: string | null;
}

export function FplAccount({ sessionId }: FplAccountProps) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(() => {
    void fetch(
      `/api/fpl-auth/status?sessionId=${encodeURIComponent(sessionId)}`,
    )
      .then((r) => r.json())
      .then((d) => setStatus(d as AuthStatus))
      .catch(() =>
        setStatus({ connected: false, managerName: null, expiresAt: null }),
      );
  }, [sessionId]);

  useEffect(() => {
    fetchStatus();
    window.addEventListener("focus", fetchStatus);
    return () => window.removeEventListener("focus", fetchStatus);
  }, [fetchStatus]);

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fpl-auth/logout", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        setError("Disconnect failed");
        return;
      }
      setStatus({ connected: false, managerName: null, expiresAt: null });
    } catch {
      setError("Disconnect failed");
    } finally {
      setLoading(false);
    }
  }

  if (!status) {
    return <div className="h-24 animate-pulse rounded-lg bg-fpl-card" />;
  }

  if (status.connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <svg
            className="h-5 w-5 flex-shrink-0 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <div>
            <p className="text-green-500">Connected as {status.managerName}</p>
            <p className="text-xs text-fpl-muted">Refreshes automatically</p>
          </div>
        </div>
        <button
          onClick={() => void handleDisconnect()}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm text-fpl-danger transition-colors hover:bg-fpl-danger/10 hover:text-fpl-danger/80 disabled:opacity-50"
        >
          {loading ? "Disconnecting..." : "Disconnect"}
        </button>
        {error && <p className="text-sm text-fpl-danger">{error}</p>}
      </div>
    );
  }

  // Bookmarklet href — computed client-side so window.location.origin is available
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bookmarklet =
    `javascript:(function(){` +
    `var at=localStorage.getItem('access_token');` +
    `var rt=localStorage.getItem('refresh_token');` +
    `if(!at||!rt){alert('Please log in to FPL first, then click this bookmarklet.');return;}` +
    `fetch('${origin}/api/fpl-auth/connect',{` +
    `method:'POST',` +
    `headers:{'Content-Type':'application/json'},` +
    `body:JSON.stringify({access_token:at,refresh_token:rt})` +
    `}).then(function(r){return r.json();})` +
    `.then(function(d){if(d.ok)alert('Connected! Welcome, '+d.managerName+'.');` +
    `else alert('Error: '+(d.error||'Unknown error'));})` +
    `.catch(function(){alert('Could not reach FPL Insights. Is the app running?');});` +
    `})();`;

  return (
    <div className="space-y-5">
      <ol className="space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-fpl-purple/30 text-xs font-bold">
            1
          </span>
          <div>
            <p className="mb-2 text-fpl-muted">
              Drag this to your bookmarks bar:
            </p>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a
              href={bookmarklet}
              draggable
              onClick={(e) => e.preventDefault()}
              className="inline-flex cursor-move items-center gap-2 rounded-lg border border-fpl-purple/40 bg-fpl-purple/20 px-4 py-2 text-sm font-semibold text-fpl-purple hover:bg-fpl-purple/30"
            >
              📌 Send to FPL Insights
            </a>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-fpl-purple/30 text-xs font-bold">
            2
          </span>
          <p className="text-fpl-muted">
            Open{" "}
            <a
              href="https://fantasy.premierleague.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fpl-cyan underline"
            >
              fantasy.premierleague.com
            </a>{" "}
            and log in if prompted.
          </p>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-fpl-purple/30 text-xs font-bold">
            3
          </span>
          <p className="text-fpl-muted">
            Click the{" "}
            <strong className="text-white">Send to FPL Insights</strong>{" "}
            bookmark. A confirmation will appear.
          </p>
        </li>
      </ol>
      {error && <p className="text-sm text-fpl-danger">{error}</p>}
    </div>
  );
}
```

### Step 4: Run tests to confirm they pass

```bash
npx vitest run components/settings/__tests__/fpl-account.test.tsx
```

Expected: all tests pass.

### Step 5: Run full test suite

```bash
npm test
```

Expected: all 857+ tests pass.

### Step 6: Commit

```bash
git add components/settings/fpl-account.tsx components/settings/__tests__/fpl-account.test.tsx
git commit -m "feat: replace FPL login form with bookmarklet connect UI"
```

---

## Task 7: Final verification and push

### Step 1: Run the full test suite one more time

```bash
npm test
```

Expected: all tests pass, no TypeScript errors.

### Step 2: Push to update PR

```bash
git push origin feature/gw-plan-widget
```

### Step 3: Verify PR is up to date

```bash
gh pr view 83
```

Expected: PR shows all new commits including the OAuth bookmarklet changes.
