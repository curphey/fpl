import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GwPlanWidget } from "../gw-plan-widget";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GwPlanWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: route by URL — fpl-auth/status returns not connected,
    // everything else returns 404 by default
    mockFetch.mockImplementation((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("fpl-auth/status")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ connected: false }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });
  });

  it("shows generate button when no cached plan exists", async () => {
    // fpl-auth/status handled by default impl (connected: false)
    // GET gw-plan returns 404 (handled by default impl)
    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/Generate GW Plan/i)).toBeInTheDocument();
    });
  });

  it("shows the plan when a cached plan exists", async () => {
    mockFetch.mockImplementation((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("fpl-auth/status")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ connected: false }),
        });
      }
      if (urlStr.includes("/api/gw-plan/predictions")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ predictions: [] }),
        });
      }
      if (urlStr.includes("/api/gw-plan")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: "plan1",
            sessionId: "sess1",
            gameweek: 28,
            plan: {
              predictedTeamPoints: 62,
              captain: {
                playerId: 1,
                name: "Salah",
                reasoning: "great fixtures",
              },
              transfers: [],
              notes: "Hold wildcard",
            },
            thinking: "",
            generatedAt: "2026-02-25",
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/62/)).toBeInTheDocument();
    });
    expect(screen.getByText("Salah")).toBeInTheDocument();
    expect(screen.getByText(/great fixtures/i)).toBeInTheDocument();
  });

  it("shows loading state when generating", async () => {
    // Uses default impl: status=not connected, gw-plan=404
    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/Generate GW Plan/i)).toBeInTheDocument();
    });

    // POST never resolves (simulates loading)
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));

    fireEvent.click(screen.getByText(/Generate GW Plan/i));

    await waitFor(() => {
      expect(screen.getByText(/Generating/i)).toBeInTheDocument();
    });
  });

  it("shows the plan after successful generation", async () => {
    // Uses default impl for initial mount (status + 404 for gw-plan)
    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/Generate GW Plan/i)).toBeInTheDocument();
    });

    // Override for the POST + predictions fetch
    mockFetch.mockImplementation((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("fpl-auth/status")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ connected: false }),
        });
      }
      if (urlStr.includes("/api/gw-plan/predictions")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ predictions: [] }),
        });
      }
      // POST /api/gw-plan
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          id: "plan1",
          sessionId: "sess1",
          gameweek: 28,
          plan: {
            predictedTeamPoints: 58,
            captain: {
              playerId: 1,
              name: "Haaland",
              reasoning: "easy fixtures",
            },
            transfers: [],
            notes: "",
          },
          thinking: "",
          generatedAt: "2026-02-25",
        }),
      });
    });

    fireEvent.click(screen.getByText(/Generate GW Plan/i));

    await waitFor(() => {
      expect(screen.getByText(/58/)).toBeInTheDocument();
    });
    expect(screen.getByText("Haaland")).toBeInTheDocument();
  });

  it("shows Regenerate button when plan is displayed", async () => {
    mockFetch.mockImplementation((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("fpl-auth/status")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ connected: false }),
        });
      }
      if (urlStr.includes("/api/gw-plan/predictions")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ predictions: [] }),
        });
      }
      if (urlStr.includes("/api/gw-plan")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: "plan1",
            sessionId: "sess1",
            gameweek: 28,
            plan: {
              predictedTeamPoints: 55,
              captain: { playerId: 2, name: "Palmer", reasoning: "form" },
              transfers: [],
              notes: "",
            },
            thinking: "",
            generatedAt: "2026-02-25",
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/Regenerate/i)).toBeInTheDocument();
    });
  });

  it("shows an error message when generation fails", async () => {
    // Uses default impl for initial mount (status + 404 for gw-plan)
    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/Generate GW Plan/i)).toBeInTheDocument();
    });

    // POST fails
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ error: "Something went wrong" }),
      }),
    );

    fireEvent.click(screen.getByText(/Generate GW Plan/i));

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });

  // --- NEW TESTS FOR SUBMIT TO FPL BUTTON ---

  it("shows Submit to FPL button when connected and plan has transfers", async () => {
    mockFetch.mockImplementation((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("fpl-auth/status")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ connected: true }),
        });
      }
      if (urlStr.includes("/api/gw-plan/predictions")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ predictions: [] }),
        });
      }
      if (urlStr.includes("/api/gw-plan")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: "plan1",
            sessionId: "sess1",
            gameweek: 28,
            plan: {
              predictedTeamPoints: 60,
              captain: { playerId: 1, name: "Salah", reasoning: "fixtures" },
              transfers: [
                {
                  playerOut: { id: 10, name: "Mukiele", predicted4GW: 10 },
                  playerIn: {
                    id: 20,
                    name: "Alexander-Arnold",
                    predicted4GW: 15,
                  },
                  pointsGain: 5,
                  hitCost: 0,
                  reasoning: "upgrade",
                },
              ],
              notes: "",
            },
            thinking: "",
            generatedAt: "2026-02-26",
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/Submit \d+ Transfer/i)).toBeInTheDocument();
    });
  });

  it("does not show Submit to FPL button when not connected", async () => {
    mockFetch.mockImplementation((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("fpl-auth/status")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ connected: false }),
        });
      }
      if (urlStr.includes("/api/gw-plan/predictions")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ predictions: [] }),
        });
      }
      if (urlStr.includes("/api/gw-plan")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: "plan1",
            sessionId: "sess1",
            gameweek: 28,
            plan: {
              predictedTeamPoints: 60,
              captain: { playerId: 1, name: "Salah", reasoning: "fixtures" },
              transfers: [
                {
                  playerOut: { id: 10, name: "Mukiele", predicted4GW: 10 },
                  playerIn: {
                    id: 20,
                    name: "Alexander-Arnold",
                    predicted4GW: 15,
                  },
                  pointsGain: 5,
                  hitCost: 0,
                  reasoning: "upgrade",
                },
              ],
              notes: "",
            },
            thinking: "",
            generatedAt: "2026-02-26",
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    // Wait for plan to load
    await waitFor(() => {
      expect(screen.getByText(/Salah/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Submit \d+ Transfer/i)).toBeNull();
  });

  it("does not show Submit to FPL button when plan has no transfers", async () => {
    mockFetch.mockImplementation((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("fpl-auth/status")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ connected: true }),
        });
      }
      if (urlStr.includes("/api/gw-plan/predictions")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ predictions: [] }),
        });
      }
      if (urlStr.includes("/api/gw-plan")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: "plan1",
            sessionId: "sess1",
            gameweek: 28,
            plan: {
              predictedTeamPoints: 60,
              captain: { playerId: 1, name: "Salah", reasoning: "fixtures" },
              transfers: [],
              notes: "",
            },
            thinking: "",
            generatedAt: "2026-02-26",
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    // Wait for plan to load
    await waitFor(() => {
      expect(screen.getByText(/Salah/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Submit \d+ Transfer/i)).toBeNull();
  });

  it("renders a checkbox for each transfer", async () => {
    mockFetch.mockImplementation((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("fpl-auth/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ connected: true }),
        });
      }
      if (urlStr.includes("/api/gw-plan/predictions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ predictions: [] }),
        });
      }
      if (urlStr.includes("/api/gw-plan")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "plan1",
            sessionId: "sess1",
            gameweek: 28,
            plan: {
              predictedTeamPoints: 60,
              captain: { playerId: 1, name: "Salah", reasoning: "fixtures" },
              transfers: [
                {
                  playerOut: { id: 10, name: "Mukiele", predicted4GW: 10 },
                  playerIn: { id: 20, name: "Dalot", predicted4GW: 15 },
                  pointsGain: 5,
                  hitCost: 0,
                  reasoning: "upgrade",
                },
                {
                  playerOut: { id: 11, name: "Flop", predicted4GW: 6 },
                  playerIn: { id: 21, name: "Star", predicted4GW: 14 },
                  pointsGain: 8,
                  hitCost: 0,
                  reasoning: "big upgrade",
                },
              ],
              notes: "",
            },
            thinking: "",
            generatedAt: "2026-02-26",
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);
    await waitFor(() =>
      expect(screen.getAllByRole("checkbox")).toHaveLength(2),
    );
  });

  it("Submit button shows count of selected transfers", async () => {
    mockFetch.mockImplementation((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("fpl-auth/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ connected: true }),
        });
      }
      if (urlStr.includes("/api/gw-plan/predictions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ predictions: [] }),
        });
      }
      if (urlStr.includes("/api/gw-plan")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "plan1",
            sessionId: "sess1",
            gameweek: 28,
            plan: {
              predictedTeamPoints: 60,
              captain: { playerId: 1, name: "Salah", reasoning: "fixtures" },
              transfers: [
                {
                  playerOut: { id: 10, name: "Mukiele", predicted4GW: 10 },
                  playerIn: { id: 20, name: "Dalot", predicted4GW: 15 },
                  pointsGain: 5,
                  hitCost: 0,
                  reasoning: "upgrade",
                },
              ],
              notes: "",
            },
            thinking: "",
            generatedAt: "2026-02-26",
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);
    await waitFor(() =>
      expect(screen.getByText(/Submit 1 Transfer/i)).toBeInTheDocument(),
    );
  });

  it("hides Submit button when all transfer checkboxes are unchecked", async () => {
    mockFetch.mockImplementation((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("fpl-auth/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ connected: true }),
        });
      }
      if (urlStr.includes("/api/gw-plan/predictions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ predictions: [] }),
        });
      }
      if (urlStr.includes("/api/gw-plan")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "plan1",
            sessionId: "sess1",
            gameweek: 28,
            plan: {
              predictedTeamPoints: 60,
              captain: { playerId: 1, name: "Salah", reasoning: "fixtures" },
              transfers: [
                {
                  playerOut: { id: 10, name: "Mukiele", predicted4GW: 10 },
                  playerIn: { id: 20, name: "Dalot", predicted4GW: 15 },
                  pointsGain: 5,
                  hitCost: 0,
                  reasoning: "upgrade",
                },
              ],
              notes: "",
            },
            thinking: "",
            generatedAt: "2026-02-26",
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);
    await waitFor(() =>
      expect(screen.getByRole("checkbox")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("checkbox")); // uncheck
    await waitFor(() => expect(screen.queryByText(/Submit/i)).toBeNull());
  });

  it("shows Submitted after modal onSuccess", async () => {
    mockFetch.mockImplementation((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("fpl-auth/status")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ connected: true }),
        });
      }
      if (urlStr.includes("/api/gw-plan/predictions")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ predictions: [] }),
        });
      }
      if (urlStr.includes("/api/gw-plan/submit")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            valid: true,
            transfers: [
              {
                elementIn: 20,
                elementOut: 10,
                purchasePrice: 110,
                sellingPrice: 105,
              },
            ],
            transferCost: 0,
            wildcardActive: false,
          }),
        });
      }
      if (urlStr.includes("/api/gw-plan")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: "plan1",
            sessionId: "sess1",
            gameweek: 28,
            plan: {
              predictedTeamPoints: 60,
              captain: { playerId: 1, name: "Salah", reasoning: "fixtures" },
              transfers: [
                {
                  playerOut: { id: 10, name: "Mukiele", predicted4GW: 10 },
                  playerIn: {
                    id: 20,
                    name: "Alexander-Arnold",
                    predicted4GW: 15,
                  },
                  pointsGain: 5,
                  hitCost: 0,
                  reasoning: "upgrade",
                },
              ],
              notes: "",
            },
            thinking: "",
            generatedAt: "2026-02-26",
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    // Wait for Submit button
    await waitFor(() => {
      expect(screen.getByText(/Submit \d+ Transfer/i)).toBeInTheDocument();
    });

    // Click Submit — opens modal
    fireEvent.click(screen.getByText(/Submit \d+ Transfer/i));

    // Wait for Confirm & Submit button in modal
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm/i }),
      ).toBeInTheDocument();
    });

    // Now mock a successful submit response for the second POST
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ submitted: true }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    // Wait for modal success screen to appear
    await waitFor(() => {
      expect(screen.getByText(/transfers submitted/i)).toBeInTheDocument();
    });

    // Click Close to trigger onSuccess — modal closes, button becomes "Submitted ✓"
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => {
      expect(screen.getByText(/Submitted ✓/i)).toBeInTheDocument();
    });
  });
});
