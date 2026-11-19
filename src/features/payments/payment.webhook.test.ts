import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakePaymentProvider } from "@/shared/test/fakes/fake-payment-provider";
import { signPolarWebhook } from "@/shared/test/webhook-signing";
import { createCoupon, createTheme, createUser } from "@/shared/test/factories";
import { OrderModel } from "@/features/orders/order.model";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { handlePaymentWebhook } from "@/features/payments/payment.webhook";
import { WebhookEventModel } from "@/features/payments/webhook-event.model";
import { createPolarProvider } from "@/features/payments/polar/polar.provider";
import { ThemeModel } from "@/features/themes/theme.model";

const SECRET = process.env.POLAR_WEBHOOK_SECRET ?? "";

type Buyer = { userId: string; themeId: string };

async function createBuyer(): Promise<Buyer> {
  const user = await createUser();
  const theme = await createTheme({
    status: "published",
    priceCents: 2900,
    provider: { productId: "prod_1", syncedAt: null },
  });
  return { userId: user._id.toString(), themeId: theme._id.toString() };
}

function buildOrderData(buyer: Buyer, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "po_1",
    status: "paid",
    checkout_id: "chk_1",
    customer_id: "cus_1",
    metadata: { userId: buyer.userId, themeId: buyer.themeId, couponId: "" },
    currency: "usd",
    subtotal_amount: 2900,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 2900,
    refunded_amount: 0,
    refunded_tax_amount: 0,
    created_at: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

function buildRequest(input: {
  id: string;
  type: string;
  data: Record<string, unknown>;
  secret?: string;
  body?: string;
}) {
  const body =
    input.body ??
    JSON.stringify({ type: input.type, timestamp: "2026-11-01T10:00:00Z", api_version: "2026-10", data: input.data });
  const headers = signPolarWebhook({ id: input.id, body, secret: input.secret ?? SECRET });
  return new Request("http://localhost:3000/api/webhooks/polar", { method: "POST", body, headers });
}

function deliver(request: Request): Promise<Response> {
  return handlePaymentWebhook(request, createPolarProvider());
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handlePaymentWebhook", () => {
  it("a correctly signed order.paid → 200 { received: true }; 1 order from polar; webhook event processed", async () => {
    const buyer = await createBuyer();

    const response = await deliver(buildRequest({ id: "evt_paid_1", type: "order.paid", data: buildOrderData(buyer) }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    const orders = await OrderModel.find().lean();
    expect(orders).toHaveLength(1);
    expect(orders[0]?.provider).toEqual({ name: "polar", orderId: "po_1", checkoutId: "chk_1", customerId: "cus_1" });
    expect(orders[0]?.totalAmount).toBe(2900);
    expect(await WebhookEventModel.findOne({ eventId: "evt_paid_1" }).lean()).toMatchObject({
      provider: "polar",
      type: "order.paid",
      status: "processed",
    });
  });

  it("a correctly signed order.paid with a coupon id saves the coupon on the order", async () => {
    const buyer = await createBuyer();
    const coupon = await createCoupon({ code: "SAVE20" });
    const data = buildOrderData(buyer, {
      metadata: { userId: buyer.userId, themeId: buyer.themeId, couponId: coupon._id.toString() },
      discount_amount: 580,
      total_amount: 2320,
    });

    const response = await deliver(buildRequest({ id: "evt_paid_2", type: "order.paid", data }));

    expect(response.status).toBe(200);
    expect(await OrderModel.findOne().lean()).toMatchObject({ couponCode: "SAVE20", totalAmount: 2320 });
  });

  it("a wrong signature → 403 { error: 'Invalid signature' }; 0 orders, 0 webhook events", async () => {
    const buyer = await createBuyer();

    const response = await deliver(
      buildRequest({ id: "evt_1", type: "order.paid", data: buildOrderData(buyer), secret: "whsec_another_secret" }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Invalid signature" });
    expect(await OrderModel.countDocuments()).toBe(0);
    expect(await WebhookEventModel.countDocuments()).toBe(0);
  });

  it("a signed event type we do not handle (customer.created) → 200; webhook event ignored", async () => {
    const response = await deliver(buildRequest({ id: "evt_c1", type: "customer.created", data: { id: "cus_1" } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(await WebhookEventModel.findOne({ eventId: "evt_c1" }).lean()).toMatchObject({
      status: "ignored",
      type: "customer.created",
    });
    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it("a signed body that is not JSON → 400 { error: 'Invalid body' }; 0 webhook events", async () => {
    const response = await deliver(buildRequest({ id: "evt_bad", type: "order.paid", data: {}, body: "not json {" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid body" });
    expect(await WebhookEventModel.countDocuments()).toBe(0);
  });

  it("a refund before its order → 500 { error: 'Temporary failure' }; webhook event failed", async () => {
    const buyer = await createBuyer();
    const data = buildOrderData(buyer, { status: "refunded", refunded_amount: 2900 });

    const response = await deliver(buildRequest({ id: "evt_r1", type: "order.refunded", data }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Temporary failure" });
    expect(await WebhookEventModel.findOne({ eventId: "evt_r1" }).lean()).toMatchObject({ status: "failed" });
  });

  it("a permanent problem (unknown theme id) → 200 { received: true }; webhook event failed; 0 orders", async () => {
    const buyer = await createBuyer();
    const data = buildOrderData(buyer, {
      metadata: { userId: buyer.userId, themeId: new Types.ObjectId().toString(), couponId: "" },
    });

    const response = await deliver(buildRequest({ id: "evt_p1", type: "order.paid", data }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(await WebhookEventModel.findOne({ eventId: "evt_p1" }).lean()).toMatchObject({
      status: "failed",
      error: "The payment event has no valid theme.",
    });
    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it("the same signed webhook delivered twice → 200 both times; 1 order, salesCount 1", async () => {
    const buyer = await createBuyer();
    const request = () => buildRequest({ id: "evt_twice", type: "order.paid", data: buildOrderData(buyer) });

    const first = await deliver(request());
    const second = await deliver(request());

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await OrderModel.countDocuments()).toBe(1);
    expect((await ThemeModel.findById(buyer.themeId).lean())?.stats.salesCount).toBe(1);
    expect(await WebhookEventModel.countDocuments()).toBe(1);
  });

  it("a signed order.refunded with status refunded after the paid webhook → 200; order refunded, ownership revoked", async () => {
    const buyer = await createBuyer();
    await deliver(buildRequest({ id: "evt_paid", type: "order.paid", data: buildOrderData(buyer) }));
    const refundData = buildOrderData(buyer, { status: "refunded", refunded_amount: 2900 });

    const response = await deliver(buildRequest({ id: "evt_refund", type: "order.refunded", data: refundData }));

    expect(response.status).toBe(200);
    expect(await OrderModel.findOne().lean()).toMatchObject({ status: "refunded", refundedAmount: 2900 });
    expect(await OwnershipModel.findOne().lean()).toMatchObject({ status: "revoked", revokedReason: "refund" });
    expect((await ThemeModel.findById(buyer.themeId).lean())?.stats.salesCount).toBe(0);
  });

  it("an unexpected error while reading the webhook → 500 { error: 'Temporary failure' } and nothing is saved", async () => {
    fakePaymentProvider.failNext(new Error("boom"));
    const request = new Request("http://localhost:3000/api/webhooks/polar", { method: "POST", body: "{}" });

    const response = await handlePaymentWebhook(request, fakePaymentProvider);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Temporary failure" });
    expect(await WebhookEventModel.countDocuments()).toBe(0);
  });
});
