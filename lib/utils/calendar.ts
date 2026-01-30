/**
 * Calendar link generation utilities for FPL deadlines.
 */

export interface CalendarEvent {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
}

/**
 * Generate Google Calendar URL for an event.
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const formatDate = (date: Date) =>
    date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    details: event.description,
    dates: `${formatDate(event.startTime)}/${formatDate(event.endTime)}`,
  });

  if (event.location) {
    params.set("location", event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate ICS file content for calendar download.
 */
export function generateICSContent(event: CalendarEvent): string {
  const formatDate = (date: Date) =>
    date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const escapeText = (text: string) =>
    text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FPL Insights//NONSGML v1.0//EN",
    "BEGIN:VEVENT",
    `DTSTART:${formatDate(event.startTime)}`,
    `DTEND:${formatDate(event.endTime)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `UID:${Date.now()}@fpl-insights`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

/**
 * Trigger download of an ICS file.
 */
export function downloadICSFile(event: CalendarEvent, filename: string): void {
  const content = generateICSContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Create a calendar event for an FPL gameweek deadline.
 */
export function createDeadlineEvent(
  gameweekName: string,
  deadlineTime: string,
): CalendarEvent {
  const startTime = new Date(deadlineTime);
  // Set reminder 1 hour before deadline
  startTime.setHours(startTime.getHours() - 1);

  const endTime = new Date(deadlineTime);

  return {
    title: `FPL ${gameweekName} Deadline`,
    description: `Fantasy Premier League ${gameweekName} deadline. Make your transfers and set your team before time runs out!`,
    startTime,
    endTime,
    location: "https://fantasy.premierleague.com",
  };
}
