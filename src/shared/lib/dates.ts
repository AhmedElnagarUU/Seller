const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// Formats a date like "Oct 27, 2026" (UTC).
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

// Formats a date and time like "Oct 27, 2026, 14:05" (UTC, 24-hour clock).
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
