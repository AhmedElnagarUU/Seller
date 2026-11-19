import { randomBytes } from "node:crypto";
import { env } from "@/shared/config/env";
import { getRefundBase } from "@/features/orders/order.service";
import { processPaymentEvent, type PaymentEventOutcome } from "@/features/payments/payment-event.service";
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

// Test helper (no page uses it): turns a provider order into a refund event and processes it like a webhook.
// An unknown order gets a refund of 0, so the refund ends as "order not found".
export async function simulateFakeRefund(providerOrderId: string, isFullRefund: boolean): Promise<PaymentEventOutcome> {
  const totalAmount = (await getRefundBase("fake", providerOrderId)) ?? 0;
  return processPaymentEvent(
    {
      kind: "order_refunded",
      eventId: "fake_evt_refund_" + providerOrderId + "_" + (isFullRefund ? "full" : "partial"),
      type: "order.refunded",
      providerOrderId,
      refundedAmount: isFullRefund ? totalAmount : Math.floor(totalAmount / 2),
      isFullRefund,
    },
    "fake",
  );
}
