import type { models } from "@polar-sh/sdk/2026-10";
import {
  WebhookPayloadError,
  type NormalizedOrder,
  type PaymentEvent,
  type PaymentProvider,
} from "@/features/payments/payment.types";

// Only this folder knows Polar's field names (D-032).

export type PolarOrderFields = Pick<
  models.Order,
  | "id"
  | "checkout_id"
  | "customer_id"
  | "metadata"
  | "currency"
  | "subtotal_amount"
  | "discount_amount"
  | "tax_amount"
  | "total_amount"
  | "created_at"
  | "status"
  | "refunded_amount"
  | "refunded_tax_amount"
>;

type ProductInput = Parameters<PaymentProvider["upsertProduct"]>[0];
type DiscountInput = Parameters<PaymentProvider["upsertDiscount"]>[0];
type CheckoutInput = Parameters<PaymentProvider["createCheckout"]>[0];

export function fixedUsdPrice(cents: number) {
  return { amount_type: "fixed" as const, price_currency: "usd" as const, price_amount: cents };
}

export function buildProductCreateBody(input: ProductInput) {
  return {
    name: input.name,
    description: input.tagline,
    metadata: { themeId: input.themeId },
    prices: [fixedUsdPrice(input.priceCents)],
    recurring_interval: null,
  };
}

export function buildProductUpdateBody(input: ProductInput) {
  return {
    name: input.name,
    description: input.tagline,
    metadata: { themeId: input.themeId },
    prices: [fixedUsdPrice(input.priceCents)],
  };
}

export function buildDiscountCreateBody(input: DiscountInput) {
  const metadata = { couponId: input.couponId };
  const base =
    input.type === "percent"
      ? {
          name: input.code,
          type: "percentage" as const,
          basis_points: (input.percentOff ?? 0) * 100,
          duration: "once" as const,
          metadata,
        }
      : {
          name: input.code,
          type: "fixed" as const,
          amount: input.amountOffCents ?? 0,
          currency: "usd" as const,
          duration: "once" as const,
          metadata,
        };
  return input.productIds === null ? base : { ...base, products: input.productIds };
}

export function buildDiscountUpdateBody(input: DiscountInput) {
  const base = { name: input.code };
  return input.productIds === null ? base : { ...base, products: input.productIds };
}

export function buildCheckoutBody(input: CheckoutInput) {
  return {
    products: [input.productId],
    discount_id: input.discountId,
    allow_discount_codes: false,
    metadata: { userId: input.userId, themeId: input.themeId, couponId: input.couponId ?? "" },
    customer_email: input.customerEmail,
    customer_name: input.customerName,
    success_url: input.successUrl,
  };
}

// The value when it is text, otherwise "" (a missing key, a number or a boolean all give "").
export function readMetadataText(metadata: Record<string, unknown> | null | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

// Throws WebhookPayloadError when the order cannot be turned into an event.
export function assertUsableOrder(order: PolarOrderFields): void {
  const amounts = [
    order.subtotal_amount,
    order.discount_amount,
    order.tax_amount,
    order.total_amount,
    order.refunded_amount,
    order.refunded_tax_amount,
  ];
  const hasId = typeof order.id === "string" && order.id !== "";
  const hasIntegerAmounts = amounts.every((amount) => Number.isInteger(amount));
  const hasValidDate = !Number.isNaN(new Date(order.created_at).getTime());
  if (!hasId || !hasIntegerAmounts || !hasValidDate) {
    throw new WebhookPayloadError("The order in the webhook is not usable.");
  }
}

function toNormalizedOrder(order: PolarOrderFields): NormalizedOrder {
  const couponId = readMetadataText(order.metadata, "couponId");
  return {
    providerOrderId: order.id,
    checkoutId: order.checkout_id,
    providerCustomerId: order.customer_id,
    userId: readMetadataText(order.metadata, "userId"),
    themeId: readMetadataText(order.metadata, "themeId"),
    couponId: couponId === "" ? null : couponId,
    currency: order.currency.toLowerCase(),
    subtotalAmount: order.subtotal_amount,
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    totalAmount: order.total_amount,
    paidAt: new Date(order.created_at),
  };
}

export function mapOrderPaid(order: PolarOrderFields, eventId: string, type: string): PaymentEvent {
  assertUsableOrder(order);
  return { kind: "order_paid", eventId, type, order: toNormalizedOrder(order) };
}

export function mapOrderRefunded(order: PolarOrderFields, eventId: string, type: string): PaymentEvent {
  assertUsableOrder(order);
  return {
    kind: "order_refunded",
    eventId,
    type,
    providerOrderId: order.id,
    refundedAmount: order.refunded_amount + order.refunded_tax_amount,
    isFullRefund: order.status === "refunded",
  };
}
