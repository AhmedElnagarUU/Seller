import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { setTestNow } from "@/shared/lib/clock";
import {
  createCoupon,
  createOwnership,
  createTheme,
  createUser,
  createWalletPayment,
  setSettings,
} from "@/shared/test/factories";
import { SettingsModel } from "@/features/settings/settings.model";
import { WALLET_REFERENCE_PATTERN } from "@/features/wallet-payments/wallet-payment.constants";
import { WalletPaymentModel } from "@/features/wallet-payments/wallet-payment.model";
import {
  cancelWalletPayment,
  getWalletPaymentPageData,
  insertWithUniqueReference,
  listWalletPaymentsForUser,
  startWalletPayment,
} from "@/features/wallet-payments/wallet-payment.service";

const NOW = new Date("2026-11-01T10:00:00Z");
const ACCOUNT = { label: "Vodafone Cash", account: "01012345678", instructions: "" };
const NOT_EGYPT = "Wallet payment is only available for customers in Egypt.";
const DISABLED = "Wallet payment is not available right now.";
const UNAVAILABLE = "This theme is not available.";
const OWNED = "You already own this theme.";
const NOT_FOUND = "Payment request not found.";
const NOT_CHANGEABLE = "This payment can no longer be changed.";

async function createSetup(country: string | null = "EG") {
  const theme = await createTheme({ status: "published", priceCents: 2900 });
  const user = await createUser({ country });
  return { theme, user, userId: user._id.toString(), themeId: theme._id.toString() };
}

beforeEach(async () => {
  setTestNow(NOW);
  await setSettings({ walletEnabled: true, usdToEgpRate: 50, walletAccounts: [ACCOUNT] });
  await WalletPaymentModel.init();
});

describe("startWalletPayment", () => {
  it("refuses a customer outside Egypt ('US' and null) → FORBIDDEN; 0 wallet payments", async () => {
    for (const country of ["US", null]) {
      const { theme, userId } = await createSetup(country);

      await expect(startWalletPayment({ userId, themeSlug: theme.slug, couponCode: null })).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: NOT_EGYPT,
      });
    }

    expect(await WalletPaymentModel.countDocuments()).toBe(0);
  });

  it("refuses when wallet payments are disabled → INVALID; 0 wallet payments", async () => {
    await setSettings({ walletEnabled: false, walletAccounts: [ACCOUNT] });
    const { theme, userId } = await createSetup();

    await expect(startWalletPayment({ userId, themeSlug: theme.slug, couponCode: null })).rejects.toMatchObject({
      code: "INVALID",
      message: DISABLED,
    });

    expect(await WalletPaymentModel.countDocuments()).toBe(0);
  });

  it("refuses a draft theme and an unknown slug → NOT_FOUND 'This theme is not available.'", async () => {
    const draft = await createTheme({ status: "draft" });
    const { userId } = await createSetup();

    for (const themeSlug of [draft.slug, "no-such-theme"]) {
      await expect(startWalletPayment({ userId, themeSlug, couponCode: null })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: UNAVAILABLE,
      });
    }

    expect(await WalletPaymentModel.countDocuments()).toBe(0);
  });

  it("refuses an owned theme → CONFLICT; a revoked ownership is allowed", async () => {
    const { theme, userId, themeId } = await createSetup();
    await createOwnership(userId, themeId);

    await expect(startWalletPayment({ userId, themeSlug: theme.slug, couponCode: null })).rejects.toMatchObject({
      code: "CONFLICT",
      message: OWNED,
    });
    expect(await WalletPaymentModel.countDocuments()).toBe(0);

    const { theme: otherTheme, userId: otherUserId, themeId: otherThemeId } = await createSetup();
    await createOwnership(otherUserId, otherThemeId, {
      status: "revoked",
      revokedAt: NOW,
      revokedReason: "admin",
      revokedByUserId: new Types.ObjectId(),
      revokeNote: "Test",
    });

    const started = await startWalletPayment({ userId: otherUserId, themeSlug: otherTheme.slug, couponCode: null });

    const saved = await WalletPaymentModel.find().lean();
    expect(saved).toHaveLength(1);
    expect(saved[0]?._id.toString()).toBe(started.id);
    expect(saved[0]?.userId.toString()).toBe(otherUserId);
  });

  it("saves the request: awaiting_payment, isOpen true, reference code, amounts, snapshot, optional fields null", async () => {
    const { theme, userId, themeId } = await createSetup();

    const started = await startWalletPayment({ userId, themeSlug: theme.slug, couponCode: null });

    const saved = await WalletPaymentModel.findById(started.id).lean();
    expect(saved?.status).toBe("awaiting_payment");
    expect(saved?.isOpen).toBe(true);
    expect(saved?.userId.toString()).toBe(userId);
    expect(saved?.themeId.toString()).toBe(themeId);
    expect(saved?.referenceCode).toMatch(WALLET_REFERENCE_PATTERN);
    expect(saved?.usdPriceCents).toBe(2900);
    expect(saved?.usdDiscountCents).toBe(0);
    expect(saved?.exchangeRate).toBe(50);
    expect(saved?.amountEgp).toBe(1450);
    expect(saved?.themeSnapshot).toEqual({ name: theme.name, slug: theme.slug });
    expect(saved?.couponId).toBeNull();
    expect(saved?.couponCode).toBeNull();
    expect(saved?.senderPhone).toBeNull();
    expect(saved?.transactionId).toBeNull();
    expect(saved?.proof).toEqual({ key: null, contentType: null, sizeBytes: null });
    expect(saved?.submittedAt).toBeNull();
    expect(saved?.reviewedAt).toBeNull();
    expect(saved?.reviewedByUserId).toBeNull();
    expect(saved?.rejectionReason).toBeNull();
    expect(saved?.orderId).toBeNull();
  });

  it("rounds the EGP amount up: rate 50.5 → amountEgp 1465", async () => {
    await setSettings({ walletEnabled: true, usdToEgpRate: 50.5, walletAccounts: [ACCOUNT] });
    const { theme, userId } = await createSetup();

    const started = await startWalletPayment({ userId, themeSlug: theme.slug, couponCode: null });

    const saved = await WalletPaymentModel.findById(started.id).lean();
    expect(saved?.amountEgp).toBe(1465);
    expect(saved?.exchangeRate).toBe(50.5);
  });

  it("applies a 20 % coupon: rate 48 → usdDiscountCents 580, amountEgp 1114, couponId and couponCode saved", async () => {
    await setSettings({ walletEnabled: true, usdToEgpRate: 48, walletAccounts: [ACCOUNT] });
    const coupon = await createCoupon({ code: "SAVE20", percentOff: 20 });
    const { theme, userId } = await createSetup();

    const started = await startWalletPayment({ userId, themeSlug: theme.slug, couponCode: "save20" });

    const saved = await WalletPaymentModel.findById(started.id).lean();
    expect(saved?.usdPriceCents).toBe(2900);
    expect(saved?.usdDiscountCents).toBe(580);
    expect(saved?.amountEgp).toBe(1114);
    expect(saved?.couponId?.toString()).toBe(coupon._id.toString());
    expect(saved?.couponCode).toBe("SAVE20");
  });

  it("refuses an invalid coupon → INVALID 'This coupon code is not valid.'; 0 wallet payments", async () => {
    const { theme, userId } = await createSetup();

    await expect(startWalletPayment({ userId, themeSlug: theme.slug, couponCode: "NOPE" })).rejects.toMatchObject({
      code: "INVALID",
      message: "This coupon code is not valid.",
    });

    expect(await WalletPaymentModel.countDocuments()).toBe(0);
  });

  it("returns the existing open request (awaiting and submitted) instead of creating a second one; a different coupon is ignored", async () => {
    await createCoupon({ code: "SAVE20", percentOff: 20 });
    const { theme, userId } = await createSetup();

    const first = await startWalletPayment({ userId, themeSlug: theme.slug, couponCode: null });
    const again = await startWalletPayment({ userId, themeSlug: theme.slug, couponCode: "SAVE20" });
    await WalletPaymentModel.updateOne({ _id: first.id }, { $set: { status: "submitted" } });
    const afterSubmit = await startWalletPayment({ userId, themeSlug: theme.slug, couponCode: null });

    expect(again.id).toBe(first.id);
    expect(afterSubmit.id).toBe(first.id);
    expect(await WalletPaymentModel.countDocuments()).toBe(1);
    expect((await WalletPaymentModel.findById(first.id).lean())?.couponCode).toBeNull();
  });

  it("after a rejected or cancelled request, creates a new one → 2 rows, different ids", async () => {
    const { theme, userId } = await createSetup();
    const first = await startWalletPayment({ userId, themeSlug: theme.slug, couponCode: null });
    await WalletPaymentModel.updateOne({ _id: first.id }, { $set: { status: "rejected", isOpen: false } });

    const second = await startWalletPayment({ userId, themeSlug: theme.slug, couponCode: null });
    await WalletPaymentModel.updateOne({ _id: second.id }, { $set: { status: "cancelled", isOpen: false } });
    const third = await startWalletPayment({ userId, themeSlug: theme.slug, couponCode: null });

    expect(new Set([first.id, second.id, third.id]).size).toBe(3);
    expect(await WalletPaymentModel.countDocuments()).toBe(3);
  });
});

describe("insertWithUniqueReference", () => {
  async function newFields() {
    const { theme, userId, themeId } = await createSetup();
    return {
      userId,
      themeId,
      themeSnapshot: { name: theme.name, slug: theme.slug },
      usdPriceCents: 2900,
      usdDiscountCents: 0,
      couponId: null,
      couponCode: null,
      exchangeRate: 50,
      amountEgp: 1450,
    };
  }

  it("uses a second code after a collision (the first generated code already exists)", async () => {
    await createWalletPayment({ referenceCode: "TS-AAAAAA" });
    const codes = ["TS-AAAAAA", "TS-BBBBBB"];

    const saved = await insertWithUniqueReference(await newFields(), () => codes.shift() ?? "TS-CCCCCC");

    expect(saved.referenceCode).toBe("TS-BBBBBB");
    expect(await WalletPaymentModel.countDocuments()).toBe(2);
  });

  it("throws 'Could not generate a unique reference code.' after 5 collisions and saves nothing new", async () => {
    await createWalletPayment({ referenceCode: "TS-AAAAAA" });
    let calls = 0;

    await expect(
      insertWithUniqueReference(await newFields(), () => {
        calls += 1;
        return "TS-AAAAAA";
      }),
    ).rejects.toThrowError(new Error("Could not generate a unique reference code."));

    expect(calls).toBe(5);
    expect(await WalletPaymentModel.countDocuments()).toBe(1);
  });
});

describe("cancelWalletPayment", () => {
  it("cancels an awaiting request; refuses submitted and approved; another user's request is NOT_FOUND", async () => {
    const awaiting = await createWalletPayment();
    const submitted = await createWalletPayment({ status: "submitted" });
    const approved = await createWalletPayment({ status: "approved" });
    const stranger = await createUser();

    await cancelWalletPayment({ userId: awaiting.userId.toString(), walletPaymentId: awaiting._id.toString() });

    const cancelled = await WalletPaymentModel.findById(awaiting._id).lean();
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.isOpen).toBe(false);
    for (const payment of [submitted, approved]) {
      await expect(
        cancelWalletPayment({ userId: payment.userId.toString(), walletPaymentId: payment._id.toString() }),
      ).rejects.toMatchObject({ code: "CONFLICT", message: NOT_CHANGEABLE });
    }
    expect((await WalletPaymentModel.findById(submitted._id).lean())?.status).toBe("submitted");
    const other = await createWalletPayment();
    await expect(
      cancelWalletPayment({ userId: stranger._id.toString(), walletPaymentId: other._id.toString() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: NOT_FOUND });
    expect((await WalletPaymentModel.findById(other._id).lean())?.status).toBe("awaiting_payment");
  });
});

describe("getWalletPaymentPageData", () => {
  it("gives the owner the data with the wallet accounts; another user and an invalid id get null; accounts are [] after submit", async () => {
    const payment = await createWalletPayment();
    const userId = payment.userId.toString();
    const id = payment._id.toString();
    const stranger = await createUser();

    const data = await getWalletPaymentPageData(userId, id);

    expect(data?.payment.id).toBe(id);
    expect(data?.payment.referenceCode).toBe(payment.referenceCode);
    expect(data?.payment.amountEgp).toBe(1450);
    expect(data?.accounts).toEqual([ACCOUNT]);
    expect(await getWalletPaymentPageData(stranger._id.toString(), id)).toBeNull();
    expect(await getWalletPaymentPageData(userId, "not-an-id")).toBeNull();
    expect(await getWalletPaymentPageData(userId, new Types.ObjectId().toString())).toBeNull();

    await WalletPaymentModel.updateOne({ _id: id }, { $set: { status: "submitted" } });

    const afterSubmit = await getWalletPaymentPageData(userId, id);
    expect(afterSubmit?.payment.status).toBe("submitted");
    expect(afterSubmit?.accounts).toEqual([]);
  });
});

describe("listWalletPaymentsForUser", () => {
  it("lists the requests of the user, newest first, and no one else's", async () => {
    const user = await createUser({ country: "EG" });
    const older = await createWalletPayment({
      userId: user._id,
      status: "cancelled",
      createdAt: new Date("2026-10-01T10:00:00Z"),
    });
    const newer = await createWalletPayment({ userId: user._id, createdAt: new Date("2026-10-02T10:00:00Z") });
    await createWalletPayment();

    const list = await listWalletPaymentsForUser(user._id.toString());

    expect(list.map((item) => item.id)).toEqual([newer._id.toString(), older._id.toString()]);
    expect(list[0]).toEqual({
      id: newer._id.toString(),
      referenceCode: newer.referenceCode,
      themeName: newer.themeSnapshot.name,
      amountEgp: 1450,
      status: "awaiting_payment",
    });
  });
});

describe("settings used by the wallet", () => {
  it("a missing settings document means the wallet is off", async () => {
    await SettingsModel.deleteMany({});
    const { theme, userId } = await createSetup();

    await expect(startWalletPayment({ userId, themeSlug: theme.slug, couponCode: null })).rejects.toMatchObject({
      code: "INVALID",
      message: DISABLED,
    });
  });
});
