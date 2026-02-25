import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GwPlanWidget } from "../gw-plan-widget";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GwPlanWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows generate button when no cached plan exists", async () => {
    // GET returns 404 (no cached plan)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/Generate GW Plan/i)).toBeInTheDocument();
    });
  });

  it("shows the plan when a cached plan exists", async () => {
    // GET returns cached plan
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "plan1",
        sessionId: "sess1",
        gameweek: 28,
        plan: {
          predictedTeamPoints: 62,
          captain: { playerId: 1, name: "Salah", reasoning: "great fixtures" },
          transfers: [],
          notes: "Hold wildcard",
        },
        thinking: "",
        generatedAt: "2026-02-25",
      }),
    });
    // Second fetch for transfer predictions (GET /api/gw-plan/predictions)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ predictions: [] }),
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/62/)).toBeInTheDocument();
    });
    expect(screen.getByText("Salah")).toBeInTheDocument();
    expect(screen.getByText(/great fixtures/i)).toBeInTheDocument();
  });

  it("shows loading state when generating", async () => {
    // GET returns 404
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    });

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
    // GET returns 404
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/Generate GW Plan/i)).toBeInTheDocument();
    });

    // POST returns a plan
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "plan1",
        sessionId: "sess1",
        gameweek: 28,
        plan: {
          predictedTeamPoints: 58,
          captain: { playerId: 1, name: "Haaland", reasoning: "easy fixtures" },
          transfers: [],
          notes: "",
        },
        thinking: "",
        generatedAt: "2026-02-25",
      }),
    });
    // predictions fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ predictions: [] }),
    });

    fireEvent.click(screen.getByText(/Generate GW Plan/i));

    await waitFor(() => {
      expect(screen.getByText(/58/)).toBeInTheDocument();
    });
    expect(screen.getByText("Haaland")).toBeInTheDocument();
  });

  it("shows Regenerate button when plan is displayed", async () => {
    // GET returns cached plan
    mockFetch.mockResolvedValueOnce({
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ predictions: [] }),
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/Regenerate/i)).toBeInTheDocument();
    });
  });

  it("shows an error message when generation fails", async () => {
    // GET returns 404
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    });

    render(<GwPlanWidget sessionId="sess1" gameweek={28} />);

    await waitFor(() => {
      expect(screen.getByText(/Generate GW Plan/i)).toBeInTheDocument();
    });

    // POST fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something went wrong" }),
    });

    fireEvent.click(screen.getByText(/Generate GW Plan/i));

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });
});
