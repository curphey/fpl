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
    substitutions: [],
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

  it("shows transfer details immediately on open without any API call", () => {
    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    // Confirm screen should be visible immediately — no loading state
    expect(screen.getByText(/confirm transfers/i)).toBeInTheDocument();
    expect(screen.getByText(/Mukiele/i)).toBeInTheDocument();
    expect(screen.getByText(/Alexander-Arnold/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeInTheDocument();
    // No fetch should have been called on open
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("makes exactly one API call with confirm: true when submitted", async () => {
    mockFetch.mockResolvedValueOnce(
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

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() =>
      expect(screen.getByText(/submitted/i)).toBeInTheDocument(),
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { confirm: boolean };
    expect(body.confirm).toBe(true);
  });

  it("calls onClose when Cancel clicked", () => {
    const onClose = vi.fn();
    render(
      <SubmitPlanModal
        open={true}
        onClose={onClose}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows success message after submission", async () => {
    mockFetch.mockResolvedValueOnce(
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
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() =>
      expect(screen.getByText(/submitted/i)).toBeInTheDocument(),
    );
  });

  it("shows submitting state while waiting for confirmation", async () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {})); // never resolves

    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(screen.getByText(/submitting transfers/i)).toBeInTheDocument(),
    );
  });

  it("shows error when FPL rejects the submission", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/transfer deadline has passed/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows error when submission fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/network error during submission/i),
      ).toBeInTheDocument(),
    );
  });

  it("calls onSuccess callback after successful submission", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ submitted: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const onSuccess = vi.fn();

    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(screen.getByText(/submitted/i)).toBeInTheDocument(),
    );
    // onSuccess fires only when Close is clicked
    expect(onSuccess).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("shows success message in modal before onSuccess is called", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ submitted: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const onSuccess = vi.fn();

    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={mockPlan}
        sessionId={SESSION_ID}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(screen.getByText(/transfers submitted/i)).toBeInTheDocument(),
    );

    expect(onSuccess).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("shows already-applied message when transfer was already made", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          submitted: true,
          alreadyApplied: true,
          transfersMade: 0,
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
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() =>
      expect(screen.getByText(/already applied/i)).toBeInTheDocument(),
    );
  });

  it("shows hit cost warning when transfers have a hit", () => {
    const planWithHit: GwPlan = {
      ...mockPlan,
      plan: {
        ...mockPlan.plan,
        transfers: [
          {
            ...mockPlan.plan.transfers[0],
            hitCost: 4,
          },
        ],
      },
    };

    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={planWithHit}
        sessionId={SESSION_ID}
      />,
    );

    expect(screen.getByText(/hit cost.*-4 pts/i)).toBeInTheDocument();
  });
});

describe("SubmitPlanModal — substitutions", () => {
  const planWithSubs: GwPlan = {
    ...mockPlan,
    plan: {
      ...mockPlan.plan,
      transfers: [],
      substitutions: [
        {
          playerOut: { id: 10, name: "Garner" },
          playerIn: { id: 20, name: "Dalot" },
          reasoning: "Dalot is better",
        },
      ],
    },
  };

  it("shows substitution rows in confirm view when selectedSubstitutionIndices provided", () => {
    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={planWithSubs}
        sessionId="sess-1"
        selectedTransferIndices={[]}
        selectedSubstitutionIndices={[0]}
      />,
    );
    expect(screen.getByText("Garner")).toBeInTheDocument();
    expect(screen.getByText("Dalot")).toBeInTheDocument();
  });

  it("shows 'Confirm Lineup Changes' title when only substitutions selected", () => {
    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={planWithSubs}
        sessionId="sess-1"
        selectedTransferIndices={[]}
        selectedSubstitutionIndices={[0]}
      />,
    );
    expect(screen.getByText("Confirm Lineup Changes")).toBeInTheDocument();
  });

  it("calls submit-lineup when only substitutions are selected", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ submitted: true }),
    } as Response);

    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={planWithSubs}
        sessionId="sess-1"
        selectedTransferIndices={[]}
        selectedSubstitutionIndices={[0]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        "/api/gw-plan/submit-lineup",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("shows success after lineup submission", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ submitted: true }),
    } as Response);

    render(
      <SubmitPlanModal
        open={true}
        onClose={vi.fn()}
        plan={planWithSubs}
        sessionId="sess-1"
        selectedTransferIndices={[]}
        selectedSubstitutionIndices={[0]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(screen.getByText(/Lineup submitted/i)).toBeInTheDocument(),
    );
  });
});
