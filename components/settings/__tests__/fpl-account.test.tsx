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
      expect(screen.getByText(/drag this/i)).toBeInTheDocument(),
    );
    // Bookmarklet anchor is injected imperatively via useEffect — use findByRole
    // to wait for the DOM mutation rather than asserting synchronously.
    const anchor = await screen.findByRole("link", {
      name: /send to fpl insights/i,
    });
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
