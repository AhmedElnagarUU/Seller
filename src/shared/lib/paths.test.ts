import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/shared/lib/paths";

describe("safeNextPath", () => {
  it("keeps an internal path", () => {
    expect(safeNextPath("/account/themes")).toBe("/account/themes");
  });

  it("returns / for unsafe or empty values", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});
