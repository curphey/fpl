import type { PriceChangeCandidate } from "@/lib/fpl/price-model";
import { getPlayerDisplayName } from "@/lib/fpl/utils";

interface PriceAlertBannerProps {
  fallers: PriceChangeCandidate[];
}

export function PriceAlertBanner({ fallers }: PriceAlertBannerProps) {
  if (fallers.length === 0) return null;

  const playerList = fallers
    .slice(0, 3)
    .map(
      (c) =>
        `${getPlayerDisplayName(c.player)} (${Math.round(c.probability * 100)}%)`,
    )
    .join(", ");

  const remaining = fallers.length > 3 ? ` +${fallers.length - 3} more` : "";

  return (
    <div className="rounded-lg border border-fpl-danger/30 bg-fpl-danger/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fpl-danger/20">
          <svg
            className="h-4 w-4 text-fpl-danger"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fpl-danger">
            Squad Price Alert
          </h4>
          <p className="mt-1 text-sm text-fpl-muted">
            {fallers.length === 1 ? "1 player" : `${fallers.length} players`} in
            your squad {fallers.length === 1 ? "is" : "are"} likely to fall
            tonight:{" "}
            <span className="text-foreground">
              {playerList}
              {remaining}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
