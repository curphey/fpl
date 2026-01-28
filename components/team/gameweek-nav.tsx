export function GameweekNav({
  gameweekName,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  gameweekName: string;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className="rounded-md p-1.5 text-fpl-muted transition-colors hover:bg-fpl-border hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fpl-muted"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <span className="min-w-[10rem] text-center text-sm font-semibold">
        {gameweekName}
      </span>

      <button
        onClick={onNext}
        disabled={!hasNext}
        className="rounded-md p-1.5 text-fpl-muted transition-colors hover:bg-fpl-border hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fpl-muted"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
