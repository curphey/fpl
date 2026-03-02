import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransferTracker } from "../transfer-tracker";
import type { TransferPrediction } from "@/lib/db/gw-plan";

function makePrediction(
  overrides: Partial<TransferPrediction> = {},
): TransferPrediction {
  return {
    id: "pred1",
    sessionId: "sess1",
    gameweekMade: 25,
    playerOutId: 100,
    playerOutName: "Saka",
    playerInId: 200,
    playerInName: "Salah",
    predictedGainPts: 8.2,
    actualGainPts: null,
    gwActuals: {},
    status: "pending",
    reasoning: "Great fixtures",
    trackingNotes: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

describe("TransferTracker", () => {
  it("renders nothing when predictions array is empty", () => {
    const { container } = render(<TransferTracker predictions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the section heading when predictions exist", () => {
    render(<TransferTracker predictions={[makePrediction()]} />);
    expect(screen.getByText("Transfer Tracker")).toBeInTheDocument();
  });

  it("shows player names in OUT to IN format", () => {
    render(<TransferTracker predictions={[makePrediction()]} />);
    expect(screen.getByText("Saka")).toBeInTheDocument();
    expect(screen.getByText("Salah")).toBeInTheDocument();
  });

  it("shows predicted gain rounded to whole number", () => {
    render(
      <TransferTracker
        predictions={[makePrediction({ predictedGainPts: 8.2 })]}
      />,
    );
    expect(screen.getByText(/\+8 pts predicted/)).toBeInTheDocument();
  });

  it("shows 'pending' status badge for pending predictions", () => {
    render(
      <TransferTracker predictions={[makePrediction({ status: "pending" })]} />,
    );
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("shows 'on track' status badge for on_track predictions", () => {
    render(
      <TransferTracker
        predictions={[makePrediction({ status: "on_track" })]}
      />,
    );
    expect(screen.getByText("on track")).toBeInTheDocument();
  });

  it("shows 'hit' status badge for hit predictions", () => {
    render(
      <TransferTracker predictions={[makePrediction({ status: "hit" })]} />,
    );
    expect(screen.getByText("hit")).toBeInTheDocument();
  });

  it("shows 'miss' status badge for miss predictions", () => {
    render(
      <TransferTracker predictions={[makePrediction({ status: "miss" })]} />,
    );
    expect(screen.getByText("miss")).toBeInTheDocument();
  });

  it("shows tracking notes for miss predictions", () => {
    render(
      <TransferTracker
        predictions={[
          makePrediction({
            status: "miss",
            trackingNotes: "Player was suspended in GW26",
          }),
        ]}
      />,
    );
    expect(
      screen.getByText("Player was suspended in GW26"),
    ).toBeInTheDocument();
  });

  it("shows actual gain rounded to whole number when available", () => {
    render(
      <TransferTracker
        predictions={[makePrediction({ actualGainPts: 6.5 })]}
      />,
    );
    expect(screen.getByText(/actual: 7/)).toBeInTheDocument();
  });

  it("shows gameweek made", () => {
    render(
      <TransferTracker predictions={[makePrediction({ gameweekMade: 25 })]} />,
    );
    expect(screen.getByText(/GW25/)).toBeInTheDocument();
  });
});
