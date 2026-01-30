import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardContent } from "../card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("has correct base styling", () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("rounded-lg");
    expect(card).toHaveClass("border");
    expect(card).toHaveClass("border-fpl-border");
    expect(card).toHaveClass("bg-fpl-card");
    expect(card).toHaveClass("p-4");
  });

  it("applies custom className", () => {
    render(<Card className="mt-4 custom">Content</Card>);
    const card = screen.getByText("Content").closest("div.rounded-lg");
    expect(card).toHaveClass("mt-4");
    expect(card).toHaveClass("custom");
  });

  it("renders nested children", () => {
    render(
      <Card>
        <span data-testid="nested">Nested content</span>
      </Card>,
    );
    expect(screen.getByTestId("nested")).toBeInTheDocument();
  });
});

describe("CardHeader", () => {
  it("renders children", () => {
    render(<CardHeader>Header content</CardHeader>);
    expect(screen.getByText("Header content")).toBeInTheDocument();
  });

  it("has margin-bottom styling", () => {
    render(<CardHeader>Header</CardHeader>);
    const header = screen.getByText("Header");
    expect(header).toHaveClass("mb-3");
  });

  it("applies custom className", () => {
    render(<CardHeader className="text-center">Header</CardHeader>);
    const header = screen.getByText("Header");
    expect(header).toHaveClass("text-center");
    expect(header).toHaveClass("mb-3");
  });
});

describe("CardTitle", () => {
  it("renders children", () => {
    render(<CardTitle>Title text</CardTitle>);
    expect(screen.getByText("Title text")).toBeInTheDocument();
  });

  it("renders as h3 element", () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByRole("heading", { level: 3 });
    expect(title).toHaveTextContent("Title");
  });

  it("has correct styling", () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByText("Title");
    expect(title).toHaveClass("text-sm");
    expect(title).toHaveClass("font-semibold");
    expect(title).toHaveClass("text-fpl-muted");
    expect(title).toHaveClass("uppercase");
    expect(title).toHaveClass("tracking-wide");
  });

  it("applies custom className", () => {
    render(<CardTitle className="text-lg">Title</CardTitle>);
    const title = screen.getByText("Title");
    expect(title).toHaveClass("text-lg");
  });
});

describe("CardContent", () => {
  it("renders children", () => {
    render(<CardContent>Content text</CardContent>);
    expect(screen.getByText("Content text")).toBeInTheDocument();
  });

  it("renders as div element", () => {
    const { container } = render(<CardContent>Content</CardContent>);
    const content = container.firstChild as HTMLElement;
    expect(content.tagName).toBe("DIV");
  });

  it("applies custom className", () => {
    render(<CardContent className="space-y-4">Content</CardContent>);
    const content = screen.getByText("Content");
    expect(content).toHaveClass("space-y-4");
  });
});

describe("Card composition", () => {
  it("renders full card with all subcomponents", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
        </CardHeader>
        <CardContent>Test content body</CardContent>
      </Card>,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test content body")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Test Title",
    );
  });
});
