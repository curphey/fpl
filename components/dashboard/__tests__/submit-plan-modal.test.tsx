import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SubmitPlanModal } from "../submit-plan-modal";
import type { GwPlan } from "@/lib/db/gw-plan";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const PLAN_ID = "660e8400-e29b-41d4-a716-446655440001";

const mockPlan: GwPlan = {
  id: PLAN_ID,
  sessionId: SESSION_ID,
  gameweek: 28,
  plan: {
    predictedTeamPoints: 60,
    captain: { playerId: 100, name: "Salah", reasoning: "great fixtures" },
    transfers: [
      {
        playerOut: { id: 10, name: "Mukiele", predicted4GW: 10 },
        playerIn: { id: 20, name: "Alexander-Arnold", predicted4GW: 15 },
        pointsGain: 5,
        hitCost: 0,
        reasoning: "upgrade",
      },
    ],
    notes: "",
  },
  thinking: "",
  generatedAt: "2026-02-26T00:00:00Z",
};

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("SubmitPlanModal", () => {
  it("does not render when closed", () => {
    render(
      <SubmitPlanModal
        open={false}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    expect(screen.queryByText(/confirm transfers/i)).toBeNull();
  });

  it("shows transfer details after validation succeeds", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/confirm transfers/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Mukiele/i)).toBeInTheDocument();
    expect(screen.getByText(/Alexander-Arnold/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeInTheDocument();
  });

  it("calls onClose when Cancel clicked", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          valid: true,
          transfers: [],
          transferCost: 0,
          wildcardActive: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const onClose = vi.fn();
    render(
      <SubmitPlanModal
        open={true}
        onClose={onClose}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    await waitFor(() => screen.getByRole("button", { name: /cancel/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows success message after submission", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ submitted: true, transfersMade: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    await waitFor(() => screen.getByRole("button", { name: /confirm/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() =>
      expect(screen.getByText(/submitted/i)).toBeInTheDocument(),
    );
  });

  it("shows validation error when FPL rejects the request", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Transfer deadline has passed",
          code: "DEADLINE_PASSED",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );
    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/transfer deadline has passed/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows submitting state while waiting for confirmation", async () => {
    // First fetch (validation): resolves immediately
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    // Second fetch (submit): never resolves (simulates in-flight)
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    await waitFor(() => screen.getByRole("button", { name: /confirm/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(screen.getByText(/submitting transfers/i)).toBeInTheDocument(),
    );
  });

  it("shows error when validation fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));
    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/network error during validation/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows error when submission fetch throws", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockRejectedValueOnce(new Error("Network failure"));

    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    await waitFor(() => screen.getByRole("button", { name: /confirm/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/network error during submission/i),
      ).toBeInTheDocument(),
    );
  });
});
