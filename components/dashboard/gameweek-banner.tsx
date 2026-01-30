import Link from "next/link";
import type { Gameweek } from "@/lib/fpl/types";
import {
  formatDeadline,
  formatTimeUntilDeadline,
  getTimeUntilDeadline,
} from "@/lib/fpl/utils";
import { AddToCalendar } from "./add-to-calendar";

function getUrgencyLevel(
  deadline: string,
): "normal" | "warning" | "urgent" | "passed" {
  const { days, hours, isPast } = getTimeUntilDeadline(deadline);

  if (isPast) return "passed";

  const totalHours = days * 24 + hours;
  if (totalHours < 6) return "urgent";
  if (totalHours < 24) return "warning";
  return "normal";
}

function getUrgencyStyles(urgency: "normal" | "warning" | "urgent" | "passed") {
  switch (urgency) {
    case "urgent":
      return "text-red-400 animate-pulse";
    case "warning":
      return "text-yellow-400";
    case "passed":
      return "text-fpl-muted";
    default:
      return "text-fpl-green";
  }
}

export function GameweekBanner({ gameweek }: { gameweek: Gameweek }) {
  const timeLeft = formatTimeUntilDeadline(gameweek.deadline_time);
  const deadline = formatDeadline(gameweek.deadline_time);
  const urgency = getUrgencyLevel(gameweek.deadline_time);
  const urgencyStyles = getUrgencyStyles(urgency);
  const showReminderCTA = urgency === "normal" || urgency === "warning";

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-purple p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            {gameweek.name}
          </h2>
          <p className="mt-0.5 text-sm text-fpl-muted">Deadline: {deadline}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-fpl-muted">Time left</p>
            <p className={`text-lg font-bold ${urgencyStyles}`}>{timeLeft}</p>
            {showReminderCTA && (
              <Link
                href="/notifications"
                className="text-xs text-fpl-cyan hover:underline"
              >
                Get reminders
              </Link>
            )}
          </div>
          {urgency !== "passed" && (
            <AddToCalendar
              gameweekName={gameweek.name}
              deadlineTime={gameweek.deadline_time}
            />
          )}
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
