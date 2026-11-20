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

describe("safeNextPath with tricks that leave the site", () => {
  it("refuses a backslash, which browsers read as //", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/\\\\evil.com/account")).toBe("/");
  });

  it("refuses a tab or a newline between the slashes", () => {
    expect(safeNextPath("/\t/evil.com")).toBe("/");
    expect(safeNextPath("/\n/evil.com")).toBe("/");
  });

  it("keeps the query and the hash of an internal path", () => {
    expect(safeNextPath("/checkout/aurora?coupon=SAVE20#pay")).toBe("/checkout/aurora?coupon=SAVE20#pay");
  });
});
