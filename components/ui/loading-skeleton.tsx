export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-fpl-purple-light ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="mb-1 h-8 w-20" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
      <Skeleton className="mb-4 h-4 w-32" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Banner skeleton */}
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-6">
        <Skeleton className="mb-2 h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Tables skeleton */}
      <div className="grid gap-6 xl:grid-cols-2">
        <TableSkeleton />
        <TableSkeleton />
      </div>
    </div>
  );
}

function PlayerCardSkeleton() {
  return (
    <div className="flex w-16 flex-col items-center gap-1 sm:w-20">
      <Skeleton className="h-12 w-12 rounded-lg sm:h-14 sm:w-14" />
      <Skeleton className="h-3 w-14 sm:w-16" />
      <Skeleton className="h-4 w-6" />
    </div>
  );
}

/**
 * Pitch-style skeleton for My Team page.
 * Shows 4 rows representing GK, DEF, MID, FWD positions plus bench.
 */
export function PitchSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Gameweek nav skeleton */}
      <div className="flex items-center justify-center gap-4">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>

      {/* Summary skeleton */}
      <div className="grid grid-cols-4 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Pitch skeleton */}
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
        <div className="flex flex-col items-center gap-4">
          {/* GK row (1 player) */}
          <div className="flex justify-center gap-3">
            <PlayerCardSkeleton />
          </div>
          {/* DEF row (4 players) */}
          <div className="flex justify-center gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <PlayerCardSkeleton key={`def-${i}`} />
            ))}
          </div>
          {/* MID row (4 players) */}
          <div className="flex justify-center gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <PlayerCardSkeleton key={`mid-${i}`} />
            ))}
          </div>
          {/* FWD row (2 players) */}
          <div className="flex justify-center gap-3">
            <PlayerCardSkeleton />
            <PlayerCardSkeleton />
          </div>
        </div>

        {/* Bench skeleton */}
        <div className="mt-6 border-t border-fpl-border pt-4">
          <Skeleton className="mx-auto mb-3 h-3 w-16" />
          <div className="flex justify-center gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <PlayerCardSkeleton key={`bench-${i}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Grid skeleton for Fixture Planner page.
 * Shows a table with team rows and gameweek columns.
 */
export function FixtureGridSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-32 rounded" />
      </div>

      {/* Grid skeleton */}
      <div className="overflow-x-auto rounded-lg border border-fpl-border bg-fpl-card">
        <div className="min-w-[800px] p-4">
          {/* Header row */}
          <div className="mb-2 flex gap-2 border-b border-fpl-border pb-2">
            <Skeleton className="h-4 w-24 shrink-0" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={`header-${i}`} className="h-4 w-12 shrink-0" />
            ))}
          </div>
          {/* Team rows */}
          {Array.from({ length: 10 }).map((_, rowIdx) => (
            <div key={`row-${rowIdx}`} className="flex gap-2 py-2">
              <Skeleton className="h-6 w-24 shrink-0" />
              {Array.from({ length: 6 }).map((_, colIdx) => (
                <Skeleton
                  key={`cell-${rowIdx}-${colIdx}`}
                  className="h-6 w-12 shrink-0 rounded"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Standings table skeleton for Leagues page.
 * Shows league header and ranked list of managers.
 */
export function LeagueStandingsSkeleton() {
  return (
    <div className="space-y-6">
      {/* League header */}
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
        <Skeleton className="mb-2 h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Standings table */}
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
        {/* Table header */}
        <div className="mb-3 flex items-center gap-4 border-b border-fpl-border pb-3">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
        {/* Standings rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Skeleton className="h-5 w-8" />
            <div className="flex-1">
              <Skeleton className="mb-1 h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
