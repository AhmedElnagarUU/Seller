import { describe, expect, it } from "vitest";
import { now, setTestNow } from "@/shared/lib/clock";

describe("now", () => {
  it("returns the test time after setTestNow", () => {
    const fixedDate = new Date("2026-11-01T10:00:00Z");
    setTestNow(fixedDate);
    expect(now().toISOString()).toBe("2026-11-01T10:00:00.000Z");

    setTestNow(null);
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
  });
});
