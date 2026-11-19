import { describe, expect, it } from "vitest";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { OrderModel } from "@/features/orders/order.model";
import { getOrderForAdmin, listOrdersForAdmin, markWalletOrderRefunded } from "@/features/orders/order-admin.service";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { setTestNow } from "@/shared/lib/clock";
import { createAdmin, createOrder, createOwnership, createTheme, createUser } from "@/shared/test/factories";

const NOW = new Date("2026-11-10T12:00:00Z");
const UNKNOWN_ID = "665f1c2e8f1b2c3d4e5f6a7b";
const CANNOT_REFUND_MESSAGE = "This order cannot be marked as refunded.";

// A paid wallet order of 1,450 EGP, its active purchase ownership and a theme that was sold once.
async function setupWalletSale() {
  setTestNow(NOW);
  const admin = await createAdmin();
  const customer = await createUser();
  const theme = await createTheme({ name: "Aurora Blog", status: "published" });
  await ThemeModel.updateOne({ _id: theme._id }, { $set: { "stats.salesCount": 1 } });
  const order = await createOrder({
    userId: customer._id,
    themeId: theme._id,
    method: "wallet",
    currency: "egp",
    subtotalAmount: 145000,
    totalAmount: 145000,
    provider: { name: "manual_wallet", orderId: "payment-1", checkoutId: null, customerId: null },
  });
  const ownership = await createOwnership(customer._id.toString(), theme._id.toString(), {
    source: "purchase",
    orderId: order._id,
    grantedByUserId: null,
  });
  return { admin, customer, theme, order, ownership };
}

async function salesCountOf(themeId: string): Promise<number | undefined> {
  const theme = await ThemeModel.findById(themeId).lean();
  return theme?.stats.salesCount;
}

describe("listOrdersForAdmin", () => {
  it("lists orders newest paid first with customer, theme name, method, amount and status", async () => {
    const ann = await createUser({ name: "Ann Lee", email: "ann@example.com" });
    const bob = await createUser({ name: "Bob Ray", email: "bob@example.com" });
    const theme = await createTheme({ name: "Aurora Blog", status: "published" });
    const oldest = await createOrder({ userId: ann._id, themeId: theme._id, paidAt: new Date("2026-10-01T10:00:00Z") });
    const newest = await createOrder({
      userId: bob._id,
      themeId: theme._id,
      method: "wallet",
      currency: "egp",
      totalAmount: 145000,
      status: "refunded",
      paidAt: new Date("2026-10-03T10:00:00Z"),
    });
    const middle = await createOrder({ userId: ann._id, themeId: theme._id, paidAt: new Date("2026-10-02T10:00:00Z") });

    const page = await listOrdersForAdmin({ page: 1 });

    expect(page.items.map((item) => item.id)).toEqual([newest, middle, oldest].map((order) => order._id.toString()));
    expect(page).toMatchObject({ page: 1, totalPages: 1, total: 3 });
    expect(page.items[0]).toEqual({
      id: newest._id.toString(),
      paidAt: new Date("2026-10-03T10:00:00Z"),
      customerId: bob._id.toString(),
      customerName: "Bob Ray",
      customerEmail: "bob@example.com",
      themeName: "Aurora Blog",
      method: "wallet",
      currency: "egp",
      totalAmount: 145000,
      status: "refunded",
    });
    expect(page.items[1]).toMatchObject({ customerName: "Ann Lee", customerEmail: "ann@example.com", method: "card" });
  });

  it("filters by method", async () => {
    await createOrder({ method: "card" });
    const wallet = await createOrder({ method: "wallet", currency: "egp" });

    const page = await listOrdersForAdmin({ method: "wallet", page: 1 });

    expect(page.items.map((item) => item.id)).toEqual([wallet._id.toString()]);
    expect(page.total).toBe(1);
  });

  it("filters by status", async () => {
    const paid = await createOrder({ status: "paid" });
    const partly = await createOrder({ status: "partially_refunded", refundedAmount: 1000 });
    const refunded = await createOrder({ status: "refunded", refundedAmount: 2900 });

    const idsOf = async (status: "paid" | "partially_refunded" | "refunded") =>
      (await listOrdersForAdmin({ status, page: 1 })).items.map((item) => item.id);

    expect(await idsOf("paid")).toEqual([paid._id.toString()]);
    expect(await idsOf("partially_refunded")).toEqual([partly._id.toString()]);
    expect(await idsOf("refunded")).toEqual([refunded._id.toString()]);
  });

  it("includes the whole `to` day in UTC and excludes the next day", async () => {
    await createOrder({ paidAt: new Date("2026-10-31T23:59:59Z") });
    const startOfDay = await createOrder({ paidAt: new Date("2026-11-01T00:00:00Z") });
    const endOfDay = await createOrder({ paidAt: new Date("2026-11-01T23:59:59Z") });
    await createOrder({ paidAt: new Date("2026-11-02T00:00:00Z") });

    const page = await listOrdersForAdmin({ from: "2026-11-01", to: "2026-11-01", page: 1 });

    expect(page.items.map((item) => item.id)).toEqual([endOfDay._id.toString(), startOfDay._id.toString()]);
    expect(page.total).toBe(2);
  });

  it("returns an empty page when `from` is after `to`", async () => {
    await createOrder({ paidAt: new Date("2026-11-03T10:00:00Z") });

    const page = await listOrdersForAdmin({ from: "2026-11-05", to: "2026-11-01", page: 1 });

    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });

  it("paginates 20 per page", async () => {
    const user = await createUser();
    const theme = await createTheme({ status: "published" });
    for (let index = 0; index < 25; index += 1) {
      await createOrder({ userId: user._id, themeId: theme._id });
    }

    const pageOne = await listOrdersForAdmin({ page: 1 });
    const pageTwo = await listOrdersForAdmin({ page: 2 });

    expect(pageOne.items).toHaveLength(20);
    expect(pageTwo.items).toHaveLength(5);
    expect(pageOne.totalPages).toBe(2);
    expect(pageTwo.page).toBe(2);
    expect(pageOne.total).toBe(25);
  });
});

describe("getOrderForAdmin", () => {
  it("returns every amount, coupon code, customer, snapshot, provider ids and dates", async () => {
    const customer = await createUser({ name: "Ann Lee", email: "ann@example.com" });
    const theme = await createTheme({ name: "Aurora Blog", slug: "aurora-blog", status: "published" });
    const order = await createOrder({
      userId: customer._id,
      themeId: theme._id,
      status: "partially_refunded",
      subtotalAmount: 3900,
      discountAmount: 1000,
      taxAmount: 200,
      totalAmount: 3100,
      refundedAmount: 500,
      couponCode: "SAVE10",
      provider: { name: "polar", orderId: "po_1", checkoutId: "co_1", customerId: "cu_1" },
      paidAt: new Date("2026-10-01T10:00:00Z"),
    });

    const dto = await getOrderForAdmin(order._id.toString());

    expect(dto).toEqual({
      id: order._id.toString(),
      status: "partially_refunded",
      method: "card",
      currency: "usd",
      subtotalAmount: 3900,
      discountAmount: 1000,
      taxAmount: 200,
      totalAmount: 3100,
      refundedAmount: 500,
      couponCode: "SAVE10",
      customer: { id: customer._id.toString(), name: "Ann Lee", email: "ann@example.com" },
      theme: { id: theme._id.toString(), name: "Aurora Blog", slug: "aurora-blog" },
      provider: { name: "polar", orderId: "po_1", checkoutId: "co_1", customerId: "cu_1" },
      walletPaymentId: null,
      paidAt: new Date("2026-10-01T10:00:00Z"),
      refundedAt: null,
      canMarkRefunded: false,
    });
  });

  it("allows marking as refunded only for a paid wallet order", async () => {
    const paidWallet = await createOrder({ method: "wallet", currency: "egp", status: "paid" });
    const paidCard = await createOrder({ method: "card", status: "paid" });
    const refundedWallet = await createOrder({
      method: "wallet",
      currency: "egp",
      status: "refunded",
      refundedAmount: 2900,
      refundedAt: new Date("2026-10-02T10:00:00Z"),
    });

    expect((await getOrderForAdmin(paidWallet._id.toString()))?.canMarkRefunded).toBe(true);
    expect((await getOrderForAdmin(paidCard._id.toString()))?.canMarkRefunded).toBe(false);
    const refunded = await getOrderForAdmin(refundedWallet._id.toString());
    expect(refunded?.canMarkRefunded).toBe(false);
    expect(refunded?.refundedAt).toEqual(new Date("2026-10-02T10:00:00Z"));
  });

  it("returns null for an unknown and an invalid id", async () => {
    expect(await getOrderForAdmin(UNKNOWN_ID)).toBeNull();
    expect(await getOrderForAdmin("not-an-id")).toBeNull();
  });
});

describe("markWalletOrderRefunded", () => {
  it("refunds the order, revokes the ownership, lowers salesCount and logs it", async () => {
    const { admin, customer, theme, order, ownership } = await setupWalletSale();

    await markWalletOrderRefunded(order._id.toString(), admin._id.toString());

    const savedOrder = await OrderModel.findById(order._id).lean();
    expect(savedOrder).toMatchObject({ status: "refunded", refundedAmount: 145000, refundedAt: NOW });
    const savedOwnership = await OwnershipModel.findById(ownership._id).lean();
    expect(savedOwnership).toMatchObject({ status: "revoked", revokedReason: "refund" });
    expect(await salesCountOf(theme._id.toString())).toBe(0);
    const rows = await ActivityLogModel.find({ action: "order_refunded" }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorRole: "admin",
      targetType: "order",
      summary: "Order refunded: Aurora Blog (1,450 EGP)",
    });
    expect(rows[0]?.actorUserId?.toString()).toBe(admin._id.toString());
    expect(rows[0]?.subjectUserId?.toString()).toBe(customer._id.toString());
    expect(rows[0]?.targetId?.toString()).toBe(order._id.toString());
  });

  it("leaves an ownership of another order or an admin grant active", async () => {
    const { admin, customer, theme, order, ownership } = await setupWalletSale();
    await OwnershipModel.updateOne(
      { _id: ownership._id },
      { $set: { source: "admin_grant", orderId: null, grantedByUserId: admin._id } },
    );

    await markWalletOrderRefunded(order._id.toString(), admin._id.toString());

    expect((await OrderModel.findById(order._id).lean())?.status).toBe("refunded");
    expect(await salesCountOf(theme._id.toString())).toBe(0);
    const savedOwnership = await OwnershipModel.findOne({ userId: customer._id, themeId: theme._id }).lean();
    expect(savedOwnership).toMatchObject({ status: "active", source: "admin_grant", revokedReason: null });
  });

  it("refuses a card order", async () => {
    setTestNow(NOW);
    const admin = await createAdmin();
    const customer = await createUser();
    const theme = await createTheme({ status: "published" });
    await ThemeModel.updateOne({ _id: theme._id }, { $set: { "stats.salesCount": 1 } });
    const order = await createOrder({ userId: customer._id, themeId: theme._id, method: "card" });
    const ownership = await createOwnership(customer._id.toString(), theme._id.toString(), {
      source: "purchase",
      orderId: order._id,
    });

    await expect(markWalletOrderRefunded(order._id.toString(), admin._id.toString())).rejects.toMatchObject({
      code: "INVALID",
      message: CANNOT_REFUND_MESSAGE,
    });

    expect(await OrderModel.findById(order._id).lean()).toMatchObject({ status: "paid", refundedAmount: 0 });
    expect((await OwnershipModel.findById(ownership._id).lean())?.status).toBe("active");
    expect(await salesCountOf(theme._id.toString())).toBe(1);
    expect(await ActivityLogModel.countDocuments({})).toBe(0);
  });

  it("refuses an order that is already refunded and changes nothing the second time", async () => {
    const { admin, theme, order } = await setupWalletSale();
    await markWalletOrderRefunded(order._id.toString(), admin._id.toString());

    await expect(markWalletOrderRefunded(order._id.toString(), admin._id.toString())).rejects.toMatchObject({
      code: "INVALID",
      message: CANNOT_REFUND_MESSAGE,
    });

    expect(await salesCountOf(theme._id.toString())).toBe(0);
    expect(await ActivityLogModel.countDocuments({ action: "order_refunded" })).toBe(1);
  });

  it("refuses an unknown order", async () => {
    const admin = await createAdmin();

    await expect(markWalletOrderRefunded(UNKNOWN_ID, admin._id.toString())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Order not found.",
    });
  });
});
