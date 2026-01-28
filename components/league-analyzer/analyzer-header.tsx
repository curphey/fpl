'use client';

type RivalCount = 5 | 10 | 20;

export function AnalyzerHeader({
  leagueName,
  userRank,
  rivalCount,
  onRivalCountChange,
  isLoading,
  progress,
}: {
  leagueName: string;
  userRank: number | null;
  rivalCount: RivalCount;
  onRivalCountChange: (count: RivalCount) => void;
  isLoading: boolean;
  progress: { loaded: number; total: number };
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">League Analyzer</h1>
          <p className="text-sm text-fpl-muted">
            {leagueName}
            {userRank !== null && <span> &middot; Your rank: #{userRank}</span>}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs text-fpl-muted">Rivals:</span>
          {([5, 10, 20] as const).map((n) => (
            <button
              key={n}
              onClick={() => onRivalCountChange(n)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                rivalCount === n
                  ? 'bg-fpl-green/20 text-fpl-green'
                  : 'bg-fpl-card text-fpl-muted hover:text-foreground'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {isLoading && progress.total > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-fpl-purple-light">
            <div
              className="h-full rounded-full bg-fpl-green transition-all duration-300"
              style={{
                width: `${(progress.loaded / progress.total) * 100}%`,
              }}
            />
          </div>
          <p className="text-xs text-fpl-muted">
            Loading {progress.loaded}/{progress.total} rivals...
          </p>
        </div>
      )}
    </div>
  );
}
