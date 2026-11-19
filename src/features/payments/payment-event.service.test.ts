import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestNow } from "@/shared/lib/clock";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";
import { createCoupon, createOrder, createOwnership, createTheme, createUser } from "@/shared/test/factories";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { CouponModel } from "@/features/coupons/coupon.model";
import { OrderModel } from "@/features/orders/order.model";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { simulateFakeRefund } from "@/features/payments/fake/fake.provider";
import { processPaymentEvent } from "@/features/payments/payment-event.service";
import type { NormalizedOrder, PaymentEvent } from "@/features/payments/payment.types";
import { WebhookEventModel } from "@/features/payments/webhook-event.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { UserModel } from "@/features/users/user.model";

const NOW = new Date("2026-11-01T10:00:00Z");

type PaidEvent = Extract<PaymentEvent, { kind: "order_paid" }>;
type Buyer = { userId: string; themeId: string; couponId: string | null };

// A valid order_paid event: 29.00 with a 20 % coupon.
function buildPaidEvent(buyer: Buyer, overrides: Partial<NormalizedOrder> & { eventId?: string } = {}): PaidEvent {
  const { eventId, ...orderOverrides } = overrides;
  return {
    kind: "order_paid",
    eventId: eventId ?? "evt_1",
    type: "order.paid",
    order: {
      providerOrderId: "po_1",
      checkoutId: "chk_1",
      providerCustomerId: "cus_1",
      userId: buyer.userId,
      themeId: buyer.themeId,
      couponId: buyer.couponId,
      currency: "usd",
      subtotalAmount: 2900,
      discountAmount: 580,
      taxAmount: 0,
      totalAmount: 2320,
      paidAt: NOW,
      ...orderOverrides,
    },
  };
}

function buildRefundEvent(overrides: Partial<Extract<PaymentEvent, { kind: "order_refunded" }>> = {}): PaymentEvent {
  return {
    kind: "order_refunded",
    eventId: "evt_refund_1",
    type: "order.refunded",
    providerOrderId: "po_1",
    refundedAmount: 500,
    isFullRefund: false,
    ...overrides,
  };
}

async function createBuyer(): Promise<Buyer & { themeName: string }> {
  const user = await createUser();
  const theme = await createTheme({
    status: "published",
    priceCents: 2900,
    provider: { productId: "fake_prod_x", syncedAt: null },
  });
  const coupon = await createCoupon({ percentOff: 20 });
  return {
    userId: user._id.toString(),
    themeId: theme._id.toString(),
    couponId: coupon._id.toString(),
    themeName: theme.name,
  };
}

async function readSalesCount(themeId: string): Promise<number | undefined> {
  return (await ThemeModel.findById(themeId).lean())?.stats.salesCount;
}

async function readWebhookEvent(eventId: string) {
  return WebhookEventModel.findOne({ provider: "polar", eventId }).lean();
}

beforeEach(() => {
  setTestNow(NOW);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("processPaymentEvent › order paid", () => {
  it("order paid creates exactly one order, one active ownership, salesCount + 1, coupon redemptionsCount + 1, one order_paid log", async () => {
    const buyer = await createBuyer();

    const outcome = await processPaymentEvent(buildPaidEvent(buyer), "polar");

    expect(outcome).toBe("processed");
    const orders = await OrderModel.find().lean();
    expect(orders).toHaveLength(1);
    const order = orders[0];
    expect(order?.userId.toString()).toBe(buyer.userId);
    expect(order?.themeId.toString()).toBe(buyer.themeId);
    expect(order?.method).toBe("card");
    expect(order?.status).toBe("paid");
    expect(order?.currency).toBe("usd");
    expect([order?.subtotalAmount, order?.discountAmount, order?.taxAmount, order?.totalAmount]).toEqual([
      2900, 580, 0, 2320,
    ]);
    expect(order?.refundedAmount).toBe(0);
    expect(order?.refundedAt).toBeNull();
    expect(order?.walletPaymentId).toBeNull();
    expect(order?.couponId?.toString()).toBe(buyer.couponId);
    expect(order?.couponCode).toBe((await CouponModel.findById(buyer.couponId).lean())?.code);
    expect(order?.themeSnapshot).toMatchObject({ name: buyer.themeName });
    expect(order?.provider).toEqual({ name: "polar", orderId: "po_1", checkoutId: "chk_1", customerId: "cus_1" });
    expect(order?.paidAt).toEqual(NOW);

    const ownerships = await OwnershipModel.find().lean();
    expect(ownerships).toHaveLength(1);
    expect(ownerships[0]).toMatchObject({ status: "active", source: "purchase" });
    expect(ownerships[0]?.orderId?.toString()).toBe(order?._id.toString());
    expect(ownerships[0]?.userId.toString()).toBe(buyer.userId);

    expect(await readSalesCount(buyer.themeId)).toBe(1);
    expect((await CouponModel.findById(buyer.couponId).lean())?.redemptionsCount).toBe(1);

    const logs = await ActivityLogModel.find({ action: "order_paid" }).lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorRole: "system",
      actorUserId: null,
      targetType: "order",
      summary: `Order paid: ${buyer.themeName} ($23.20)`,
    });
    expect(logs[0]?.subjectUserId?.toString()).toBe(buyer.userId);
    expect(logs[0]?.targetId?.toString()).toBe(order?._id.toString());

    const webhookEvent = await readWebhookEvent("evt_1");
    expect(webhookEvent).toMatchObject({ status: "processed", type: "order.paid", error: null });
    expect(webhookEvent?.processedAt).toEqual(NOW);
  });

  it("the same event twice → 2nd outcome duplicate; still 1 order, 1 ownership, salesCount 1, redemptionsCount 1, 1 log, 1 confirmation email", async () => {
    const buyer = await createBuyer();
    const event = buildPaidEvent(buyer);

    const first = await processPaymentEvent(event, "polar");
    const second = await processPaymentEvent(event, "polar");

    expect([first, second]).toEqual(["processed", "duplicate"]);
    expect(await OrderModel.countDocuments()).toBe(1);
    expect(await OwnershipModel.countDocuments()).toBe(1);
    expect(await readSalesCount(buyer.themeId)).toBe(1);
    expect((await CouponModel.findById(buyer.couponId).lean())?.redemptionsCount).toBe(1);
    expect(await ActivityLogModel.countDocuments({ action: "order_paid" })).toBe(1);
    expect(await WebhookEventModel.countDocuments()).toBe(1);
    expect(fakeEmailSender.sent).toHaveLength(1);
  });

  it("two different events for the same provider order id → 1 order; the 2nd outcome is processed; salesCount 1; 1 email", async () => {
    const buyer = await createBuyer();

    const first = await processPaymentEvent(buildPaidEvent(buyer, { eventId: "evt_a" }), "polar");
    const second = await processPaymentEvent(buildPaidEvent(buyer, { eventId: "evt_b" }), "polar");

    expect([first, second]).toEqual(["processed", "processed"]);
    expect(await OrderModel.countDocuments()).toBe(1);
    expect(await OwnershipModel.countDocuments()).toBe(1);
    expect(await readSalesCount(buyer.themeId)).toBe(1);
    expect((await CouponModel.findById(buyer.couponId).lean())?.redemptionsCount).toBe(1);
    expect(await ActivityLogModel.countDocuments({ action: "order_paid" })).toBe(1);
    expect((await readWebhookEvent("evt_b"))?.status).toBe("processed");
    expect(fakeEmailSender.sent).toHaveLength(1);
  });

  it("re-activates a revoked ownership and links it to the new order", async () => {
    const buyer = await createBuyer();
    const revoked = await createOwnership(buyer.userId, buyer.themeId, {
      status: "revoked",
      revokedAt: new Date("2026-10-01T10:00:00Z"),
      revokedReason: "admin",
      revokedByUserId: new Types.ObjectId(),
      revokeNote: "Chargeback",
    });

    const outcome = await processPaymentEvent(buildPaidEvent(buyer), "polar");

    expect(outcome).toBe("processed");
    const order = await OrderModel.findOne().lean();
    const ownerships = await OwnershipModel.find().lean();
    expect(ownerships).toHaveLength(1);
    expect(ownerships[0]?._id.toString()).toBe(revoked._id.toString());
    expect(ownerships[0]).toMatchObject({
      status: "active",
      source: "purchase",
      revokedAt: null,
      revokedReason: null,
      revokedByUserId: null,
      revokeNote: null,
    });
    expect(ownerships[0]?.orderId?.toString()).toBe(order?._id.toString());
  });

  it("keeps an already active ownership unchanged and still saves the order", async () => {
    const buyer = await createBuyer();
    const grant = await createOwnership(buyer.userId, buyer.themeId, { grantNote: "Gift" });

    const outcome = await processPaymentEvent(buildPaidEvent(buyer), "polar");

    expect(outcome).toBe("processed");
    expect(await OrderModel.countDocuments()).toBe(1);
    const ownerships = await OwnershipModel.find().lean();
    expect(ownerships).toHaveLength(1);
    expect(ownerships[0]?._id.toString()).toBe(grant._id.toString());
    expect(ownerships[0]).toMatchObject({ status: "active", source: "admin_grant", orderId: null, grantNote: "Gift" });
    expect(await readSalesCount(buyer.themeId)).toBe(1);
  });

  it("unknown theme id → permanent_failure; 0 orders, 0 ownerships; webhook event failed", async () => {
    const buyer = await createBuyer();

    const outcome = await processPaymentEvent(
      buildPaidEvent(buyer, { themeId: new Types.ObjectId().toString() }),
      "polar",
    );

    expect(outcome).toBe("permanent_failure");
    expect(await OrderModel.countDocuments()).toBe(0);
    expect(await OwnershipModel.countDocuments()).toBe(0);
    expect(await readWebhookEvent("evt_1")).toMatchObject({
      status: "failed",
      error: "The payment event has no valid theme.",
    });
    expect(fakeEmailSender.sent).toHaveLength(0);
  });

  it("empty or invalid theme id → permanent_failure with the same error", async () => {
    const buyer = await createBuyer();

    for (const [index, themeId] of ["", "not-an-id"].entries()) {
      const eventId = `evt_theme_${index}`;
      const outcome = await processPaymentEvent(buildPaidEvent(buyer, { eventId, themeId }), "polar");

      expect(outcome).toBe("permanent_failure");
      expect(await readWebhookEvent(eventId)).toMatchObject({
        status: "failed",
        error: "The payment event has no valid theme.",
      });
    }
    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it("empty, invalid or unknown user id → permanent_failure, error 'The payment event has no valid user.'", async () => {
    const buyer = await createBuyer();

    for (const [index, userId] of ["", "not-an-id", new Types.ObjectId().toString()].entries()) {
      const eventId = `evt_user_${index}`;
      const outcome = await processPaymentEvent(buildPaidEvent(buyer, { eventId, userId }), "polar");

      expect(outcome).toBe("permanent_failure");
      expect(await readWebhookEvent(eventId)).toMatchObject({
        status: "failed",
        error: "The payment event has no valid user.",
      });
    }
    expect(await OrderModel.countDocuments()).toBe(0);
    expect(await OwnershipModel.countDocuments()).toBe(0);
  });

  it("currency eur → permanent_failure, error 'The payment currency is not USD.'; 0 orders", async () => {
    const buyer = await createBuyer();

    const outcome = await processPaymentEvent(buildPaidEvent(buyer, { currency: "eur" }), "polar");

    expect(outcome).toBe("permanent_failure");
    expect(await OrderModel.countDocuments()).toBe(0);
    expect(await readWebhookEvent("evt_1")).toMatchObject({
      status: "failed",
      error: "The payment currency is not USD.",
    });
  });

  it("an event left in status processing (a crash before the end) is processed when it arrives again", async () => {
    const buyer = await createBuyer();
    await WebhookEventModel.create({ provider: "polar", eventId: "evt_1", type: "order.paid", status: "processing" });

    const outcome = await processPaymentEvent(buildPaidEvent(buyer), "polar");

    expect(outcome).toBe("processed");
    expect(await OrderModel.countDocuments()).toBe(1);
    expect(await WebhookEventModel.countDocuments()).toBe(1);
    expect(await readWebhookEvent("evt_1")).toMatchObject({ status: "processed", error: null });
  });

  it("a failed event is processed again when it arrives again and ends processed without an error", async () => {
    const buyer = await createBuyer();
    const bad = buildPaidEvent(buyer, { themeId: "" });
    await processPaymentEvent(bad, "polar");

    const outcome = await processPaymentEvent(buildPaidEvent(buyer), "polar");

    expect(outcome).toBe("processed");
    expect(await readWebhookEvent("evt_1")).toMatchObject({ status: "processed", error: null });
    expect(await OrderModel.countDocuments()).toBe(1);
  });

  it("a coupon id that does not exist saves the order without coupon and counts no redemption", async () => {
    const buyer = await createBuyer();
    const missingCouponId = new Types.ObjectId().toString();

    const outcome = await processPaymentEvent(buildPaidEvent(buyer, { couponId: missingCouponId }), "polar");

    expect(outcome).toBe("processed");
    const order = await OrderModel.findOne().lean();
    expect(order?.couponId).toBeNull();
    expect(order?.couponCode).toBeNull();
    expect([order?.discountAmount, order?.totalAmount]).toEqual([580, 2320]);
    expect((await CouponModel.findById(buyer.couponId).lean())?.redemptionsCount).toBe(0);
  });

  it("an order without a coupon id saves no coupon and counts no redemption", async () => {
    const buyer = await createBuyer();

    const outcome = await processPaymentEvent(
      buildPaidEvent({ ...buyer, couponId: null }, { discountAmount: 0, totalAmount: 2900 }),
      "polar",
    );

    expect(outcome).toBe("processed");
    const order = await OrderModel.findOne().lean();
    expect([order?.couponId, order?.couponCode, order?.totalAmount]).toEqual([null, null, 2900]);
    expect((await CouponModel.findById(buyer.couponId).lean())?.redemptionsCount).toBe(0);
  });

  it("rolls back everything when a write fails (the log summary is too long)", async () => {
    const buyer = await createBuyer();
    await ThemeModel.collection.updateOne(
      { _id: new Types.ObjectId(buyer.themeId) },
      { $set: { name: "x".repeat(400) } },
    );

    const outcome = await processPaymentEvent(buildPaidEvent(buyer), "polar");

    expect(outcome).toBe("temporary_failure");
    expect(await OrderModel.countDocuments()).toBe(0);
    expect(await OwnershipModel.countDocuments()).toBe(0);
    expect(await readSalesCount(buyer.themeId)).toBe(0);
    expect((await CouponModel.findById(buyer.couponId).lean())?.redemptionsCount).toBe(0);
    expect(await readWebhookEvent("evt_1")).toMatchObject({
      status: "failed",
      error: "Temporary error. The event will be retried.",
    });
    expect(fakeEmailSender.sent).toHaveLength(0);
  });

  it("sends the confirmation email after the commit; an email failure does not change the outcome or the data", async () => {
    const buyer = await createBuyer();
    const second = await createBuyer();

    const outcome = await processPaymentEvent(buildPaidEvent(buyer), "polar");

    expect(outcome).toBe("processed");
    expect(fakeEmailSender.sent).toHaveLength(1);
    const buyerUser = await UserModel.findById(buyer.userId).lean();
    expect(fakeEmailSender.sent[0]?.subject).toBe(`Your purchase: ${buyer.themeName}`);
    expect(fakeEmailSender.sent[0]?.to).toBe(buyerUser?.email);

    fakeEmailSender.failNext(new Error("Resend is down"));
    const failedEmailOutcome = await processPaymentEvent(
      buildPaidEvent(second, { eventId: "evt_2", providerOrderId: "po_2" }),
      "polar",
    );

    expect(failedEmailOutcome).toBe("processed");
    expect(await OrderModel.countDocuments()).toBe(2);
    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(await ActivityLogModel.countDocuments({ action: "order_paid" })).toBe(2);
  });

  it("an ignored event is stored with status ignored and writes nothing else; the same event again → duplicate", async () => {
    const event: PaymentEvent = { kind: "ignored", eventId: "evt_ignored", type: "customer.created" };

    const first = await processPaymentEvent(event, "polar");
    const second = await processPaymentEvent(event, "polar");

    expect([first, second]).toEqual(["ignored", "duplicate"]);
    expect(await readWebhookEvent("evt_ignored")).toMatchObject({
      status: "ignored",
      type: "customer.created",
      error: null,
    });
    expect((await readWebhookEvent("evt_ignored"))?.processedAt).toEqual(NOW);
    expect(await WebhookEventModel.countDocuments()).toBe(1);
    expect(await OrderModel.countDocuments()).toBe(0);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("cuts a type that is longer than 100 characters", async () => {
    const event: PaymentEvent = { kind: "ignored", eventId: "evt_long", type: "t".repeat(150) };

    const outcome = await processPaymentEvent(event, "polar");

    expect(outcome).toBe("ignored");
    expect((await readWebhookEvent("evt_long"))?.type).toBe("t".repeat(100));
  });
});

async function createPaidOrderWithOwnership() {
  const buyer = await createBuyer();
  const order = await createOrder({
    userId: new Types.ObjectId(buyer.userId),
    themeId: new Types.ObjectId(buyer.themeId),
    provider: { name: "polar", orderId: "po_1", checkoutId: "chk_1", customerId: "cus_1" },
  });
  const ownership = await createOwnership(buyer.userId, buyer.themeId, { source: "purchase", orderId: order._id });
  await ThemeModel.updateOne({ _id: buyer.themeId }, { $set: { "stats.salesCount": 1 } });
  return { buyer, order, ownership };
}

describe("processPaymentEvent › refund", () => {
  it("partial refund → order partially_refunded, refundedAmount 500; ownership active; salesCount still 1; no order_refunded log", async () => {
    const { buyer, order, ownership } = await createPaidOrderWithOwnership();

    const outcome = await processPaymentEvent(buildRefundEvent(), "polar");

    expect(outcome).toBe("processed");
    const saved = await OrderModel.findById(order._id).lean();
    expect(saved).toMatchObject({ status: "partially_refunded", refundedAmount: 500, refundedAt: null });
    expect((await OwnershipModel.findById(ownership._id).lean())?.status).toBe("active");
    expect(await readSalesCount(buyer.themeId)).toBe(1);
    expect(await ActivityLogModel.countDocuments({ action: "order_refunded" })).toBe(0);
    expect((await readWebhookEvent("evt_refund_1"))?.status).toBe("processed");
  });

  it("full refund → order refunded, refundedAmount 2320, refundedAt now; ownership revoked; salesCount 0; one order_refunded log", async () => {
    const { buyer, order, ownership } = await createPaidOrderWithOwnership();

    const outcome = await processPaymentEvent(buildRefundEvent({ refundedAmount: 2320, isFullRefund: true }), "polar");

    expect(outcome).toBe("processed");
    const saved = await OrderModel.findById(order._id).lean();
    expect(saved).toMatchObject({ status: "refunded", refundedAmount: 2320 });
    expect(saved?.refundedAt).toEqual(NOW);
    const savedOwnership = await OwnershipModel.findById(ownership._id).lean();
    expect(savedOwnership).toMatchObject({ status: "revoked", revokedReason: "refund", revokedByUserId: null });
    expect(savedOwnership?.revokedAt).toEqual(NOW);
    expect(await readSalesCount(buyer.themeId)).toBe(0);
    const logs = await ActivityLogModel.find({ action: "order_refunded" }).lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorRole: "system",
      targetType: "order",
      summary: `Order refunded: ${order.themeSnapshot.name} ($29.00)`,
    });
    expect(logs[0]?.subjectUserId?.toString()).toBe(buyer.userId);
    expect(logs[0]?.targetId?.toString()).toBe(order._id.toString());
  });

  it("full refund does not revoke an ownership that belongs to another order or an admin grant", async () => {
    const buyer = await createBuyer();
    const order = await createOrder({
      userId: new Types.ObjectId(buyer.userId),
      themeId: new Types.ObjectId(buyer.themeId),
      provider: { name: "polar", orderId: "po_1", checkoutId: null, customerId: null },
    });
    const grant = await createOwnership(buyer.userId, buyer.themeId);
    await ThemeModel.updateOne({ _id: buyer.themeId }, { $set: { "stats.salesCount": 1 } });

    const adminGrantOutcome = await processPaymentEvent(
      buildRefundEvent({ refundedAmount: 2900, isFullRefund: true }),
      "polar",
    );

    expect(adminGrantOutcome).toBe("processed");
    expect((await OrderModel.findById(order._id).lean())?.status).toBe("refunded");
    expect((await OwnershipModel.findById(grant._id).lean())?.status).toBe("active");
    expect(await readSalesCount(buyer.themeId)).toBe(0);

    const other = await createBuyer();
    const refundedOrder = await createOrder({
      userId: new Types.ObjectId(other.userId),
      themeId: new Types.ObjectId(other.themeId),
      provider: { name: "polar", orderId: "po_a", checkoutId: null, customerId: null },
    });
    const newerOrder = await createOrder({
      userId: new Types.ObjectId(other.userId),
      themeId: new Types.ObjectId(other.themeId),
      provider: { name: "polar", orderId: "po_b", checkoutId: null, customerId: null },
    });
    const purchase = await createOwnership(other.userId, other.themeId, {
      source: "purchase",
      orderId: newerOrder._id,
    });
    await ThemeModel.updateOne({ _id: other.themeId }, { $set: { "stats.salesCount": 2 } });

    const otherOrderOutcome = await processPaymentEvent(
      buildRefundEvent({ eventId: "evt_refund_2", providerOrderId: "po_a", refundedAmount: 2900, isFullRefund: true }),
      "polar",
    );

    expect(otherOrderOutcome).toBe("processed");
    expect((await OrderModel.findById(refundedOrder._id).lean())?.status).toBe("refunded");
    expect((await OwnershipModel.findById(purchase._id).lean())?.status).toBe("active");
    expect(await readSalesCount(other.themeId)).toBe(1);
  });

  it("refund for an unknown order → temporary_failure; webhook event failed; nothing else written", async () => {
    const outcome = await processPaymentEvent(buildRefundEvent({ providerOrderId: "po_unknown" }), "polar");

    expect(outcome).toBe("temporary_failure");
    expect(await readWebhookEvent("evt_refund_1")).toMatchObject({
      status: "failed",
      error: "The order for this refund was not found yet. The event will be retried.",
    });
    expect(await OrderModel.countDocuments()).toBe(0);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("the same refund event is accepted after its order exists (Polar's retry)", async () => {
    const buyer = await createBuyer();
    const refund = buildRefundEvent({ refundedAmount: 2320, isFullRefund: true });

    const early = await processPaymentEvent(refund, "polar");
    const paid = await processPaymentEvent(buildPaidEvent(buyer), "polar");
    const retry = await processPaymentEvent(refund, "polar");

    expect([early, paid, retry]).toEqual(["temporary_failure", "processed", "processed"]);
    expect(await OrderModel.findOne().lean()).toMatchObject({ status: "refunded", refundedAmount: 2320 });
    expect(await readWebhookEvent("evt_refund_1")).toMatchObject({ status: "processed", error: null });
    expect(await readSalesCount(buyer.themeId)).toBe(0);
    expect((await OwnershipModel.findOne().lean())?.status).toBe("revoked");
  });

  it("the same refund event twice → 2nd duplicate; salesCount decreased once", async () => {
    const { buyer } = await createPaidOrderWithOwnership();
    const refund = buildRefundEvent({ refundedAmount: 2320, isFullRefund: true });

    const first = await processPaymentEvent(refund, "polar");
    const second = await processPaymentEvent(refund, "polar");

    expect([first, second]).toEqual(["processed", "duplicate"]);
    expect(await readSalesCount(buyer.themeId)).toBe(0);
    expect(await ActivityLogModel.countDocuments({ action: "order_refunded" })).toBe(1);
  });

  it("a second full refund event for an already refunded order → processed, nothing changes; a partial refund after a full one does not change the status", async () => {
    const { buyer, order } = await createPaidOrderWithOwnership();
    await processPaymentEvent(buildRefundEvent({ refundedAmount: 2320, isFullRefund: true }), "polar");
    const refundedAt = (await OrderModel.findById(order._id).lean())?.refundedAt;
    setTestNow(new Date("2026-11-05T10:00:00Z"));

    const secondFull = await processPaymentEvent(
      buildRefundEvent({ eventId: "evt_refund_2", refundedAmount: 2900, isFullRefund: true }),
      "polar",
    );
    const partialAfter = await processPaymentEvent(
      buildRefundEvent({ eventId: "evt_refund_3", refundedAmount: 100, isFullRefund: false }),
      "polar",
    );

    expect([secondFull, partialAfter]).toEqual(["processed", "processed"]);
    const saved = await OrderModel.findById(order._id).lean();
    expect(saved).toMatchObject({ status: "refunded", refundedAmount: 2320 });
    expect(saved?.refundedAt).toEqual(refundedAt);
    expect(await readSalesCount(buyer.themeId)).toBe(0);
    expect(await ActivityLogModel.countDocuments({ action: "order_refunded" })).toBe(1);
  });

  it("a partial refund and then a full refund ends refunded", async () => {
    const { order } = await createPaidOrderWithOwnership();

    await processPaymentEvent(buildRefundEvent(), "polar");
    await processPaymentEvent(
      buildRefundEvent({ eventId: "evt_refund_2", refundedAmount: 2900, isFullRefund: true }),
      "polar",
    );

    expect(await OrderModel.findById(order._id).lean()).toMatchObject({ status: "refunded", refundedAmount: 2900 });
  });
});

describe("simulateFakeRefund", () => {
  it("refunds a fake order fully and partially through the same code path", async () => {
    const buyer = await createBuyer();
    await processPaymentEvent(
      buildPaidEvent(buyer, { eventId: "fake_evt_1", providerOrderId: "fake_ord_1", checkoutId: "chk_1" }),
      "fake",
    );
    const otherBuyer = await createBuyer();
    await processPaymentEvent(
      buildPaidEvent(otherBuyer, { eventId: "fake_evt_2", providerOrderId: "fake_ord_2", checkoutId: "chk_2" }),
      "fake",
    );

    const full = await simulateFakeRefund("fake_ord_1", true);
    const partial = await simulateFakeRefund("fake_ord_2", false);

    expect([full, partial]).toEqual(["processed", "processed"]);
    const fullOrder = await OrderModel.findOne({ "provider.orderId": "fake_ord_1" }).lean();
    const partialOrder = await OrderModel.findOne({ "provider.orderId": "fake_ord_2" }).lean();
    expect(fullOrder).toMatchObject({ status: "refunded", refundedAmount: 2320 });
    expect(partialOrder).toMatchObject({ status: "partially_refunded", refundedAmount: Math.floor(2320 / 2) });
    expect(partialOrder?.refundedAmount).toBe(1160);
    expect(await WebhookEventModel.find({ provider: "fake", type: "order.refunded" }).countDocuments()).toBe(2);
    expect(
      await WebhookEventModel.exists({ provider: "fake", eventId: "fake_evt_refund_fake_ord_1_full" }),
    ).not.toBeNull();
  });

  it("an unknown order ends as order not found (temporary_failure)", async () => {
    expect(await simulateFakeRefund("fake_ord_unknown", true)).toBe("temporary_failure");
  });
});
