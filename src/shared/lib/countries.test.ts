import { describe, expect, it } from "vitest";
import { getCountryOptions, isCountryCode } from "@/shared/lib/countries";

describe("getCountryOptions", () => {
  it("contains Egypt and is sorted by label", () => {
    const options = getCountryOptions();
    expect(options).toContainEqual({ value: "EG", label: "Egypt" });
    const labels = options.map((option) => option.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "en")));
  });
});

describe("isCountryCode", () => {
  it("accepts known codes and refuses unknown ones", () => {
    expect(isCountryCode("US")).toBe(true);
    expect(isCountryCode("XX")).toBe(false);
    expect(isCountryCode("us")).toBe(false);
  });
});
