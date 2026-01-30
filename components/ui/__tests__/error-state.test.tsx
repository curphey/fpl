import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorState } from "../error-state";

describe("ErrorState", () => {
  describe("error parsing", () => {
    it("handles network errors", () => {
      render(<ErrorState message="Failed to fetch" />);
      expect(screen.getByText("Connection issue")).toBeInTheDocument();
      expect(
        screen.getByText("Check your internet connection."),
      ).toBeInTheDocument();
    });

    it("handles offline errors", () => {
      render(<ErrorState message="You are offline" />);
      expect(screen.getByText("Connection issue")).toBeInTheDocument();
    });

    it("handles timeout errors", () => {
      render(<ErrorState message="Request timed out" />);
      expect(screen.getByText("Request timed out")).toBeInTheDocument();
      expect(
        screen.getByText("FPL servers are slow. Try again in a moment."),
      ).toBeInTheDocument();
    });

    it("handles 404 errors with manager context", () => {
      render(<ErrorState message="404 Not Found" context="manager" />);
      expect(screen.getByText("Manager not found")).toBeInTheDocument();
      expect(
        screen.getByText("This manager ID doesn't exist."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Double-check the manager ID and try again."),
      ).toBeInTheDocument();
    });

    it("handles 404 errors with league context", () => {
      render(<ErrorState message="not found" context="league" />);
      expect(screen.getByText("League not found")).toBeInTheDocument();
      expect(
        screen.getByText("This league doesn't exist or is private."),
      ).toBeInTheDocument();
    });

    it("handles 404 errors with player context", () => {
      render(<ErrorState message="404" context="player" />);
      expect(screen.getByText("Player not found")).toBeInTheDocument();
      expect(
        screen.getByText("This player doesn't exist."),
      ).toBeInTheDocument();
    });

    it("handles 404 errors with generic context", () => {
      render(<ErrorState message="404 not found" context="generic" />);
      expect(screen.getByText("Not found")).toBeInTheDocument();
    });

    it("handles 500 server errors", () => {
      render(<ErrorState message="500 Internal Server Error" />);
      expect(screen.getByText("Server error")).toBeInTheDocument();
      expect(
        screen.getByText("FPL servers are having issues."),
      ).toBeInTheDocument();
    });

    it("handles 502 errors", () => {
      render(<ErrorState message="502 Bad Gateway" />);
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    it("handles 503 errors", () => {
      render(<ErrorState message="503 Service Unavailable" />);
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    it("handles rate limiting (429)", () => {
      render(<ErrorState message="429 Too Many Requests" />);
      expect(screen.getByText("Too many requests")).toBeInTheDocument();
      expect(
        screen.getByText("You're making requests too quickly."),
      ).toBeInTheDocument();
    });

    it("handles rate limit message", () => {
      render(<ErrorState message="Rate limit exceeded" />);
      expect(screen.getByText("Too many requests")).toBeInTheDocument();
    });

    it("handles 401 unauthorized", () => {
      render(<ErrorState message="401 Unauthorized" />);
      expect(screen.getByText("Authentication required")).toBeInTheDocument();
      expect(
        screen.getByText("Please sign in to access this feature."),
      ).toBeInTheDocument();
    });

    it("handles unknown errors with fallback", () => {
      render(<ErrorState message="Something unexpected happened" />);
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(
        screen.getByText("Something unexpected happened"),
      ).toBeInTheDocument();
    });

    it("handles empty message with fallback", () => {
      render(<ErrorState message="" />);
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(
        screen.getByText("An unexpected error occurred."),
      ).toBeInTheDocument();
    });
  });

  describe("retry button", () => {
    it("renders retry button when onRetry provided", () => {
      render(<ErrorState message="Error" onRetry={() => {}} />);
      expect(
        screen.getByRole("button", { name: "Try again" }),
      ).toBeInTheDocument();
    });

    it("does not render retry button when onRetry not provided", () => {
      render(<ErrorState message="Error" />);
      expect(
        screen.queryByRole("button", { name: "Try again" }),
      ).not.toBeInTheDocument();
    });

    it("calls onRetry when button clicked", () => {
      const mockOnRetry = vi.fn();
      render(<ErrorState message="Error" onRetry={mockOnRetry} />);

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it("retry button has correct styling", () => {
      render(<ErrorState message="Error" onRetry={() => {}} />);
      const button = screen.getByRole("button", { name: "Try again" });
      expect(button).toHaveClass("rounded-lg");
      expect(button).toHaveClass("bg-fpl-purple-light");
      expect(button).toHaveClass("px-4");
      expect(button).toHaveClass("py-2");
    });
  });

  describe("styling", () => {
    it("has correct container styling", () => {
      const { container } = render(<ErrorState message="Error" />);
      const errorDiv = container.firstChild;
      expect(errorDiv).toHaveClass("flex");
      expect(errorDiv).toHaveClass("flex-col");
      expect(errorDiv).toHaveClass("items-center");
      expect(errorDiv).toHaveClass("justify-center");
      expect(errorDiv).toHaveClass("rounded-lg");
      expect(errorDiv).toHaveClass("border");
      expect(errorDiv).toHaveClass("border-fpl-danger/30");
    });

    it("title has danger styling", () => {
      render(<ErrorState message="Error" />);
      const title = screen.getByText("Something went wrong");
      expect(title).toHaveClass("text-lg");
      expect(title).toHaveClass("font-semibold");
      expect(title).toHaveClass("text-fpl-danger");
    });

    it("description has muted styling", () => {
      render(<ErrorState message="Custom error message" />);
      const description = screen.getByText("Custom error message");
      expect(description).toHaveClass("text-sm");
      expect(description).toHaveClass("text-fpl-muted");
    });
  });

  describe("suggestion display", () => {
    it("displays suggestion when available", () => {
      render(<ErrorState message="network error" />);
      expect(
        screen.getByText(
          "Make sure you have a stable internet connection and try again.",
        ),
      ).toBeInTheDocument();
    });

    it("suggestion has subtle styling", () => {
      render(<ErrorState message="network error" />);
      const suggestion = screen.getByText(
        "Make sure you have a stable internet connection and try again.",
      );
      expect(suggestion).toHaveClass("text-xs");
      expect(suggestion).toHaveClass("text-fpl-muted/70");
    });
  });
});
