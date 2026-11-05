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
