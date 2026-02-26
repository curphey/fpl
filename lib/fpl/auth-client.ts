import { getSetting, setSetting } from "@/lib/db/settings";
import { encrypt, decrypt } from "./auth-crypto";

const FPL_LOGIN_URL = "https://users.premierleague.com/accounts/login/";
const FPL_API_BASE = "https://fantasy.premierleague.com/api";

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: "https://fantasy.premierleague.com/",
  Origin: "https://fantasy.premierleague.com",
};

export type FplLoginError =
  | "INVALID_CREDENTIALS"
  | "CLOUDFLARE_BLOCKED"
  | "NETWORK_ERROR";
export type FplLoginResult =
  | {
      success: true;
      managerName: string;
      sessionCookie: string;
      expiresAt: string;
    }
  | { success: false; error: FplLoginError; message: string };

function getSetCookieHeaders(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === "function") return h.getSetCookie();
  const raw = headers.get("set-cookie");
  return raw ? raw.split(",").map((s) => s.trim()) : [];
}

function parseCookies(setCookieHeaders: string[]): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const header of setCookieHeaders) {
    const [nameValue] = header.split(";");
    const eqIdx = nameValue.indexOf("=");
    if (eqIdx >= 0) {
      cookies.set(
        nameValue.slice(0, eqIdx).trim(),
        nameValue.slice(eqIdx + 1).trim(),
      );
    }
  }
  return cookies;
}

function extractCsrfFromHtml(html: string): string | null {
  const match = html.match(
    /name=['"]csrfmiddlewaretoken['"]\s+value=['"]([^'"]+)['"]/,
  );
  return match?.[1] ?? null;
}

function buildCookieString(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export async function fplLogin(
  email: string,
  password: string,
): Promise<FplLoginResult> {
  try {
    // Step 1: GET login page to extract CSRF token
    const getResp = await fetch(FPL_LOGIN_URL, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });

    if (getResp.status === 403 || getResp.status === 429) {
      return {
        success: false,
        error: "CLOUDFLARE_BLOCKED",
        message: "FPL login blocked by Cloudflare. Try again later.",
      };
    }
    if (!getResp.ok) {
      return {
        success: false,
        error: "NETWORK_ERROR",
        message: `FPL login page unavailable (${getResp.status})`,
      };
    }

    const html = await getResp.text();
    const getSetCookies = getSetCookieHeaders(getResp.headers);
    const getCookies = parseCookies(getSetCookies);

    const csrfToken = getCookies.get("csrftoken") ?? extractCsrfFromHtml(html);
    if (!csrfToken) {
      return {
        success: false,
        error: "NETWORK_ERROR",
        message: "Could not extract CSRF token from FPL login page",
      };
    }

    // Step 2: POST credentials
    const body = new URLSearchParams({
      login: email,
      password,
      csrfmiddlewaretoken: csrfToken,
      app: "plfpl-web",
      redirect_uri: "https://fantasy.premierleague.com/a/login",
    });

    const postResp = await fetch(FPL_LOGIN_URL, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: buildCookieString(getCookies),
      },
      body: body.toString(),
      redirect: "follow",
    });

    if (postResp.status === 403 || postResp.status === 429) {
      return {
        success: false,
        error: "CLOUDFLARE_BLOCKED",
        message: "FPL login blocked by Cloudflare. Try again later.",
      };
    }

    const postSetCookies = getSetCookieHeaders(postResp.headers);
    const postCookies = parseCookies(postSetCookies);

    if (!postCookies.has("pl_profile")) {
      return {
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Invalid FPL credentials",
      };
    }

    // Merge all cookies for authenticated requests
    const allCookies = new Map([...getCookies, ...postCookies]);
    const sessionCookie = buildCookieString(allCookies);

    // Derive session expiry from pl_profile cookie header
    const plProfileHeader =
      postSetCookies.find((c) => c.startsWith("pl_profile=")) ?? "";
    const expiresMatch = plProfileHeader.match(/expires=([^;]+)/i);
    const parsedExpiry = expiresMatch ? new Date(expiresMatch[1]) : null;
    const expiresAt =
      parsedExpiry && !isNaN(parsedExpiry.getTime())
        ? parsedExpiry.toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Step 3: Fetch manager name (non-critical)
    let managerName = "FPL Manager";
    try {
      const meResp = await fetch(`${FPL_API_BASE}/me/`, {
        headers: { ...BROWSER_HEADERS, Cookie: sessionCookie },
      });
      if (meResp.ok) {
        const me = (await meResp.json()) as {
          player?: { first_name: string; last_name: string };
        };
        if (me.player) {
          managerName = `${me.player.first_name} ${me.player.last_name}`.trim();
        }
      }
    } catch {
      // name is non-critical; continue
    }

    return { success: true, managerName, sessionCookie, expiresAt };
  } catch (error) {
    return {
      success: false,
      error: "NETWORK_ERROR",
      message:
        error instanceof Error
          ? error.message
          : "Network error during FPL login",
    };
  }
}

export function storeFplCredentials(
  email: string,
  password: string,
  sessionCookie: string,
  expiresAt: string,
  managerName: string,
): void {
  setSetting("fpl_email_encrypted", encrypt(email));
  setSetting("fpl_password_encrypted", encrypt(password));
  setSetting("fpl_session_cookie", sessionCookie);
  setSetting("fpl_session_expires", expiresAt);
  setSetting("fpl_manager_name", managerName);
}

export function clearFplCredentials(): void {
  for (const key of [
    "fpl_email_encrypted",
    "fpl_password_encrypted",
    "fpl_session_cookie",
    "fpl_session_expires",
    "fpl_manager_name",
  ]) {
    setSetting(key, null);
  }
}

export function getFplSession(): {
  cookie: string;
  managerName: string;
} | null {
  const cookie = getSetting("fpl_session_cookie");
  const expires = getSetting("fpl_session_expires");
  if (!cookie || !expires) return null;
  if (new Date(expires) <= new Date()) return null;
  return {
    cookie,
    managerName: getSetting("fpl_manager_name") ?? "FPL Manager",
  };
}

export async function refreshFplSession(): Promise<boolean> {
  const encryptedEmail = getSetting("fpl_email_encrypted");
  const encryptedPw = getSetting("fpl_password_encrypted");
  if (!encryptedEmail || !encryptedPw) return false;
  let email: string;
  let password: string;
  try {
    email = decrypt(encryptedEmail);
    password = decrypt(encryptedPw);
  } catch {
    console.error(
      "[FPL Auth] Failed to decrypt stored credentials — key may have changed",
    );
    return false;
  }
  const result = await fplLogin(email, password);
  if (!result.success) return false;
  storeFplCredentials(
    email,
    password,
    result.sessionCookie,
    result.expiresAt,
    result.managerName,
  );
  return true;
}

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const session = getFplSession();
  if (!session) throw new Error("FPL_UNAUTHORIZED");

  const response = await fetch(url, {
    ...options,
    headers: { ...BROWSER_HEADERS, ...options.headers, Cookie: session.cookie },
  });

  if (response.status === 401) {
    const refreshed = await refreshFplSession();
    if (!refreshed) throw new Error("FPL_SESSION_EXPIRED");
    const newSession = getFplSession();
    return fetch(url, {
      ...options,
      headers: {
        ...BROWSER_HEADERS,
        ...options.headers,
        Cookie: newSession!.cookie,
      },
    });
  }

  return response;
}
