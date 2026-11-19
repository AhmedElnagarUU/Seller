import { describe, expect, it } from "vitest";
import {
  applyCouponSchema,
  checkoutSearchParamsSchema,
  checkoutSuccessSearchParamsSchema,
  fakeCheckoutSearchParamsSchema,
  setCountrySchema,
  simulateFakePaymentSchema,
  startCardCheckoutSchema,
} from "@/features/payments/checkout.schemas";

const THEME_ID = "665f1c2e8f1b2c3d4e5f6a7b";

describe("checkoutSearchParamsSchema", () => {
  it("a missing or too long coupon becomes an empty text", () => {
    expect(checkoutSearchParamsSchema.parse({}).coupon).toBe("");
    expect(checkoutSearchParamsSchema.parse({ coupon: "A".repeat(65) }).coupon).toBe("");
    expect(checkoutSearchParamsSchema.parse({ coupon: ["A", "B"] }).coupon).toBe("");
  });

  it("keeps a valid coupon, trimmed", () => {
    expect(checkoutSearchParamsSchema.parse({ coupon: "  SAVE20 " }).coupon).toBe("SAVE20");
    expect(checkoutSearchParamsSchema.parse({ coupon: "A".repeat(64) }).coupon).toBe("A".repeat(64));
  });
});

describe("checkoutSuccessSearchParamsSchema", () => {
  it("accepts fake_chk_ab12; 'a b' and an empty text become undefined", () => {
    expect(checkoutSuccessSearchParamsSchema.parse({ checkout_id: "fake_chk_ab12" }).checkout_id).toBe("fake_chk_ab12");
    expect(checkoutSuccessSearchParamsSchema.parse({ checkout_id: "a b" }).checkout_id).toBeUndefined();
    expect(checkoutSuccessSearchParamsSchema.parse({ checkout_id: "" }).checkout_id).toBeUndefined();
    expect(checkoutSuccessSearchParamsSchema.parse({ checkout_id: "a".repeat(101) }).checkout_id).toBeUndefined();
    expect(checkoutSuccessSearchParamsSchema.parse({}).checkout_id).toBeUndefined();
  });
});

describe("startCardCheckoutSchema", () => {
  it("refuses a slug with capital letters", () => {
    expect(startCardCheckoutSchema.safeParse({ slug: "Aurora-Blog", coupon: "" }).success).toBe(false);
    expect(startCardCheckoutSchema.safeParse({ slug: "aurora blog", coupon: "" }).success).toBe(false);
  });

  it("an empty coupon becomes null; a coupon is trimmed and cut to 64 characters", () => {
    expect(startCardCheckoutSchema.parse({ slug: "aurora-blog", coupon: "" })).toEqual({
      slug: "aurora-blog",
      coupon: null,
    });
    expect(startCardCheckoutSchema.parse({ slug: "aurora-blog", coupon: "   " }).coupon).toBeNull();
    expect(startCardCheckoutSchema.parse({ slug: "aurora-blog", coupon: " SAVE20 " }).coupon).toBe("SAVE20");
    expect(startCardCheckoutSchema.parse({ slug: "aurora-blog", coupon: "A".repeat(80) }).coupon).toBe("A".repeat(64));
  });
});

describe("applyCouponSchema and setCountrySchema", () => {
  it("apply coupon trims the code and refuses a bad slug", () => {
    expect(applyCouponSchema.parse({ slug: "aurora-blog", code: " SAVE20 " })).toEqual({
      slug: "aurora-blog",
      code: "SAVE20",
    });
    expect(applyCouponSchema.safeParse({ slug: "Aurora", code: "SAVE20" }).success).toBe(false);
  });

  it("set country keeps any country text (the service checks it) and refuses a bad slug", () => {
    expect(setCountrySchema.parse({ slug: "aurora-blog", country: "XX", coupon: "" })).toEqual({
      slug: "aurora-blog",
      country: "XX",
      coupon: "",
    });
    expect(setCountrySchema.safeParse({ slug: "-bad-", country: "EG", coupon: "" }).success).toBe(false);
  });
});

describe("simulateFakePaymentSchema", () => {
  it("accepts a checkout id, a theme id and an empty or valid coupon id", () => {
    expect(
      simulateFakePaymentSchema.safeParse({ checkoutId: "fake_chk_1", themeId: THEME_ID, couponId: "" }).success,
    ).toBe(true);
    expect(
      simulateFakePaymentSchema.safeParse({ checkoutId: "fake_chk_1", themeId: THEME_ID, couponId: THEME_ID }).success,
    ).toBe(true);
  });

  it("refuses a bad checkout id, theme id or coupon id", () => {
    expect(simulateFakePaymentSchema.safeParse({ checkoutId: "a b", themeId: THEME_ID, couponId: "" }).success).toBe(
      false,
    );
    expect(simulateFakePaymentSchema.safeParse({ checkoutId: "x", themeId: "nope", couponId: "" }).success).toBe(false);
    expect(simulateFakePaymentSchema.safeParse({ checkoutId: "x", themeId: THEME_ID, couponId: "nope" }).success).toBe(
      false,
    );
  });
});

describe("fakeCheckoutSearchParamsSchema", () => {
  it("keeps the theme and coupon text and turns anything else into an empty text", () => {
    expect(fakeCheckoutSearchParamsSchema.parse({ theme: ` ${THEME_ID} `, coupon: "" })).toEqual({
      theme: THEME_ID,
      coupon: "",
    });
    expect(fakeCheckoutSearchParamsSchema.parse({ theme: ["a", "b"] })).toEqual({ theme: "", coupon: "" });
  });
});
