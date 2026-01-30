import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "../stat-card";

describe("StatCard", () => {
  it("renders label", () => {
    render(<StatCard label="Total Points" value={1500} />);
    expect(screen.getByText("Total Points")).toBeInTheDocument();
  });

  it("renders numeric value", () => {
    render(<StatCard label="Points" value={1500} />);
    expect(screen.getByText("1500")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<StatCard label="Rank" value="50,000" />);
    expect(screen.getByText("50,000")).toBeInTheDocument();
  });

  it("renders subvalue when provided", () => {
    render(<StatCard label="Points" value={1500} subvalue="Top 10%" />);
    expect(screen.getByText("Top 10%")).toBeInTheDocument();
  });

  it("does not render subvalue when not provided", () => {
    render(<StatCard label="Points" value={1500} />);
    const elements = screen.queryAllByText(/Top/);
    expect(elements).toHaveLength(0);
  });

  it("applies custom className", () => {
    const { container } = render(
      <StatCard label="Points" value={100} className="mt-4" />,
    );
    const card = container.querySelector(".rounded-lg");
    expect(card).toHaveClass("mt-4");
  });

  it("label has correct styling", () => {
    render(<StatCard label="Total Points" value={100} />);
    const label = screen.getByText("Total Points");
    expect(label).toHaveClass("text-xs");
    expect(label).toHaveClass("font-semibold");
    expect(label).toHaveClass("uppercase");
    expect(label).toHaveClass("tracking-wide");
    expect(label).toHaveClass("text-fpl-muted");
  });

  it("value has correct styling", () => {
    render(<StatCard label="Points" value={1500} />);
    const value = screen.getByText("1500");
    expect(value).toHaveClass("text-2xl");
    expect(value).toHaveClass("font-bold");
    expect(value).toHaveClass("text-fpl-green");
  });

  it("subvalue has correct styling when present", () => {
    render(<StatCard label="Points" value={100} subvalue="Weekly rank" />);
    const subvalue = screen.getByText("Weekly rank");
    expect(subvalue).toHaveClass("text-xs");
    expect(subvalue).toHaveClass("text-fpl-muted");
  });

  it("handles zero value", () => {
    render(<StatCard label="Transfers" value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles negative value", () => {
    render(<StatCard label="Point Hit" value={-4} />);
    expect(screen.getByText("-4")).toBeInTheDocument();
  });

  it("handles decimal value", () => {
    render(<StatCard label="Price" value={10.5} />);
    expect(screen.getByText("10.5")).toBeInTheDocument();
  });

  it("renders inside a Card component", () => {
    const { container } = render(<StatCard label="Test" value={100} />);
    const card = container.querySelector(".rounded-lg.border.bg-fpl-card");
    expect(card).toBeInTheDocument();
  });
});
