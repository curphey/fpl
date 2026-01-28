'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLeagueStandings } from '@/lib/fpl/hooks/use-fpl';
import { useManagerContext } from '@/lib/fpl/manager-context';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export function LeagueStandingsTable({ leagueId }: { leagueId: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useLeagueStandings(leagueId, page);
  const { managerId } = useManagerContext();

  // Reset page when league changes
  const [prevLeagueId, setPrevLeagueId] = useState(leagueId);
  if (leagueId !== prevLeagueId) {
    setPrevLeagueId(leagueId);
    setPage(1);
  }

  if (isLoading && !data) {
    return <TableSkeleton rows={10} />;
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />;
  }

  if (!data) {
    return null;
  }

  const standings = data.standings.results;

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card">
      <div className="flex items-center justify-between border-b border-fpl-border px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fpl-muted">
          {data.league.name}
        </h2>
        <Link
          href={`/leagues/analyze?league=${leagueId}`}
          className="rounded-md bg-fpl-purple-light px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-fpl-border"
        >
          Analyze
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fpl-border text-left text-xs uppercase tracking-wide text-fpl-muted">
              <th className="px-4 py-2 text-right w-12">Rank</th>
              <th className="px-2 py-2 w-12"></th>
              <th className="px-4 py-2">Team</th>
              <th className="hidden px-4 py-2 sm:table-cell">Manager</th>
              <th className="px-4 py-2 text-right">GW</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fpl-border">
            {standings.map((entry) => {
              const isMe = entry.entry === managerId;
              const rankDelta = entry.last_rank - entry.rank;

              return (
                <tr
                  key={entry.id}
                  className={
                    isMe
                      ? 'bg-fpl-green/10'
                      : 'transition-colors hover:bg-fpl-purple-light/50'
                  }
                >
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {entry.rank}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <RankDelta delta={rankDelta} />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={isMe ? 'font-semibold text-fpl-green' : ''}>
                      {entry.entry_name}
                    </span>
                  </td>
                  <td className="hidden px-4 py-2.5 text-fpl-muted sm:table-cell">
                    {entry.player_name}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {entry.event_total}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {entry.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-fpl-border px-4 py-3">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded bg-fpl-purple-light px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-fpl-border disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs text-fpl-muted">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!data.standings.has_next}
          className="rounded bg-fpl-purple-light px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-fpl-border disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function RankDelta({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-xs text-fpl-muted">-</span>;
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-fpl-green">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="mr-0.5">
          <path d="M12 4l-8 8h16z" />
        </svg>
        {delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-semibold text-fpl-danger">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="mr-0.5">
        <path d="M12 20l8-8H4z" />
      </svg>
      {Math.abs(delta)}
    </span>
  );
}
