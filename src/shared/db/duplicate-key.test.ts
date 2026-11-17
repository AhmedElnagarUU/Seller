import { describe, expect, it } from "vitest";
import { isDuplicateKeyError } from "@/shared/db/duplicate-key";

describe("isDuplicateKeyError", () => {
  it("is true for an error with code 11000", () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true);
  });

  it("is false for another code, a plain error, null and a string", () => {
    expect(isDuplicateKeyError({ code: 11001 })).toBe(false);
    expect(isDuplicateKeyError(new Error("x"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError("x")).toBe(false);
  });
});
