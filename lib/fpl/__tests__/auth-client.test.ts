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
  fplLogin,
  storeFplCredentials,
  clearFplCredentials,
  getFplSession,
  refreshFplSession,
  authenticatedFetch,
} from "../auth-client";

const mockGetSetting = vi.mocked(getSetting);
const mockSetSetting = vi.mocked(setSetting);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

describe("fplLogin", () => {
  it("returns CLOUDFLARE_BLOCKED when GET returns 403", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Blocked", { status: 403 }),
    );
    const result = await fplLogin("a@b.com", "pw");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("CLOUDFLARE_BLOCKED");
  });

  it("returns INVALID_CREDENTIALS when pl_profile cookie absent after POST", async () => {
    const getHeaders = new Headers();
    getHeaders.append("set-cookie", "csrftoken=abc123; Path=/");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("<input name='csrfmiddlewaretoken' value='abc123'>", {
        status: 200,
        headers: getHeaders,
      }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Login failed", { status: 200, headers: new Headers() }),
    );
    const result = await fplLogin("a@b.com", "wrong");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("INVALID_CREDENTIALS");
  });

  it("returns NETWORK_ERROR when GET returns 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Server error", { status: 500 }),
    );
    const result = await fplLogin("a@b.com", "pw");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("NETWORK_ERROR");
  });

  it("returns CLOUDFLARE_BLOCKED when POST returns 403", async () => {
    const getHeaders = new Headers();
    getHeaders.append("set-cookie", "csrftoken=abc123; Path=/");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("<html/>", { status: 200, headers: getHeaders }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 403 }));
    const result = await fplLogin("a@b.com", "pw");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("CLOUDFLARE_BLOCKED");
  });

  it("returns NETWORK_ERROR on fetch exception", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await fplLogin("a@b.com", "pw");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("NETWORK_ERROR");
      expect(result.message).toContain("ECONNREFUSED");
    }
  });

  it("returns success with manager name on valid login", async () => {
    const getHeaders = new Headers();
    getHeaders.append("set-cookie", "csrftoken=abc123; Path=/");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("<html/>", { status: 200, headers: getHeaders }),
    );
    const postHeaders = new Headers();
    postHeaders.append(
      "set-cookie",
      "pl_profile=TOKENVALUE; Path=/; expires=Thu, 01 Jan 2026 00:00:00 GMT",
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("", { status: 200, headers: postHeaders }),
    );
    // /me/ call
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ player: { first_name: "Tim", last_name: "Smith" } }),
        {
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
        },
      ),
    );
    const result = await fplLogin("a@b.com", "pw");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.managerName).toBe("Tim Smith");
      expect(result.sessionCookie).toContain("pl_profile=TOKENVALUE");
    }
  });
});

describe("storeFplCredentials / clearFplCredentials", () => {
  it("stores all credential keys", () => {
    storeFplCredentials(
      "a@b.com",
      "pw",
      "cookie",
      "2026-12-01T00:00:00Z",
      "Tim Smith",
    );
    expect(mockSetSetting).toHaveBeenCalledWith(
      "fpl_email_encrypted",
      "enc:a@b.com",
    );
    expect(mockSetSetting).toHaveBeenCalledWith(
      "fpl_password_encrypted",
      "enc:pw",
    );
    expect(mockSetSetting).toHaveBeenCalledWith("fpl_session_cookie", "cookie");
    expect(mockSetSetting).toHaveBeenCalledWith(
      "fpl_session_expires",
      "2026-12-01T00:00:00Z",
    );
    expect(mockSetSetting).toHaveBeenCalledWith(
      "fpl_manager_name",
      "Tim Smith",
    );
  });

  it("clears all credential keys", () => {
    clearFplCredentials();
    expect(mockSetSetting).toHaveBeenCalledWith("fpl_email_encrypted", null);
    expect(mockSetSetting).toHaveBeenCalledWith("fpl_password_encrypted", null);
    expect(mockSetSetting).toHaveBeenCalledWith("fpl_session_cookie", null);
    expect(mockSetSetting).toHaveBeenCalledWith("fpl_session_expires", null);
    expect(mockSetSetting).toHaveBeenCalledWith("fpl_manager_name", null);
  });
});

describe("getFplSession", () => {
  it("returns null when no cookie stored", () => {
    mockGetSetting.mockReturnValue(null);
    expect(getFplSession()).toBeNull();
  });

  it("returns null when session expired", () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "fpl_session_cookie") return "pl_profile=X";
      if (key === "fpl_session_expires") return "2020-01-01T00:00:00Z";
      if (key === "fpl_manager_name") return "Tim";
      return null;
    });
    expect(getFplSession()).toBeNull();
  });

  it("returns session when valid", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "fpl_session_cookie") return "pl_profile=X";
      if (key === "fpl_session_expires") return future;
      if (key === "fpl_manager_name") return "Tim";
      return null;
    });
    const session = getFplSession();
    expect(session).not.toBeNull();
    expect(session?.cookie).toBe("pl_profile=X");
    expect(session?.managerName).toBe("Tim");
    expect(session?.expiresAt).toBe(future);
  });
});

describe("authenticatedFetch", () => {
  it("throws FPL_UNAUTHORIZED when no session", async () => {
    mockGetSetting.mockReturnValue(null);
    await expect(authenticatedFetch("https://example.com")).rejects.toThrow(
      "FPL_UNAUTHORIZED",
    );
  });

  it("adds Cookie header to request", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "fpl_session_cookie") return "pl_profile=X";
      if (key === "fpl_session_expires") return future;
      return null;
    });
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await authenticatedFetch("https://example.com/api/");
    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/api/",
      expect.objectContaining({
        headers: expect.objectContaining({ Cookie: "pl_profile=X" }),
      }),
    );
  });

  it("retries with refreshed session on 401", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "fpl_session_cookie") return "pl_profile=X";
      if (key === "fpl_session_expires") return future;
      if (key === "fpl_email_encrypted") return "enc:a@b.com";
      if (key === "fpl_password_encrypted") return "enc:pw";
      return null;
    });

    // First call returns 401
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      // GET login page (refresh)
      .mockResolvedValueOnce(
        new Response("<html/>", {
          status: 200,
          headers: (() => {
            const h = new Headers();
            h.append("set-cookie", "csrftoken=x; Path=/");
            return h;
          })(),
        }),
      )
      // POST login (refresh)
      .mockResolvedValueOnce(
        new Response("", {
          status: 200,
          headers: (() => {
            const h = new Headers();
            h.append("set-cookie", "pl_profile=NEW; Path=/");
            return h;
          })(),
        }),
      )
      // /me/ call during refresh
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      // Retry original request
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

    const resp = await authenticatedFetch("https://example.com/api/data");
    expect(resp.status).toBe(200);
  });
});
