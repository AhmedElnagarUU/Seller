import { createPolar, webhooks } from "@polar-sh/sdk/2026-10";
import { env } from "@/shared/config/env";
import {
  WebhookPayloadError,
  WebhookSignatureError,
  type PaymentEvent,
  type PaymentProvider,
} from "@/features/payments/payment.types";
import {
  buildCheckoutBody,
  buildDiscountCreateBody,
  buildDiscountUpdateBody,
  buildProductCreateBody,
  buildProductUpdateBody,
  mapOrderPaid,
  mapOrderRefunded,
} from "@/features/payments/polar/polar.mapper";

const EVENT_TYPE_MAX = 100;

function cutType(type: string): string {
  return type.slice(0, EVENT_TYPE_MAX);
}

async function readEvent(rawBody: string, headers: Headers, webhookSecret: string): Promise<PaymentEvent> {
  const eventId = headers.get("webhook-id") ?? "";
  try {
    const payload = await webhooks.validateEvent(rawBody, Object.fromEntries(headers.entries()), webhookSecret);
    const type = cutType(payload.type);
    if (payload.type === "order.paid") return mapOrderPaid(payload.data, eventId, type);
    if (payload.type === "order.refunded") return mapOrderRefunded(payload.data, eventId, type);
    return { kind: "ignored", eventId, type };
  } catch (error) {
    if (error instanceof webhooks.PolarWebhookVerificationError) throw new WebhookSignatureError("Invalid signature");
    if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
      return { kind: "ignored", eventId, type: cutType(error.eventType ?? "unknown") };
    }
    if (error instanceof webhooks.PolarWebhookError) throw new WebhookPayloadError("The webhook body is not valid.");
    throw error;
  }
}

// The Polar implementation of PaymentProvider. Only this folder knows Polar's field names (D-032).
export function createPolarProvider(): PaymentProvider {
  const accessToken = env.POLAR_ACCESS_TOKEN;
  const webhookSecret = env.POLAR_WEBHOOK_SECRET;
  if (!accessToken || !webhookSecret) throw new Error("Polar is not configured.");
  const client = createPolar({ accessToken, environment: env.POLAR_SERVER });

  return {
    name: "polar",
    async upsertProduct(input) {
      const product = input.existingProductId
        ? await client.products.update(input.existingProductId, buildProductUpdateBody(input))
        : await client.products.create(buildProductCreateBody(input));
      return { productId: product.id };
    },
    async upsertDiscount(input) {
      const discount = input.existingDiscountId
        ? await client.discounts.update(input.existingDiscountId, buildDiscountUpdateBody(input))
        : await client.discounts.create(buildDiscountCreateBody(input));
      return { discountId: discount.id };
    },
    async deleteDiscount(discountId) {
      await client.discounts.delete(discountId);
    },
    async createCheckout(input) {
      const checkout = await client.checkouts.create(buildCheckoutBody(input));
      return { checkoutId: checkout.id, url: checkout.url };
    },
    async parseWebhook(rawBody, headers) {
      return readEvent(rawBody, headers, webhookSecret);
    },
  };
}
