import { CHANGE_TYPE_LABELS, type ChangeType } from "@/features/versions/version.constants";

const MAX_CHANGE_LINES = 10;

// One line per change, "<Label>: <text>" (docs/09-emails.md section 3, #7). At most 10 lines;
// with more changes the last line is "…and <n> more changes."
export function formatChangeLines(changes: { type: ChangeType; text: string }[]): string[] {
  const lines = changes
    .slice(0, MAX_CHANGE_LINES)
    .map((change) => `${CHANGE_TYPE_LABELS[change.type]}: ${change.text}`);
  if (changes.length > MAX_CHANGE_LINES) lines.push(`…and ${changes.length - MAX_CHANGE_LINES} more changes.`);
  return lines;
}
