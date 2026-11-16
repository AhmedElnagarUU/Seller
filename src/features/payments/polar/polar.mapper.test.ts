import { describe, expect, it } from "vitest";
import { WebhookPayloadError } from "@/features/payments/payment.types";
import {
  buildCheckoutBody,
  buildDiscountCreateBody,
  buildProductCreateBody,
  buildProductUpdateBody,
  mapOrderPaid,
  mapOrderRefunded,
  type PolarOrderFields,
} from "@/features/payments/polar/polar.mapper";

const THEME_ID = "665f1c2e8f1b2c3d4e5f6a7b";
const USER_ID = "665f1c2e8f1b2c3d4e5f6a7c";
const COUPON_ID = "665f1c2e8f1b2c3d4e5f6a7d";
const UNUSABLE_ORDER_MESSAGE = "The order in the webhook is not usable.";

function buildOrder(overrides: Partial<PolarOrderFields> = {}): PolarOrderFields {
  return {
    id: "order_1",
    checkout_id: "checkout_1",
    customer_id: "customer_1",
    metadata: { userId: USER_ID, themeId: THEME_ID, couponId: COUPON_ID },
    currency: "USD",
    subtotal_amount: 2900,
    discount_amount: 400,
    tax_amount: 0,
    total_amount: 2500,
    created_at: "2026-11-02T09:30:00Z",
    status: "paid",
    refunded_amount: 0,
    refunded_tax_amount: 0,
    ...overrides,
  };
}

describe("buildProductCreateBody", () => {
  it("one fixed USD price in cents, tagline as description, themeId metadata, recurring_interval null", () => {
    const body = buildProductCreateBody({
      themeId: THEME_ID,
      name: "Aurora Blog",
      tagline: "A calm theme for writers",
      priceCents: 2900,
      existingProductId: null,
    });

    expect(body).toEqual({
      name: "Aurora Blog",
      description: "A calm theme for writers",
      metadata: { themeId: THEME_ID },
      prices: [{ amount_type: "fixed", price_currency: "usd", price_amount: 2900 }],
      recurring_interval: null,
    });
  });
});

describe("buildProductUpdateBody", () => {
  it("replaces the price list with the new price", () => {
    const body = buildProductUpdateBody({
      themeId: THEME_ID,
      name: "Aurora Blog",
      tagline: "A calm theme for writers",
      priceCents: 4900,
      existingProductId: "prod_1",
    });

    expect(body.prices).toEqual([{ amount_type: "fixed", price_currency: "usd", price_amount: 4900 }]);
    expect(body.name).toBe("Aurora Blog");
    expect(body.description).toBe("A calm theme for writers");
    expect(body.metadata).toEqual({ themeId: THEME_ID });
  });
});

describe("buildDiscountCreateBody", () => {
  it("percent 20 gives a percentage discount of 2000 basis points, once, without code and products", () => {
    const body = buildDiscountCreateBody({
      couponId: COUPON_ID,
      code: "SAVE20",
      type: "percent",
      percentOff: 20,
      amountOffCents: null,
      productIds: null,
      existingDiscountId: null,
    });

    expect(body).toEqual({
      name: "SAVE20",
      type: "percentage",
      basis_points: 2000,
      duration: "once",
      metadata: { couponId: COUPON_ID },
    });
    expect("code" in body).toBe(false);
    expect("products" in body).toBe(false);
  });

  it("fixed 1000 gives a fixed USD discount; products equal the given ids", () => {
    const body = buildDiscountCreateBody({
      couponId: COUPON_ID,
      code: "TEN",
      type: "fixed",
      percentOff: null,
      amountOffCents: 1000,
      productIds: ["prod_1", "prod_2"],
      existingDiscountId: null,
    });

    expect(body).toEqual({
      name: "TEN",
      type: "fixed",
      amount: 1000,
      currency: "usd",
      duration: "once",
      metadata: { couponId: COUPON_ID },
      products: ["prod_1", "prod_2"],
    });
  });
});

describe("buildCheckoutBody", () => {
  const input = {
    productId: "prod_1",
    discountId: "disc_1",
    userId: USER_ID,
    themeId: THEME_ID,
    couponId: COUPON_ID,
    customerEmail: "buyer@example.com",
    customerName: "Buyer One",
    successUrl: "http://localhost:3000/checkout/success?checkout={CHECKOUT_ID}",
  };

  it("passes metadata, disables discount codes and keeps the success url unchanged", () => {
    const body = buildCheckoutBody(input);

    expect(body).toEqual({
      products: ["prod_1"],
      discount_id: "disc_1",
      allow_discount_codes: false,
      metadata: { userId: USER_ID, themeId: THEME_ID, couponId: COUPON_ID },
      customer_email: "buyer@example.com",
      customer_name: "Buyer One",
      success_url: "http://localhost:3000/checkout/success?checkout={CHECKOUT_ID}",
    });
    expect(body.success_url).toContain("{CHECKOUT_ID}");
  });

  it("turns a null coupon id into an empty text and keeps a null discount id", () => {
    const body = buildCheckoutBody({ ...input, couponId: null, discountId: null });

    expect(body.metadata.couponId).toBe("");
    expect(body.discount_id).toBeNull();
  });
});

describe("mapOrderPaid", () => {
  it("maps ids, lower-cased currency, the four amounts and paidAt", () => {
    const event = mapOrderPaid(buildOrder(), "evt_1", "order.paid");

    expect(event).toEqual({
      kind: "order_paid",
      eventId: "evt_1",
      type: "order.paid",
      order: {
        providerOrderId: "order_1",
        checkoutId: "checkout_1",
        providerCustomerId: "customer_1",
        userId: USER_ID,
        themeId: THEME_ID,
        couponId: COUPON_ID,
        currency: "usd",
        subtotalAmount: 2900,
        discountAmount: 400,
        taxAmount: 0,
        totalAmount: 2500,
        paidAt: new Date("2026-11-02T09:30:00Z"),
      },
    });
  });

  it("maps an empty coupon id to null", () => {
    const event = mapOrderPaid(
      buildOrder({ metadata: { userId: USER_ID, themeId: THEME_ID, couponId: "" } }),
      "evt_1",
      "order.paid",
    );

    expect(event.kind === "order_paid" ? event.order.couponId : "wrong event").toBeNull();
  });

  it("gives an empty text for missing metadata and for non-text metadata values", () => {
    const missing = mapOrderPaid(buildOrder({ metadata: {} }), "evt_1", "order.paid");
    const nonText = mapOrderPaid(
      buildOrder({ metadata: { userId: 5, themeId: true, couponId: 7 } }),
      "evt_2",
      "order.paid",
    );

    for (const event of [missing, nonText]) {
      if (event.kind !== "order_paid") throw new Error("Expected an order_paid event.");
      expect(event.order.userId).toBe("");
      expect(event.order.themeId).toBe("");
      expect(event.order.couponId).toBeNull();
    }
  });

  it("refuses a non-integer amount and an invalid created_at", () => {
    expect(() => mapOrderPaid(buildOrder({ total_amount: 25.5 }), "evt_1", "order.paid")).toThrow(
      new WebhookPayloadError(UNUSABLE_ORDER_MESSAGE),
    );
    expect(() => mapOrderPaid(buildOrder({ created_at: "not a date" }), "evt_1", "order.paid")).toThrow(
      WebhookPayloadError,
    );
    expect(() => mapOrderPaid(buildOrder({ created_at: "not a date" }), "evt_1", "order.paid")).toThrow(
      UNUSABLE_ORDER_MESSAGE,
    );
  });
});

describe("mapOrderRefunded", () => {
  it("sums refunded_amount and refunded_tax_amount; isFullRefund is true only for status refunded", () => {
    const partial = mapOrderRefunded(
      buildOrder({ status: "partially_refunded", refunded_amount: 1000, refunded_tax_amount: 160 }),
      "evt_1",
      "order.refunded",
    );
    const full = mapOrderRefunded(
      buildOrder({ status: "refunded", refunded_amount: 2500, refunded_tax_amount: 0 }),
      "evt_2",
      "order.refunded",
    );

    expect(partial).toEqual({
      kind: "order_refunded",
      eventId: "evt_1",
      type: "order.refunded",
      providerOrderId: "order_1",
      refundedAmount: 1160,
      isFullRefund: false,
    });
    expect(full).toMatchObject({ refundedAmount: 2500, isFullRefund: true });
  });
});
