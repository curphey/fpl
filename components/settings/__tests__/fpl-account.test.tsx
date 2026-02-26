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
      {
        headers: { "content-type": "application/json" },
      },
    ),
  );
});

afterEach(() => vi.restoreAllMocks());

describe("FplAccount", () => {
  it("shows login form when not connected", async () => {
    render(<FplAccount sessionId="550e8400-e29b-41d4-a716-446655440000" />);
    await waitFor(() =>
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /connect/i }),
    ).toBeInTheDocument();
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
  });

  it("shows error on failed login", async () => {
    // Status fetch: not connected
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ connected: false }), {
          headers: { "content-type": "application/json" },
        }),
      )
      // Login POST: fail
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid FPL credentials" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      );

    render(<FplAccount sessionId="550e8400-e29b-41d4-a716-446655440000" />);
    await waitFor(() => screen.getByLabelText(/email/i));

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() =>
      expect(screen.getByText(/invalid fpl credentials/i)).toBeInTheDocument(),
    );
  });

  it("shows skeleton while loading", async () => {
    // Never resolves, so status stays null
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<FplAccount sessionId="550e8400-e29b-41d4-a716-446655440000" />);
    // No skeleton class to query easily — check that form and connected state are not shown
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Connected as/i)).not.toBeInTheDocument();
  });

  it("transitions to disconnected form after successful disconnect", async () => {
    // Initial status: connected
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
      // DELETE /api/fpl-auth/logout: success
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
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument(),
    );
  });

  it("shows error and stays connected when disconnect request fails", async () => {
    // Initial status: connected
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
      // DELETE /api/fpl-auth/logout: server error
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
    // Should still show connected state (not the login form)
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("shows session expiry label with colon", async () => {
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
    await waitFor(() => screen.getByText(/Tim Smith/i));
    expect(screen.getByText(/Session expires:/i)).toBeInTheDocument();
  });
});
