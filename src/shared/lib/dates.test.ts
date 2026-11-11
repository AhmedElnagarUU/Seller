import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/shared/lib/dates";

describe("formatDate", () => {
  it("formats in UTC", () => {
    expect(formatDate(new Date("2026-10-27T23:30:00Z"))).toBe("Oct 27, 2026");
  });
});

describe("formatDateTime", () => {
  it("formats UTC date and 24-hour time", () => {
    expect(formatDateTime(new Date("2026-10-27T14:05:00Z"))).toBe("Oct 27, 2026, 14:05");
    expect(formatDateTime(new Date("2026-10-27T00:05:00Z"))).toBe("Oct 27, 2026, 00:05");
  });
});
