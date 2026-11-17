export type ProviderName = "polar" | "fake";

export type NormalizedOrder = {
  providerOrderId: string;
  checkoutId: string | null;
  providerCustomerId: string | null;
  // From checkout metadata.
  userId: string;
  // From checkout metadata.
  themeId: string;
  // From checkout metadata ("" becomes null).
  couponId: string | null;
  // Lowercase, must be "usd".
  currency: string;
  // Minor units (cents).
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAt: Date;
};

export type PaymentEvent =
  | { kind: "order_paid"; eventId: string; type: string; order: NormalizedOrder }
  | {
      kind: "order_refunded";
      eventId: string;
      type: string;
      providerOrderId: string;
      refundedAmount: number;
      isFullRefund: boolean;
    }
  | { kind: "ignored"; eventId: string; type: string };

export interface PaymentProvider {
  name: ProviderName;
  // Creates or updates the provider product for a theme. Returns the product id.
  upsertProduct(input: {
    themeId: string;
    name: string;
    tagline: string;
    priceCents: number;
    existingProductId: string | null;
  }): Promise<{ productId: string }>;
  // Creates or updates the provider discount for a coupon. Returns the discount id.
  upsertDiscount(input: {
    couponId: string;
    code: string;
    type: "percent" | "fixed";
    percentOff: number | null;
    amountOffCents: number | null;
    productIds: string[] | null;
    existingDiscountId: string | null;
  }): Promise<{ discountId: string }>;
  // Deletes the provider discount of a coupon.
  deleteDiscount(discountId: string): Promise<void>;
  // Creates a hosted checkout. Returns its id and the URL to send the customer to.
  createCheckout(input: {
    productId: string;
    discountId: string | null;
    userId: string;
    themeId: string;
    couponId: string | null;
    customerEmail: string;
    customerName: string;
    successUrl: string;
  }): Promise<{ checkoutId: string; url: string }>;
  // Verifies the signature and converts the webhook into a PaymentEvent.
  // Throws WebhookSignatureError when the signature is wrong.
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent>;
}

export class WebhookSignatureError extends Error {}

// Thrown by parseWebhook when the signature is fine but the body is not a usable event (HTTP 400).
export class WebhookPayloadError extends Error {}
