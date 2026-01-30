/**
 * Error type detection for user-friendly messages.
 */
type ErrorContext = "manager" | "league" | "player" | "generic";

interface ParsedError {
  title: string;
  description: string;
  suggestion?: string;
}

/**
 * Parse error message and return contextual user-friendly content.
 */
function parseError(message: string, context?: ErrorContext): ParsedError {
  const lowerMsg = message.toLowerCase();

  // Network/connectivity errors
  if (
    lowerMsg.includes("failed to fetch") ||
    lowerMsg.includes("network") ||
    lowerMsg.includes("offline") ||
    lowerMsg.includes("err_internet_disconnected")
  ) {
    return {
      title: "Connection issue",
      description: "Check your internet connection.",
      suggestion:
        "Make sure you have a stable internet connection and try again.",
    };
  }

  // Timeout errors
  if (lowerMsg.includes("timeout") || lowerMsg.includes("timed out")) {
    return {
      title: "Request timed out",
      description: "FPL servers are slow. Try again in a moment.",
      suggestion:
        "The Fantasy Premier League servers may be experiencing high traffic.",
    };
  }

  // 404 Not Found errors
  if (lowerMsg.includes("404") || lowerMsg.includes("not found")) {
    switch (context) {
      case "manager":
        return {
          title: "Manager not found",
          description: "This manager ID doesn't exist.",
          suggestion: "Double-check the manager ID and try again.",
        };
      case "league":
        return {
          title: "League not found",
          description: "This league doesn't exist or is private.",
          suggestion: "Make sure you have the correct league ID.",
        };
      case "player":
        return {
          title: "Player not found",
          description: "This player doesn't exist.",
          suggestion: "The player may have been removed from the game.",
        };
      default:
        return {
          title: "Not found",
          description: "The requested resource could not be found.",
        };
    }
  }

  // Server errors (500, 502, 503, etc.)
  if (
    lowerMsg.includes("500") ||
    lowerMsg.includes("502") ||
    lowerMsg.includes("503") ||
    lowerMsg.includes("server error")
  ) {
    return {
      title: "Server error",
      description: "FPL servers are having issues.",
      suggestion: "This is usually temporary. Try again in a few minutes.",
    };
  }

  // Rate limiting
  if (
    lowerMsg.includes("429") ||
    lowerMsg.includes("rate limit") ||
    lowerMsg.includes("too many requests")
  ) {
    return {
      title: "Too many requests",
      description: "You're making requests too quickly.",
      suggestion: "Wait a moment before trying again.",
    };
  }

  // Unauthorized
  if (lowerMsg.includes("401") || lowerMsg.includes("unauthorized")) {
    return {
      title: "Authentication required",
      description: "Please sign in to access this feature.",
    };
  }

  // Default fallback
  return {
    title: "Something went wrong",
    description: message || "An unexpected error occurred.",
    suggestion: "Try refreshing the page or come back later.",
  };
}

export function ErrorState({
  message,
  context,
  onRetry,
}: {
  message: string;
  context?: ErrorContext;
  onRetry?: () => void;
}) {
  const { title, description, suggestion } = parseError(message, context);

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-fpl-danger/30 bg-fpl-card p-8 text-center">
      <p className="text-lg font-semibold text-fpl-danger">{title}</p>
      <p className="mt-1 text-sm text-fpl-muted">{description}</p>
      {suggestion && (
        <p className="mt-2 text-xs text-fpl-muted/70">{suggestion}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-fpl-purple-light px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-fpl-border"
        >
          Try again
        </button>
      )}
    </div>
  );
}
