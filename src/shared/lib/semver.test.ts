import { describe, expect, it } from "vitest";
import { compareSemver, nextPatchVersion } from "@/shared/lib/semver";

describe("compareSemver", () => {
  it("compares numbers, not text", () => {
    expect(compareSemver("1.10.0", "1.9.0")).toBe(1);
    expect(compareSemver("1.9.0", "1.10.0")).toBe(-1);
    expect(compareSemver("1.4.0", "1.4.0")).toBe(0);
    expect(compareSemver("2.0.0", "1.99.99")).toBe(1);
    expect(compareSemver("1.4.1", "1.4.0")).toBe(1);
  });
});

describe("nextPatchVersion", () => {
  it("adds 1 to the patch", () => {
    expect(nextPatchVersion("1.4.0")).toBe("1.4.1");
    expect(nextPatchVersion("1.9.9")).toBe("1.9.10");
  });
});
