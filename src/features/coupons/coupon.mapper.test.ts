import { describe, expect, it } from "vitest";
import { toCouponListItemDTO } from "@/features/coupons/coupon.mapper";
import { createCoupon, createTheme } from "@/shared/test/factories";

describe("toCouponListItemDTO", () => {
  it("shows '20%' for percent, '$5.00' for fixed, 'All themes', '1 theme' and '3 themes'", async () => {
    const percent = await createCoupon({ type: "percent", percentOff: 20 });
    const fixed = await createCoupon({ type: "fixed", percentOff: null, amountOffCents: 500 });
    const [first, second, third] = await Promise.all([createTheme(), createTheme(), createTheme()]);
    const one = await createCoupon({ appliesTo: "selected", themeIds: [first._id] });
    const three = await createCoupon({ appliesTo: "selected", themeIds: [first._id, second._id, third._id] });

    expect(toCouponListItemDTO(percent)).toMatchObject({ discountLabel: "20%", themesLabel: "All themes" });
    expect(toCouponListItemDTO(fixed).discountLabel).toBe("$5.00");
    expect(toCouponListItemDTO(one).themesLabel).toBe("1 theme");
    expect(toCouponListItemDTO(three).themesLabel).toBe("3 themes");
  });

  it("copies the id, code, usage, expiry and status", async () => {
    const expiresAt = new Date("2026-12-31T23:59:59.999Z");
    const coupon = await createCoupon({
      code: "SAVE20",
      redemptionsCount: 3,
      maxRedemptions: 10,
      expiresAt,
      active: false,
    });

    expect(toCouponListItemDTO(coupon)).toEqual({
      id: coupon._id.toString(),
      code: "SAVE20",
      discountLabel: "20%",
      themesLabel: "All themes",
      redemptionsCount: 3,
      maxRedemptions: 10,
      expiresAt,
      active: false,
    });
  });
});
