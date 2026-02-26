"use client";

import { useState, useEffect } from "react";
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

export interface GameweekBannerProps {
  gameweek: Gameweek;
  /** Set to the GW number when transfers have been successfully submitted. */
  submittedGameweek?: number;
}

export function GameweekBanner({
  gameweek,
  submittedGameweek,
}: GameweekBannerProps) {
  const [timeLeft, setTimeLeft] = useState(() =>
    formatTimeUntilDeadline(gameweek.deadline_time),
  );
  const [urgency, setUrgency] = useState(() =>
    getUrgencyLevel(gameweek.deadline_time),
  );

  // Update countdown every minute
  useEffect(() => {
    const tick = () => {
      setTimeLeft(formatTimeUntilDeadline(gameweek.deadline_time));
      setUrgency(getUrgencyLevel(gameweek.deadline_time));
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [gameweek.deadline_time]);

  const deadline = formatDeadline(gameweek.deadline_time);
  const urgencyStyles = getUrgencyStyles(urgency);
  const showReminderCTA = urgency === "normal" || urgency === "warning";
  const isSubmitted = submittedGameweek === gameweek.id;

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-purple p-4 sm:p-6">
      {isSubmitted && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-fpl-green/20 px-3 py-2 text-sm font-semibold text-fpl-green">
          <span>✓</span>
          <span>Team for Gameweek {gameweek.id} submitted</span>
        </div>
      )}
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
