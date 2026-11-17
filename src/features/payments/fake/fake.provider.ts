import { randomBytes } from "node:crypto";
import { env } from "@/shared/config/env";
import type { PaymentProvider } from "@/features/payments/payment.types";

// The provider used when PAYMENT_PROVIDER=fake: local development and E2E. No network (docs/06-payments.md section 8).
export function createFakeProvider(): PaymentProvider {
  return {
    name: "fake",
    async upsertProduct(input) {
      return { productId: "fake_prod_" + input.themeId };
    },
    async upsertDiscount(input) {
      return { discountId: "fake_disc_" + input.couponId };
    },
    async deleteDiscount() {
      // Nothing to delete: the fake provider keeps no discounts.
    },
    async createCheckout(input) {
      const checkoutId = "fake_chk_" + randomBytes(8).toString("hex");
      const url =
        env.APP_URL + "/checkout/fake/" + checkoutId + "?theme=" + input.themeId + "&coupon=" + (input.couponId ?? "");
      return { checkoutId, url };
    },
    async parseWebhook() {
      throw new Error("The fake provider has no webhooks.");
    },
  };
}
