import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestNow } from "@/shared/lib/clock";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";
import { fakeStorage } from "@/shared/test/fakes/fake-storage";
import {
  createAdmin,
  createCoupon,
  createOwnership,
  createTheme,
  createUser,
  createWalletPayment,
  setSettings,
} from "@/shared/test/factories";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { CouponModel } from "@/features/coupons/coupon.model";
import { NotificationModel } from "@/features/notifications/notification.model";
import { OrderModel } from "@/features/orders/order.model";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { WalletPaymentModel } from "@/features/wallet-payments/wallet-payment.model";
import { startWalletPayment } from "@/features/wallet-payments/wallet-payment.service";
import {
  approveWalletPayment,
  countSubmittedWalletPayments,
  getWalletPaymentForAdmin,
  listWalletPaymentsForAdmin,
  rejectWalletPayment,
} from "@/features/wallet-payments/wallet-payment-review.service";

const NOW = new Date("2026-11-01T10:00:00Z");
const SUBMITTED_AT = new Date("2026-10-31T10:00:00Z");
const ALREADY_REVIEWED = "This payment was already reviewed.";
const NOT_FOUND = "Payment request not found.";
const REASON_LENGTH = "Write between 5 and 500 characters.";
const PROOF = { key: "wallet-proofs/x/abc.png", contentType: "image/png", sizeBytes: 1000 } as const;

let adminUserId = "";

beforeEach(async () => {
  setTestNow(NOW);
  adminUserId = (await createAdmin())._id.toString();
  await setSettings({
    walletEnabled: true,
    usdToEgpRate: 50,
    walletAccounts: [{ label: "Vodafone Cash", account: "01012345678", instructions: "" }],
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

type SubmittedOverrides = Parameters<typeof createWalletPayment>[0];

// A submitted request of a new Egyptian customer for a new published theme of $29.00.
async function createSubmitted(overrides: SubmittedOverrides = {}) {
  const payment = await createWalletPayment({
    status: "submitted",
    senderPhone: "01012345678",
    proof: PROOF,
    submittedAt: SUBMITTED_AT,
    ...overrides,
  });
  return {
    payment,
    id: payment._id.toString(),
    userId: payment.userId.toString(),
    themeId: payment.themeId.toString(),
    themeName: payment.themeSnapshot.name,
    adminUserId,
  };
}

async function expectNothingApproved(themeId: string) {
  expect(await OrderModel.countDocuments()).toBe(0);
  expect(await OwnershipModel.countDocuments()).toBe(0);
  expect(await NotificationModel.countDocuments()).toBe(0);
  expect((await ThemeModel.findById(themeId).lean())?.stats.salesCount).toBe(0);
  expect(fakeEmailSender.sent).toHaveLength(0);
}

describe("approveWalletPayment", () => {
  it("creates the order, ownership, notification and log, and emails the buyer", async () => {
    const setup = await createSubmitted();

    await approveWalletPayment({ walletPaymentId: setup.id, adminUserId: setup.adminUserId });

    const orders = await OrderModel.find().lean();
    expect(orders).toHaveLength(1);
    const order = orders[0];
    expect(order?.method).toBe("wallet");
    expect(order?.status).toBe("paid");
    expect(order?.currency).toBe("egp");
    expect(order?.totalAmount).toBe(145000);
    expect(order?.subtotalAmount).toBe(145000);
    expect(order?.discountAmount).toBe(0);
    expect(order?.taxAmount).toBe(0);
    expect(order?.refundedAmount).toBe(0);
    expect(order?.userId.toString()).toBe(setup.userId);
    expect(order?.themeId.toString()).toBe(setup.themeId);
    expect(order?.themeSnapshot).toEqual({ name: setup.themeName, slug: setup.payment.themeSnapshot.slug });
    expect(order?.provider).toEqual({ name: "manual_wallet", orderId: setup.id, checkoutId: null, customerId: null });
    expect(order?.walletPaymentId?.toString()).toBe(setup.id);
    expect(order?.paidAt).toEqual(NOW);
    const orderId = order?._id.toString();

    const payment = await WalletPaymentModel.findById(setup.id).lean();
    expect(payment?.status).toBe("approved");
    expect(payment?.isOpen).toBe(false);
    expect(payment?.reviewedAt).toEqual(NOW);
    expect(payment?.reviewedByUserId?.toString()).toBe(setup.adminUserId);
    expect(payment?.orderId?.toString()).toBe(orderId);

    const ownerships = await OwnershipModel.find().lean();
    expect(ownerships).toHaveLength(1);
    expect(ownerships[0]?.status).toBe("active");
    expect(ownerships[0]?.source).toBe("purchase");
    expect(ownerships[0]?.orderId?.toString()).toBe(orderId);
    expect(ownerships[0]?.userId.toString()).toBe(setup.userId);
    expect((await ThemeModel.findById(setup.themeId).lean())?.stats.salesCount).toBe(1);

    const notifications = await NotificationModel.find().lean();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.userId.toString()).toBe(setup.userId);
    expect(notifications[0]?.type).toBe("wallet_payment_approved");
    expect(notifications[0]?.title).toBe(`Payment approved: ${setup.themeName}`);
    expect(notifications[0]?.body).toBe("Your payment of 1,450 EGP was confirmed. You can download the theme now.");
    expect(notifications[0]?.link).toBe("/account/themes");

    const logs = await ActivityLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("wallet_payment_approved");
    expect(logs[0]?.actorRole).toBe("admin");
    expect(logs[0]?.actorUserId?.toString()).toBe(setup.adminUserId);
    expect(logs[0]?.subjectUserId?.toString()).toBe(setup.userId);
    expect(logs[0]?.targetType).toBe("wallet_payment");
    expect(logs[0]?.targetId?.toString()).toBe(setup.id);
    expect(logs[0]?.summary).toBe(`Wallet payment approved: ${setup.themeName} (1,450 EGP)`);

    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.subject).toBe(`Payment approved: ${setup.themeName} is yours`);
  });

  it("with a coupon: price 2900, 20 %, rate 48 → amountEgp 1114; order totals, couponCode and redemptionsCount", async () => {
    const coupon = await createCoupon({ code: "SAVE20", percentOff: 20 });
    const setup = await createSubmitted({
      exchangeRate: 48,
      amountEgp: 1114,
      usdDiscountCents: 580,
      couponId: coupon._id,
      couponCode: "SAVE20",
    });

    await approveWalletPayment({ walletPaymentId: setup.id, adminUserId: setup.adminUserId });

    const order = await OrderModel.findOne().lean();
    expect(order?.totalAmount).toBe(111400);
    expect(order?.subtotalAmount).toBe(139200);
    expect(order?.discountAmount).toBe(27800);
    expect(order?.couponCode).toBe("SAVE20");
    expect(order?.couponId?.toString()).toBe(coupon._id.toString());
    expect((await CouponModel.findById(coupon._id).lean())?.redemptionsCount).toBe(1);
  });

  it("approving twice → CONFLICT 'This payment was already reviewed.'; still 1 order, salesCount 1, 1 notification, 1 email", async () => {
    const setup = await createSubmitted();
    await approveWalletPayment({ walletPaymentId: setup.id, adminUserId: setup.adminUserId });

    await expect(
      approveWalletPayment({ walletPaymentId: setup.id, adminUserId: setup.adminUserId }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: ALREADY_REVIEWED });

    expect(await OrderModel.countDocuments()).toBe(1);
    expect((await ThemeModel.findById(setup.themeId).lean())?.stats.salesCount).toBe(1);
    expect(await NotificationModel.countDocuments()).toBe(1);
    expect(await ActivityLogModel.countDocuments()).toBe(1);
    expect(fakeEmailSender.sent).toHaveLength(1);
  });

  it("refuses awaiting, rejected and cancelled requests with the same message; nothing written", async () => {
    for (const status of ["awaiting_payment", "rejected", "cancelled"] as const) {
      const setup = await createSubmitted({ status });

      await expect(
        approveWalletPayment({ walletPaymentId: setup.id, adminUserId: setup.adminUserId }),
      ).rejects.toMatchObject({ code: "CONFLICT", message: ALREADY_REVIEWED });

      expect((await WalletPaymentModel.findById(setup.id).lean())?.status).toBe(status);
      await expectNothingApproved(setup.themeId);
    }
  });

  it("unknown id → NOT_FOUND 'Payment request not found.'", async () => {
    for (const walletPaymentId of [new Types.ObjectId().toString(), "not-an-id"]) {
      await expect(approveWalletPayment({ walletPaymentId, adminUserId })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: NOT_FOUND,
      });
    }
  });

  it("keeps an already active ownership unchanged (admin grant) and still saves the order", async () => {
    const setup = await createSubmitted();
    const grant = await createOwnership(setup.userId, setup.themeId);

    await approveWalletPayment({ walletPaymentId: setup.id, adminUserId: setup.adminUserId });

    const ownerships = await OwnershipModel.find().lean();
    expect(ownerships).toHaveLength(1);
    expect(ownerships[0]?._id.toString()).toBe(grant._id.toString());
    expect(ownerships[0]?.source).toBe("admin_grant");
    expect(ownerships[0]?.orderId).toBeNull();
    expect(await OrderModel.countDocuments()).toBe(1);
    expect((await WalletPaymentModel.findById(setup.id).lean())?.status).toBe("approved");
  });

  it("rolls back everything when a write fails (a log summary over 300 characters)", async () => {
    const setup = await createSubmitted();
    await WalletPaymentModel.collection.updateOne(
      { _id: setup.payment._id },
      { $set: { "themeSnapshot.name": "x".repeat(400) } },
    );

    await expect(
      approveWalletPayment({ walletPaymentId: setup.id, adminUserId: setup.adminUserId }),
    ).rejects.toThrowError();

    const payment = await WalletPaymentModel.findById(setup.id).lean();
    expect(payment?.status).toBe("submitted");
    expect(payment?.isOpen).toBe(true);
    expect(payment?.orderId).toBeNull();
    await expectNothingApproved(setup.themeId);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("an email failure after the commit does not undo the approval", async () => {
    const setup = await createSubmitted();
    fakeEmailSender.failNext(new Error("email down"));

    await expect(
      approveWalletPayment({ walletPaymentId: setup.id, adminUserId: setup.adminUserId }),
    ).resolves.toBeUndefined();

    expect((await WalletPaymentModel.findById(setup.id).lean())?.status).toBe("approved");
    expect(await OrderModel.countDocuments()).toBe(1);
    expect(fakeEmailSender.sent).toHaveLength(0);
  });

  it("approves even when the theme was unpublished meanwhile", async () => {
    const setup = await createSubmitted();
    await ThemeModel.updateOne({ _id: setup.themeId }, { $set: { status: "draft" } });

    await approveWalletPayment({ walletPaymentId: setup.id, adminUserId: setup.adminUserId });

    expect((await WalletPaymentModel.findById(setup.id).lean())?.status).toBe("approved");
    expect(await OrderModel.countDocuments()).toBe(1);
  });
});

describe("rejectWalletPayment", () => {
  it("saves rejected, notification, log and email; no order, no ownership", async () => {
    const setup = await createSubmitted();

    await rejectWalletPayment({
      walletPaymentId: setup.id,
      reason: "  Money not received yet  ",
      adminUserId: setup.adminUserId,
    });

    const payment = await WalletPaymentModel.findById(setup.id).lean();
    expect(payment?.status).toBe("rejected");
    expect(payment?.isOpen).toBe(false);
    expect(payment?.rejectionReason).toBe("Money not received yet");
    expect(payment?.reviewedAt).toEqual(NOW);
    expect(payment?.reviewedByUserId?.toString()).toBe(setup.adminUserId);
    expect(payment?.orderId).toBeNull();
    const notifications = await NotificationModel.find().lean();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.userId.toString()).toBe(setup.userId);
    expect(notifications[0]?.type).toBe("wallet_payment_rejected");
    expect(notifications[0]?.title).toBe(`Payment not confirmed: ${setup.themeName}`);
    expect(notifications[0]?.body).toBe("Reason: Money not received yet");
    expect(notifications[0]?.link).toBe(`/account/wallet-payments/${setup.id}`);
    const logs = await ActivityLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("wallet_payment_rejected");
    expect(logs[0]?.actorRole).toBe("admin");
    expect(logs[0]?.summary).toBe(`Wallet payment rejected: ${setup.themeName} (1,450 EGP)`);
    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.subject).toBe(`We could not confirm your payment for ${setup.themeName}`);
    expect(fakeEmailSender.sent[0]?.html).toContain("Money not received yet");
    expect(await OrderModel.countDocuments()).toBe(0);
    expect(await OwnershipModel.countDocuments()).toBe(0);
  });

  it("refuses a reason of 4 and of 501 characters → INVALID; refuses a request that is not submitted → CONFLICT", async () => {
    const setup = await createSubmitted();
    const awaiting = await createSubmitted({ status: "awaiting_payment" });

    for (const reason of ["abcd", "x".repeat(501)]) {
      await expect(
        rejectWalletPayment({ walletPaymentId: setup.id, reason, adminUserId: setup.adminUserId }),
      ).rejects.toMatchObject({ code: "INVALID", message: REASON_LENGTH });
    }
    await expect(
      rejectWalletPayment({ walletPaymentId: awaiting.id, reason: "Not paid", adminUserId: setup.adminUserId }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: ALREADY_REVIEWED });

    expect((await WalletPaymentModel.findById(setup.id).lean())?.status).toBe("submitted");
    expect((await WalletPaymentModel.findById(awaiting.id).lean())?.status).toBe("awaiting_payment");
    expect(await NotificationModel.countDocuments()).toBe(0);
    expect(fakeEmailSender.sent).toHaveLength(0);
  });

  it("unknown id → NOT_FOUND", async () => {
    await expect(
      rejectWalletPayment({
        walletPaymentId: new Types.ObjectId().toString(),
        reason: "Not paid",
        adminUserId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: NOT_FOUND });
  });

  it("the customer can start a new request afterwards", async () => {
    const setup = await createSubmitted();
    await rejectWalletPayment({ walletPaymentId: setup.id, reason: "Not paid", adminUserId: setup.adminUserId });

    const started = await startWalletPayment({
      userId: setup.userId,
      themeSlug: setup.payment.themeSnapshot.slug,
      couponCode: null,
    });

    expect(started.id).not.toBe(setup.id);
    expect(await WalletPaymentModel.countDocuments()).toBe(2);
  });
});

describe("getWalletPaymentForAdmin", () => {
  it("returns proofUrl containing the proof key, null without a proof; null for an unknown id", async () => {
    const withProof = await createSubmitted({ proof: { ...PROOF, key: "wallet-proofs/abc/shot.png" } });
    const withoutProof = await createWalletPayment();

    const detail = await getWalletPaymentForAdmin(withProof.id);
    const plain = await getWalletPaymentForAdmin(withoutProof._id.toString());

    expect(detail?.proofUrl).toContain("wallet-proofs/abc/shot.png");
    expect(fakeStorage.downloadUrlRequests).toEqual([
      { key: "wallet-proofs/abc/shot.png", expiresInSeconds: 300, downloadFileName: null },
    ]);
    expect(detail?.customer.id).toBe(withProof.userId);
    expect(detail?.themeName).toBe(withProof.themeName);
    expect(detail?.amountEgp).toBe(1450);
    expect(detail?.senderPhone).toBe("01012345678");
    expect(plain?.proofUrl).toBeNull();
    expect(await getWalletPaymentForAdmin(new Types.ObjectId().toString())).toBeNull();
    expect(await getWalletPaymentForAdmin("not-an-id")).toBeNull();
  });
});

describe("listWalletPaymentsForAdmin", () => {
  it("the review tab shows only submitted requests, oldest submittedAt first, with the customer", async () => {
    const customer = await createUser({ name: "Ann Lee", email: "ann@example.com", country: "EG" });
    const newer = await createWalletPayment({ status: "submitted", submittedAt: new Date("2026-10-31T10:00:00Z") });
    const older = await createWalletPayment({
      status: "submitted",
      submittedAt: new Date("2026-10-29T10:00:00Z"),
      userId: customer._id,
    });
    await createWalletPayment({ status: "approved" });
    await createWalletPayment();

    const page = await listWalletPaymentsForAdmin({ tab: "review", page: 1 });

    expect(page.items.map((item) => item.id)).toEqual([older._id.toString(), newer._id.toString()]);
    expect(page.total).toBe(2);
    expect(page.totalPages).toBe(1);
    expect(page.items[0]).toEqual({
      id: older._id.toString(),
      submittedAt: new Date("2026-10-29T10:00:00Z"),
      customerName: "Ann Lee",
      customerEmail: "ann@example.com",
      themeName: older.themeSnapshot.name,
      amountEgp: 1450,
      referenceCode: older.referenceCode,
    });
  });

  it("the other tabs show their status, newest first", async () => {
    const approvedOld = await createWalletPayment({ status: "approved", createdAt: new Date("2026-10-01T10:00:00Z") });
    const approvedNew = await createWalletPayment({ status: "approved", createdAt: new Date("2026-10-02T10:00:00Z") });
    const rejected = await createWalletPayment({ status: "rejected" });
    const awaiting = await createWalletPayment();
    const cancelled = await createWalletPayment({ status: "cancelled" });

    const approved = await listWalletPaymentsForAdmin({ tab: "approved", page: 1 });

    expect(approved.items.map((item) => item.id)).toEqual([approvedNew._id.toString(), approvedOld._id.toString()]);
    const expected = { rejected, awaiting, cancelled };
    for (const [tab, payment] of Object.entries(expected)) {
      const result = await listWalletPaymentsForAdmin({ tab: tab as keyof typeof expected, page: 1 });
      expect(result.items.map((item) => item.id)).toEqual([payment._id.toString()]);
    }
  });

  it("25 rows → 20 on page 1 and 5 on page 2", async () => {
    for (let index = 0; index < 25; index += 1) {
      await createWalletPayment({
        status: "submitted",
        submittedAt: new Date(Date.UTC(2026, 9, 1, 0, index)),
        userId: new Types.ObjectId(),
        themeId: new Types.ObjectId(),
      });
    }

    const first = await listWalletPaymentsForAdmin({ tab: "review", page: 1 });
    const second = await listWalletPaymentsForAdmin({ tab: "review", page: 2 });

    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(5);
    expect(first.totalPages).toBe(2);
    expect(first.total).toBe(25);
  });
});

describe("countSubmittedWalletPayments", () => {
  it("counts only submitted requests", async () => {
    await createWalletPayment({ status: "submitted" });
    await createWalletPayment({ status: "submitted" });
    await createWalletPayment();
    await createWalletPayment({ status: "approved" });
    await createTheme();

    expect(await countSubmittedWalletPayments()).toBe(2);
  });
});
