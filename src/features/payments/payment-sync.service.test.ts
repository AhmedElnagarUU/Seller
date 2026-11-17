import { describe, expect, it, vi } from "vitest";
import { deleteCouponDiscount, syncCouponDiscount, syncThemeProduct } from "@/features/payments/payment-sync.service";
import { fakePaymentProvider } from "@/shared/test/fakes/fake-payment-provider";

const THEME_ID = "665f1c2e8f1b2c3d4e5f6a7b";
const INPUT = {
  themeId: THEME_ID,
  name: "Aurora Blog",
  tagline: "A calm theme for writers",
  priceCents: 2900,
  existingProductId: "fake_prod_old",
};

describe("syncThemeProduct", () => {
  it("sends theme id, name, tagline, price and existing product id to the provider and returns the product id", async () => {
    const result = await syncThemeProduct(INPUT);

    expect(result).toEqual({ ok: true, productId: "fake_prod_" + THEME_ID });
    expect(fakePaymentProvider.calls).toEqual([{ method: "upsertProduct", input: INPUT }]);
  });

  it("returns { ok: false } and does not throw when the provider fails; the failure is logged", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("Polar is down");
    fakePaymentProvider.failNext(failure);

    try {
      const result = await syncThemeProduct(INPUT);

      expect(result).toEqual({ ok: false });
      expect(consoleError).toHaveBeenCalledWith("syncThemeProduct failed", failure);
    } finally {
      consoleError.mockRestore();
    }
  });
});

const COUPON_ID = "665f1c2e8f1b2c3d4e5f6a7c";
const COUPON_INPUT = {
  couponId: COUPON_ID,
  code: "SAVE20",
  type: "percent" as const,
  percentOff: 20,
  amountOffCents: null,
  productIds: ["prod_1", "prod_2"],
  existingDiscountId: null,
};

describe("syncCouponDiscount", () => {
  it("passes every field to the provider and returns { ok: true, discountId }", async () => {
    const result = await syncCouponDiscount(COUPON_INPUT);

    expect(result).toEqual({ ok: true, discountId: "fake_disc_" + COUPON_ID });
    expect(fakePaymentProvider.calls).toEqual([{ method: "upsertDiscount", input: COUPON_INPUT }]);
  });

  it("returns { ok: false } and does not throw when the provider fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("Polar is down");
    fakePaymentProvider.failNext(failure);

    try {
      const result = await syncCouponDiscount(COUPON_INPUT);

      expect(result).toEqual({ ok: false });
      expect(consoleError).toHaveBeenCalledWith("syncCouponDiscount failed", failure);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("deleteCouponDiscount", () => {
  it("calls the provider with the discount id", async () => {
    await deleteCouponDiscount("disc_1");

    expect(fakePaymentProvider.calls).toEqual([{ method: "deleteDiscount", input: { discountId: "disc_1" } }]);
  });

  it("does not throw when the provider fails (console.error once)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("Polar is down");
    fakePaymentProvider.failNext(failure);

    try {
      await expect(deleteCouponDiscount("disc_1")).resolves.toBeUndefined();

      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith("deleteCouponDiscount failed", failure);
    } finally {
      consoleError.mockRestore();
    }
  });
});
