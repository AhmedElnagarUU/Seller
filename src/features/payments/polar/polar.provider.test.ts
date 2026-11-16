import { describe, expect, it } from "vitest";
import { WebhookPayloadError, WebhookSignatureError } from "@/features/payments/payment.types";
import { createPolarProvider } from "@/features/payments/polar/polar.provider";
import { signPolarWebhook } from "@/shared/test/webhook-signing";

const SECRET = process.env.POLAR_WEBHOOK_SECRET ?? "";
const THEME_ID = "665f1c2e8f1b2c3d4e5f6a7b";
const USER_ID = "665f1c2e8f1b2c3d4e5f6a7c";

function buildOrderData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "order_1",
    checkout_id: "checkout_1",
    customer_id: "customer_1",
    metadata: { userId: USER_ID, themeId: THEME_ID, couponId: "" },
    currency: "usd",
    subtotal_amount: 2900,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 2900,
    created_at: "2026-11-02T09:30:00Z",
    status: "paid",
    refunded_amount: 0,
    refunded_tax_amount: 0,
    ...overrides,
  };
}

function signedRequest(id: string, type: string, data: Record<string, unknown>) {
  const body = JSON.stringify({ type, timestamp: "2026-11-02T09:30:00Z", data });
  return { body, headers: new Headers(signPolarWebhook({ id, body, secret: SECRET })) };
}

describe("parseWebhook", () => {
  it("a signed order.paid body gives an order_paid event with the webhook-id header as eventId", async () => {
    const { body, headers } = signedRequest("evt_paid_1", "order.paid", buildOrderData());

    const event = await createPolarProvider().parseWebhook(body, headers);

    expect(event).toEqual({
      kind: "order_paid",
      eventId: "evt_paid_1",
      type: "order.paid",
      order: {
        providerOrderId: "order_1",
        checkoutId: "checkout_1",
        providerCustomerId: "customer_1",
        userId: USER_ID,
        themeId: THEME_ID,
        couponId: null,
        currency: "usd",
        subtotalAmount: 2900,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 2900,
        paidAt: new Date("2026-11-02T09:30:00Z"),
      },
    });
  });

  it("a signed order.refunded body gives order_refunded with the summed refunded amount", async () => {
    const data = buildOrderData({ status: "partially_refunded", refunded_amount: 1000, refunded_tax_amount: 160 });
    const { body, headers } = signedRequest("evt_refund_1", "order.refunded", data);

    const event = await createPolarProvider().parseWebhook(body, headers);

    expect(event).toEqual({
      kind: "order_refunded",
      eventId: "evt_refund_1",
      type: "order.refunded",
      providerOrderId: "order_1",
      refundedAmount: 1160,
      isFullRefund: false,
    });
  });

  it("a wrong signature throws WebhookSignatureError", async () => {
    const { body } = signedRequest("evt_1", "order.paid", buildOrderData());
    const headers = new Headers(signPolarWebhook({ id: "evt_1", body, secret: "whsec_another_secret" }));
    const provider = createPolarProvider();

    await expect(provider.parseWebhook(body, headers)).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(provider.parseWebhook(body, headers)).rejects.toThrow("Invalid signature");
  });

  it("missing signature headers throw WebhookSignatureError", async () => {
    const { body } = signedRequest("evt_1", "order.paid", buildOrderData());

    await expect(createPolarProvider().parseWebhook(body, new Headers())).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("a signed event of another type gives an ignored event", async () => {
    const { body, headers } = signedRequest("evt_other_1", "customer.created", { id: "customer_1" });

    const event = await createPolarProvider().parseWebhook(body, headers);

    expect(event).toEqual({ kind: "ignored", eventId: "evt_other_1", type: "customer.created" });
  });

  it("a signed body that is not JSON throws WebhookPayloadError", async () => {
    const body = "this is not json";
    const headers = new Headers(signPolarWebhook({ id: "evt_bad_1", body, secret: SECRET }));
    const provider = createPolarProvider();

    await expect(provider.parseWebhook(body, headers)).rejects.toBeInstanceOf(WebhookPayloadError);
    await expect(provider.parseWebhook(body, headers)).rejects.toThrow("The webhook body is not valid.");
  });
});
