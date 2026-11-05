import { describe, expect, it } from "vitest";
import { formatPrice } from "@/shared/lib/money";

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
