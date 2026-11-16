import { describe, expect, it } from "vitest";
import { createFakeProvider } from "@/features/payments/fake/fake.provider";

const THEME_ID = "665f1c2e8f1b2c3d4e5f6a7b";
const COUPON_ID = "665f1c2e8f1b2c3d4e5f6a7d";

function checkoutInput(couponId: string | null) {
  return {
    productId: "fake_prod_" + THEME_ID,
    discountId: null,
    userId: "665f1c2e8f1b2c3d4e5f6a7c",
    themeId: THEME_ID,
    couponId,
    customerEmail: "buyer@example.com",
    customerName: "Buyer One",
    successUrl: "http://localhost:3000/checkout/success",
  };
}

describe("createFakeProvider", () => {
  it("upsertProduct returns fake_prod_<themeId> and upsertDiscount returns fake_disc_<couponId>", async () => {
    const provider = createFakeProvider();

    const product = await provider.upsertProduct({
      themeId: THEME_ID,
      name: "Aurora Blog",
      tagline: "A calm theme for writers",
      priceCents: 2900,
      existingProductId: null,
    });
    const discount = await provider.upsertDiscount({
      couponId: COUPON_ID,
      code: "SAVE20",
      type: "percent",
      percentOff: 20,
      amountOffCents: null,
      productIds: null,
      existingDiscountId: null,
    });

    expect(provider.name).toBe("fake");
    expect(product).toEqual({ productId: "fake_prod_" + THEME_ID });
    expect(discount).toEqual({ discountId: "fake_disc_" + COUPON_ID });
  });

  it("createCheckout returns a fake_chk_ id and the fake checkout URL; with no coupon the URL ends with &coupon=", async () => {
    const provider = createFakeProvider();

    const withCoupon = await provider.createCheckout(checkoutInput(COUPON_ID));
    const withoutCoupon = await provider.createCheckout(checkoutInput(null));

    expect(withCoupon.checkoutId).toMatch(/^fake_chk_[0-9a-f]{16}$/);
    expect(withCoupon.url).toBe(
      `http://localhost:3000/checkout/fake/${withCoupon.checkoutId}?theme=${THEME_ID}&coupon=${COUPON_ID}`,
    );
    expect(withoutCoupon.url).toBe(
      `http://localhost:3000/checkout/fake/${withoutCoupon.checkoutId}?theme=${THEME_ID}&coupon=`,
    );
    expect(withoutCoupon.checkoutId).not.toBe(withCoupon.checkoutId);
  });

  it("parseWebhook throws", async () => {
    const provider = createFakeProvider();

    await expect(provider.parseWebhook("{}", new Headers())).rejects.toThrow("The fake provider has no webhooks.");
  });
});
