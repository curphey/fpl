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
