import { describe, expect, it } from "vitest";
import { formatPrice, usdCentsToEgpPounds } from "@/shared/lib/money";

describe("formatPrice", () => {
  it("formats USD cents", () => {
    expect(formatPrice(2900, "usd")).toBe("$29.00");
    expect(formatPrice(100000, "usd")).toBe("$1,000.00");
  });

  it("formats EGP piasters as whole pounds", () => {
    expect(formatPrice(146500, "egp")).toBe("1,465 EGP");
  });

  it("formats EGP piasters with 2 decimals when there is a fraction", () => {
    expect(formatPrice(146550, "egp")).toBe("1,465.50 EGP");
  });
});

describe("usdCentsToEgpPounds", () => {
  it("rounds up a half pound: 2900 cents at 50.5 → 1465", () => {
    expect(usdCentsToEgpPounds(2900, 50.5)).toBe(1465);
  });

  it("rounds up a fraction: 2320 cents at 48 → 1114", () => {
    expect(usdCentsToEgpPounds(2320, 48)).toBe(1114);
  });

  it("keeps an exact amount: 2900 cents at 50 → 1450", () => {
    expect(usdCentsToEgpPounds(2900, 50)).toBe(1450);
  });

  it("rounds up a tiny amount: 100 cents at 48.29 → 49", () => {
    expect(usdCentsToEgpPounds(100, 48.29)).toBe(49);
  });

  it("works with the smallest rate: 100 cents at 1 → 1", () => {
    expect(usdCentsToEgpPounds(100, 1)).toBe(1);
  });

  it("rounds up with 2 decimals in the rate: 2320 cents at 48.29 → 1121", () => {
    expect(usdCentsToEgpPounds(2320, 48.29)).toBe(1121);
  });
});
