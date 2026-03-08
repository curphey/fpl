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

  it("shows predicted gain with 'over 4 GWs' context", () => {
    render(
      <TransferTracker
        predictions={[makePrediction({ predictedGainPts: 8.2 })]}
      />,
    );
    expect(screen.getByText(/\+8\.2 pts/)).toBeInTheDocument();
    expect(screen.getByText(/over 4 GWs/)).toBeInTheDocument();
  });

  it("shows 'Tracking' status badge for pending predictions", () => {
    render(
      <TransferTracker predictions={[makePrediction({ status: "pending" })]} />,
    );
    expect(screen.getByText("Tracking")).toBeInTheDocument();
  });

  it("shows 'On Track' status badge for on_track predictions", () => {
    render(
      <TransferTracker
        predictions={[makePrediction({ status: "on_track" })]}
      />,
    );
    expect(screen.getByText("On Track")).toBeInTheDocument();
  });

  it("shows 'Hit' status badge for hit predictions", () => {
    render(
      <TransferTracker predictions={[makePrediction({ status: "hit" })]} />,
    );
    expect(screen.getByText("Hit")).toBeInTheDocument();
  });

  it("shows 'Miss' status badge for miss predictions", () => {
    render(
      <TransferTracker predictions={[makePrediction({ status: "miss" })]} />,
    );
    expect(screen.getByText("Miss")).toBeInTheDocument();
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

  it("shows result section with predicted vs actual when actual data exists", () => {
    render(
      <TransferTracker
        predictions={[
          makePrediction({
            actualGainPts: 6.5,
            predictedGainPts: 8,
            status: "on_track",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("+6.5")).toBeInTheDocument();
  });

  it("shows 'Final Result' label for completed predictions", () => {
    render(
      <TransferTracker
        predictions={[
          makePrediction({
            actualGainPts: 9,
            predictedGainPts: 10,
            status: "hit",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Final Result")).toBeInTheDocument();
  });

  it("shows accuracy percentage when actual data exists", () => {
    render(
      <TransferTracker
        predictions={[
          makePrediction({
            actualGainPts: -1,
            predictedGainPts: 8,
            status: "miss",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Accuracy")).toBeInTheDocument();
    expect(screen.getByText("-12%")).toBeInTheDocument();
  });

  it("shows per-GW breakdown when gwActuals has data", () => {
    render(
      <TransferTracker
        predictions={[
          makePrediction({
            gwActuals: { "26": 5, "27": -2 },
            actualGainPts: 3,
            status: "on_track",
          }),
        ]}
      />,
    );
    expect(screen.getByText("GW26")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.getByText("GW27")).toBeInTheDocument();
    expect(screen.getByText("-2")).toBeInTheDocument();
  });

  it("shows gameweek made in context line", () => {
    render(
      <TransferTracker predictions={[makePrediction({ gameweekMade: 25 })]} />,
    );
    expect(screen.getByText(/GW25/)).toBeInTheDocument();
  });

  it("shows summary stats when completed predictions exist", () => {
    render(
      <TransferTracker
        predictions={[
          makePrediction({
            id: "p1",
            status: "hit",
            actualGainPts: 10,
            predictedGainPts: 10,
          }),
          makePrediction({
            id: "p2",
            status: "miss",
            actualGainPts: -2,
            predictedGainPts: 8,
          }),
        ]}
      />,
    );
    expect(screen.getByText("1/2 accurate")).toBeInTheDocument();
  });
});
