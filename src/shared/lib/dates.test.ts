import { describe, expect, it } from "vitest";
import { formatDate } from "@/shared/lib/dates";

describe("formatDate", () => {
  it("formats in UTC", () => {
    expect(formatDate(new Date("2026-10-27T23:30:00Z"))).toBe("Oct 27, 2026");
  });
});
