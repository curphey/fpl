import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, PositionBadge } from "../badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
  });

  it("applies default variant styling", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge).toHaveClass("bg-fpl-purple-light");
  });

  it("applies green variant styling", () => {
    render(<Badge variant="green">Green</Badge>);
    const badge = screen.getByText("Green");
    expect(badge).toHaveClass("bg-fpl-green/20");
    expect(badge).toHaveClass("text-fpl-green");
  });

  it("applies pink variant styling", () => {
    render(<Badge variant="pink">Pink</Badge>);
    const badge = screen.getByText("Pink");
    expect(badge).toHaveClass("bg-fpl-pink/20");
    expect(badge).toHaveClass("text-fpl-pink");
  });

  it("applies danger variant styling", () => {
    render(<Badge variant="danger">Danger</Badge>);
    const badge = screen.getByText("Danger");
    expect(badge).toHaveClass("bg-fpl-danger/20");
    expect(badge).toHaveClass("text-fpl-danger");
  });

  it("applies position variant styling - GK", () => {
    render(<Badge variant="gk">GK</Badge>);
    const badge = screen.getByText("GK");
    expect(badge).toHaveClass("bg-yellow-500/20");
    expect(badge).toHaveClass("text-yellow-400");
  });

  it("applies position variant styling - DEF", () => {
    render(<Badge variant="def">DEF</Badge>);
    const badge = screen.getByText("DEF");
    expect(badge).toHaveClass("bg-blue-500/20");
    expect(badge).toHaveClass("text-blue-400");
  });

  it("applies position variant styling - MID", () => {
    render(<Badge variant="mid">MID</Badge>);
    const badge = screen.getByText("MID");
    expect(badge).toHaveClass("bg-green-500/20");
    expect(badge).toHaveClass("text-green-400");
  });

  it("applies position variant styling - FWD", () => {
    render(<Badge variant="fwd">FWD</Badge>);
    const badge = screen.getByText("FWD");
    expect(badge).toHaveClass("bg-red-500/20");
    expect(badge).toHaveClass("text-red-400");
  });

  it("applies custom className", () => {
    render(<Badge className="custom-class">Custom</Badge>);
    const badge = screen.getByText("Custom");
    expect(badge).toHaveClass("custom-class");
  });

  it("has correct base styling", () => {
    render(<Badge>Base</Badge>);
    const badge = screen.getByText("Base");
    expect(badge).toHaveClass("inline-flex");
    expect(badge).toHaveClass("items-center");
    expect(badge).toHaveClass("rounded-full");
    expect(badge).toHaveClass("px-2");
    expect(badge).toHaveClass("py-0.5");
    expect(badge).toHaveClass("text-xs");
    expect(badge).toHaveClass("font-medium");
  });

  it("falls back to default for unknown variant", () => {
    // @ts-expect-error Testing invalid variant
    render(<Badge variant="unknown">Unknown</Badge>);
    const badge = screen.getByText("Unknown");
    expect(badge).toHaveClass("bg-fpl-purple-light");
  });
});

describe("PositionBadge", () => {
  it("renders label text", () => {
    render(<PositionBadge position={1} label="GK" />);
    expect(screen.getByText("GK")).toBeInTheDocument();
  });

  it("maps position 1 to goalkeeper variant", () => {
    render(<PositionBadge position={1} label="GK" />);
    const badge = screen.getByText("GK");
    expect(badge).toHaveClass("bg-yellow-500/20");
  });

  it("maps position 2 to defender variant", () => {
    render(<PositionBadge position={2} label="DEF" />);
    const badge = screen.getByText("DEF");
    expect(badge).toHaveClass("bg-blue-500/20");
  });

  it("maps position 3 to midfielder variant", () => {
    render(<PositionBadge position={3} label="MID" />);
    const badge = screen.getByText("MID");
    expect(badge).toHaveClass("bg-green-500/20");
  });

  it("maps position 4 to forward variant", () => {
    render(<PositionBadge position={4} label="FWD" />);
    const badge = screen.getByText("FWD");
    expect(badge).toHaveClass("bg-red-500/20");
  });

  it("falls back to default for unknown position", () => {
    render(<PositionBadge position={99} label="???" />);
    const badge = screen.getByText("???");
    expect(badge).toHaveClass("bg-fpl-purple-light");
  });
});
