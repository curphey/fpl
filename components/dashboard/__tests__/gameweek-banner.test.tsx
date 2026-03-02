import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { GameweekBanner } from "../gameweek-banner";
import type { Gameweek } from "@/lib/fpl/types";

// Mock the utils module so we control the time values in tests
vi.mock("@/lib/fpl/utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/fpl/utils")>();
  return {
    ...original,
    formatTimeUntilDeadline: vi.fn(() => "2h 30m"),
    getTimeUntilDeadline: vi.fn(() => ({
      days: 0,
      hours: 2,
      minutes: 30,
      isPast: false,
    })),
    formatDeadline: vi.fn(() => "Thursday, 26 February, 14:30"),
  };
});

import { formatTimeUntilDeadline, getTimeUntilDeadline } from "@/lib/fpl/utils";

function makeGw(overrides: Partial<Gameweek> = {}): Gameweek {
  return {
    id: 28,
    name: "Gameweek 28",
    deadline_time: "2026-02-26T14:30:00Z",
    deadline_time_epoch: 0,
    deadline_time_game_offset: 0,
    release_time: null,
    average_entry_score: 0,
    finished: false,
    data_checked: false,
    highest_score: null,
    highest_scoring_entry: null,
    is_previous: false,
    is_current: false,
    is_next: true,
    cup_leagues_created: false,
    h2h_ko_matches_created: false,
    ranked_count: 0,
    transfers_made: 0,
    most_selected: null,
    most_transferred_in: null,
    top_element: null,
    top_element_info: null,
    most_captained: null,
    most_vice_captained: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(formatTimeUntilDeadline).mockReturnValue("2h 30m");
  vi.mocked(getTimeUntilDeadline).mockReturnValue({
    days: 0,
    hours: 2,
    minutes: 30,
    isPast: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GameweekBanner", () => {
  it("shows countdown for a future deadline", () => {
    const gw = makeGw();
    render(<GameweekBanner gameweek={gw} />);
    expect(screen.getByText("2h 30m")).toBeInTheDocument();
  });

  it("shows Deadline passed when deadline is in the past", () => {
    vi.mocked(formatTimeUntilDeadline).mockReturnValue("Deadline passed");
    vi.mocked(getTimeUntilDeadline).mockReturnValue({
      days: 0,
      hours: 0,
      minutes: 0,
      isPast: true,
    });
    const gw = makeGw();
    render(<GameweekBanner gameweek={gw} />);
    expect(screen.getByText("Deadline passed")).toBeInTheDocument();
  });

  it("updates countdown after 1 minute", () => {
    const gw = makeGw();
    render(<GameweekBanner gameweek={gw} />);
    expect(screen.getByText("2h 30m")).toBeInTheDocument();

    // Simulate 1 minute passing: update mock to return new value, fire interval
    vi.mocked(formatTimeUntilDeadline).mockReturnValue("2h 29m");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText("2h 29m")).toBeInTheDocument();
  });

  it("shows submitted confirmation when submittedGameweek matches", () => {
    const gw = makeGw();
    render(<GameweekBanner gameweek={gw} submittedGameweek={28} />);
    expect(
      screen.getByText(/team for gameweek 28 submitted/i),
    ).toBeInTheDocument();
  });

  it("does not show submitted confirmation when submittedGameweek is undefined", () => {
    const gw = makeGw();
    render(<GameweekBanner gameweek={gw} />);
    expect(screen.queryByText(/submitted/i)).not.toBeInTheDocument();
  });

  it("does not show submitted confirmation when submittedGameweek is for a different GW", () => {
    const gw = makeGw({ id: 28 });
    render(<GameweekBanner gameweek={gw} submittedGameweek={27} />);
    expect(
      screen.queryByText(/team for gameweek 28 submitted/i),
    ).not.toBeInTheDocument();
  });
});
