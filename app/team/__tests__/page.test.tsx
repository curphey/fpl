import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TeamPage from "../page";

// Mock all hooks the page uses
vi.mock("@/lib/fpl/manager-context", () => ({
  useManagerContext: vi.fn(),
}));
vi.mock("@/lib/fpl/hooks/use-fpl", () => ({
  useBootstrapStatic: vi.fn(),
  useManagerPicks: vi.fn(),
  usePendingPicks: vi.fn(),
  useLiveGameweek: vi.fn(),
  useManagerHistory: vi.fn(),
}));
vi.mock("@/components/chat", () => ({ AskAiButton: () => null }));

import { useManagerContext } from "@/lib/fpl/manager-context";
import {
  useBootstrapStatic,
  useManagerPicks,
  usePendingPicks,
  useLiveGameweek,
  useManagerHistory,
} from "@/lib/fpl/hooks/use-fpl";

const mockManager = {
  id: 1,
  current_event: 27,
  started_event: 1,
  player_first_name: "Tim",
  player_last_name: "Smith",
  name: "Test FC",
  summary_overall_points: 1000,
  summary_overall_rank: 5000,
  summary_event_points: 55,
  summary_event_rank: 10000,
  last_deadline_bank: 10,
  last_deadline_value: 1000,
  last_deadline_total_transfers: 5,
};

const mockBootstrap = {
  events: [
    {
      id: 27,
      name: "Gameweek 27",
      is_current: true,
      is_next: false,
      is_previous: false,
      deadline_time: "2026-02-20T11:30:00Z",
    },
    {
      id: 28,
      name: "Gameweek 28",
      is_current: false,
      is_next: true,
      is_previous: false,
      deadline_time: "2026-02-27T11:30:00Z",
    },
  ],
  elements: [],
  teams: [],
};

const mockPicks = {
  picks: [
    {
      element: 694,
      position: 1,
      multiplier: 1,
      is_captain: false,
      is_vice_captain: false,
    },
  ],
  entry_history: {
    event: 27,
    points: 55,
    total_points: 1000,
    rank: 10000,
    rank_sort: 10000,
    percentile_rank: 50,
    overall_rank: 5000,
    bank: 10,
    value: 1000,
    event_transfers: 1,
    event_transfers_cost: 0,
    points_on_bench: 5,
  },
  active_chip: null,
  automatic_subs: [],
};

const mockPendingPicks = {
  picks: [
    {
      element: 440,
      position: 1,
      multiplier: 1,
      is_captain: false,
      is_vice_captain: false,
    },
  ],
};

const noData = { data: null, isLoading: false, error: null, refetch: vi.fn() };

function setupMocks() {
  vi.mocked(useManagerContext).mockReturnValue({
    managerId: 1,
    manager: mockManager,
  } as ReturnType<typeof useManagerContext>);
  vi.mocked(useBootstrapStatic).mockReturnValue({
    data: mockBootstrap,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as ReturnType<typeof useBootstrapStatic>);
  vi.mocked(useManagerPicks).mockReturnValue({
    data: mockPicks,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as ReturnType<typeof useManagerPicks>);
  vi.mocked(usePendingPicks).mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as ReturnType<typeof usePendingPicks>);
  vi.mocked(useLiveGameweek).mockReturnValue(
    noData as ReturnType<typeof useLiveGameweek>,
  );
  vi.mocked(useManagerHistory).mockReturnValue(
    noData as ReturnType<typeof useManagerHistory>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  setupMocks();
});

describe("TeamPage pending squad", () => {
  it("shows forward nav when is_next GW exists", () => {
    render(<TeamPage />);
    const nextBtn = screen.getByRole("button", { name: /next gameweek/i });
    expect(nextBtn).not.toBeDisabled();
  });

  it("shows 'GW28 Pending' label when navigated to next GW", async () => {
    render(<TeamPage />);
    const nextBtn = screen.getByRole("button", { name: /next gameweek/i });
    fireEvent.click(nextBtn);
    await waitFor(() =>
      expect(screen.getByText(/GW28 Pending/i)).toBeInTheDocument(),
    );
  });

  it("hides GameweekSummary when showing pending view", async () => {
    vi.mocked(usePendingPicks).mockReturnValue({
      data: mockPendingPicks,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof usePendingPicks>);

    render(<TeamPage />);
    const nextBtn = screen.getByRole("button", { name: /next gameweek/i });
    fireEvent.click(nextBtn);

    // GameweekSummary should not be shown for pending view
    // It shows points data - verify it's not rendered
    await waitFor(() => {
      expect(screen.queryByText(/gameweek points/i)).not.toBeInTheDocument();
    });
  });

  it("shows connect message when pending picks returns auth error", async () => {
    const authError = new Error(
      "FPL session expired. Please reconnect in Settings.",
    );
    vi.mocked(usePendingPicks).mockReturnValue({
      data: null,
      isLoading: false,
      error: authError,
      refetch: vi.fn(),
    } as ReturnType<typeof usePendingPicks>);

    render(<TeamPage />);
    const nextBtn = screen.getByRole("button", { name: /next gameweek/i });
    fireEvent.click(nextBtn);

    await waitFor(() =>
      expect(screen.getByText(/connect your fpl account/i)).toBeInTheDocument(),
    );
  });

  it("shows generic error message when pending picks returns non-auth error", async () => {
    const serverError = new Error("FPL_API_ERROR");
    vi.mocked(usePendingPicks).mockReturnValue({
      data: null,
      isLoading: false,
      error: serverError,
      refetch: vi.fn(),
    } as ReturnType<typeof usePendingPicks>);

    render(<TeamPage />);
    const nextBtn = screen.getByRole("button", { name: /next gameweek/i });
    fireEvent.click(nextBtn);

    await waitFor(() =>
      expect(
        screen.getByText(/unable to load pending squad/i),
      ).toBeInTheDocument(),
    );
  });
});
