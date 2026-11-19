import { describe, expect, it } from "vitest";
import { formatChangeLines } from "@/features/emails/email.format";

function buildChanges(count: number) {
  return Array.from({ length: count }, (_, index) => ({ type: "new" as const, text: `Change ${index + 1}` }));
}

describe("formatChangeLines", () => {
  it("writes one line per change with the label of its type", () => {
    const lines = formatChangeLines([
      { type: "new", text: "Added dark mode" },
      { type: "improved", text: "Faster pages" },
      { type: "fixed", text: "Fixed the footer" },
      { type: "removed", text: "Removed the old widget" },
    ]);

    expect(lines).toEqual([
      "New: Added dark mode",
      "Improved: Faster pages",
      "Fixed: Fixed the footer",
      "Removed: Removed the old widget",
    ]);
  });

  it("returns 10 changes as 10 lines", () => {
    const lines = formatChangeLines(buildChanges(10));

    expect(lines).toHaveLength(10);
    expect(lines[9]).toBe("New: Change 10");
  });

  it("11 changes give 10 lines and '…and 1 more changes.'", () => {
    const lines = formatChangeLines(buildChanges(11));

    expect(lines).toHaveLength(11);
    expect(lines[9]).toBe("New: Change 10");
    expect(lines[10]).toBe("…and 1 more changes.");
  });

  it("12 changes give 10 lines and '…and 2 more changes.'", () => {
    const lines = formatChangeLines(buildChanges(12));

    expect(lines).toHaveLength(11);
    expect(lines[10]).toBe("…and 2 more changes.");
  });
});
