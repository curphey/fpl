import type { Gameweek } from '@/lib/fpl/types';
import { formatDeadline, formatTimeUntilDeadline } from '@/lib/fpl/utils';

export function GameweekBanner({ gameweek }: { gameweek: Gameweek }) {
  const timeLeft = formatTimeUntilDeadline(gameweek.deadline_time);
  const deadline = formatDeadline(gameweek.deadline_time);

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-purple p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            {gameweek.name}
          </h2>
          <p className="mt-0.5 text-sm text-fpl-muted">
            Deadline: {deadline}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-fpl-muted">Time left</p>
            <p className="text-lg font-bold text-fpl-green">{timeLeft}</p>
          </div>
          {gameweek.finished && (
            <>
              <div className="text-right">
                <p className="text-xs text-fpl-muted">Average</p>
                <p className="text-lg font-bold text-foreground">
                  {gameweek.average_entry_score}
                </p>
              </div>
              {gameweek.highest_score !== null && (
                <div className="text-right">
                  <p className="text-xs text-fpl-muted">Highest</p>
                  <p className="text-lg font-bold text-foreground">
                    {gameweek.highest_score}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
