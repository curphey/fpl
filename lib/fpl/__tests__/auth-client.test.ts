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
