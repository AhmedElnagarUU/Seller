import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { CouponModel } from "@/features/coupons/coupon.model";
import type { CouponInput, CouponUpdateInput } from "@/features/coupons/coupon.schemas";
import * as couponService from "@/features/coupons/coupon.service";
import { withTransaction } from "@/shared/db/transaction";
import { setTestNow } from "@/shared/lib/clock";
import { fakePaymentProvider } from "@/shared/test/fakes/fake-payment-provider";
import { createAdmin, createCoupon, createTheme } from "@/shared/test/factories";

const FIXED_NOW = new Date("2026-11-01T10:00:00Z");
const LATER = new Date("2026-12-01T10:00:00Z");
const EARLIER = new Date("2026-10-01T10:00:00Z");
const NOT_VALID = "This coupon code is not valid.";
const EXPIRED = "This coupon has expired.";
const LIMIT_REACHED = "This coupon has reached its usage limit.";
const WRONG_THEME = "This coupon cannot be used for this theme.";
const CODE_USED = "This coupon code is already used.";
const NOT_SYNCED = "Choose themes that are synced with the payment provider.";
const NOT_FOUND = "Coupon not found.";
const UNKNOWN_ID = "665f1c2e8f1b2c3d4e5f6a7b";

function newId(): string {
  return new Types.ObjectId().toString();
}

function silenceConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

function couponInput(overrides: Partial<CouponInput> = {}): CouponInput {
  return {
    code: "SAVE20",
    type: "percent",
    percentOff: 20,
    amountOffCents: null,
    appliesTo: "all",
    themeIds: [],
    expiresAt: null,
    maxRedemptions: null,
    ...overrides,
  };
}

function updateInput(overrides: Partial<CouponUpdateInput> = {}): CouponUpdateInput {
  return { ...couponInput(), active: true, ...overrides };
}

// A theme that is already synced with the payment provider.
async function createSyncedTheme(productId: string) {
  return createTheme({ provider: { productId, syncedAt: FIXED_NOW } });
}

function expectError(promise: Promise<unknown>, code: string, message: string) {
  return expect(promise).rejects.toThrowError(expect.objectContaining({ code, message }));
}

describe("quote", () => {
  it("unknown code → INVALID 'This coupon code is not valid.'", async () => {
    await expectError(couponService.quote({ themeId: newId(), priceCents: 2900, code: "NOPE" }), "INVALID", NOT_VALID);
  });

  it("inactive coupon → INVALID 'This coupon code is not valid.'", async () => {
    await createCoupon({ code: "OFF", active: false });

    await expectError(couponService.quote({ themeId: newId(), priceCents: 2900, code: "OFF" }), "INVALID", NOT_VALID);
  });

  it("expired coupon → INVALID 'This coupon has expired.'; a coupon expiring exactly now is expired too", async () => {
    setTestNow(FIXED_NOW);
    await createCoupon({ code: "OLD", expiresAt: EARLIER });
    await createCoupon({ code: "NOW", expiresAt: FIXED_NOW });
    await createCoupon({ code: "LATER", expiresAt: LATER });

    await expectError(couponService.quote({ themeId: newId(), priceCents: 2900, code: "OLD" }), "INVALID", EXPIRED);
    await expectError(couponService.quote({ themeId: newId(), priceCents: 2900, code: "NOW" }), "INVALID", EXPIRED);
    const accepted = await couponService.quote({ themeId: newId(), priceCents: 2900, code: "LATER" });
    expect(accepted.code).toBe("LATER");
  });

  it("used up (maxRedemptions 5, redemptionsCount 5) → INVALID 'This coupon has reached its usage limit.'; redemptionsCount 4 is accepted", async () => {
    await createCoupon({ code: "FULL", maxRedemptions: 5, redemptionsCount: 5 });
    await createCoupon({ code: "ALMOST", maxRedemptions: 5, redemptionsCount: 4 });

    await expectError(
      couponService.quote({ themeId: newId(), priceCents: 2900, code: "FULL" }),
      "INVALID",
      LIMIT_REACHED,
    );
    const accepted = await couponService.quote({ themeId: newId(), priceCents: 2900, code: "ALMOST" });
    expect(accepted.code).toBe("ALMOST");
  });

  it("coupon for other themes → INVALID 'This coupon cannot be used for this theme.'; a coupon for the right theme is accepted", async () => {
    const theme = await createTheme();
    const otherTheme = await createTheme();
    await createCoupon({ code: "OTHER", appliesTo: "selected", themeIds: [otherTheme._id] });
    await createCoupon({ code: "RIGHT", appliesTo: "selected", themeIds: [otherTheme._id, theme._id] });
    const themeId = theme._id.toString();

    await expectError(couponService.quote({ themeId, priceCents: 2900, code: "OTHER" }), "INVALID", WRONG_THEME);
    const accepted = await couponService.quote({ themeId, priceCents: 2900, code: "RIGHT" });
    expect(accepted.code).toBe("RIGHT");
  });

  it("price after discount below 100 cents (price 900, fixed 1000) → INVALID 'This coupon cannot be used for this theme.'; price 1100 with fixed 1000 (final exactly 100) is accepted", async () => {
    await createCoupon({ code: "TEN", type: "fixed", percentOff: null, amountOffCents: 1000 });

    await expectError(couponService.quote({ themeId: newId(), priceCents: 900, code: "TEN" }), "INVALID", WRONG_THEME);
    const accepted = await couponService.quote({ themeId: newId(), priceCents: 1100, code: "TEN" });
    expect(accepted).toMatchObject({ discountCents: 1000, finalCents: 100 });
  });

  it("checks run in order: expired and inactive → not valid; expired and used up → expired; used up for the wrong theme → usage limit", async () => {
    setTestNow(FIXED_NOW);
    await createCoupon({ code: "ALPHA", active: false, expiresAt: EARLIER });
    await createCoupon({ code: "BRAVO", maxRedemptions: 1, redemptionsCount: 1, expiresAt: EARLIER });
    await createCoupon({
      code: "CHARLIE",
      maxRedemptions: 1,
      redemptionsCount: 1,
      appliesTo: "selected",
      themeIds: [new Types.ObjectId()],
    });

    await expectError(couponService.quote({ themeId: newId(), priceCents: 2900, code: "ALPHA" }), "INVALID", NOT_VALID);
    await expectError(couponService.quote({ themeId: newId(), priceCents: 2900, code: "BRAVO" }), "INVALID", EXPIRED);
    await expectError(
      couponService.quote({ themeId: newId(), priceCents: 2900, code: "CHARLIE" }),
      "INVALID",
      LIMIT_REACHED,
    );
  });

  it("percent: price 2900, 20 % → discount 580, final 2320; rounding: price 1999, 15 % → discount 300, final 1699", async () => {
    await createCoupon({ code: "P20", percentOff: 20 });
    await createCoupon({ code: "P15", percentOff: 15 });

    const twenty = await couponService.quote({ themeId: newId(), priceCents: 2900, code: "P20" });
    const fifteen = await couponService.quote({ themeId: newId(), priceCents: 1999, code: "P15" });

    expect(twenty).toMatchObject({ discountCents: 580, finalCents: 2320 });
    expect(fifteen).toMatchObject({ discountCents: 300, finalCents: 1699 });
  });

  it("fixed: price 2900, fixed 1000 → discount 1000, final 1900", async () => {
    const coupon = await createCoupon({ code: "TEN", type: "fixed", percentOff: null, amountOffCents: 1000 });

    const result = await couponService.quote({ themeId: newId(), priceCents: 2900, code: "TEN" });

    expect(result).toEqual({ couponId: coupon._id.toString(), code: "TEN", discountCents: 1000, finalCents: 1900 });
  });

  it("finds the code with spaces and lower case and returns the stored code SAVE20", async () => {
    await createCoupon({ code: "SAVE20" });

    const result = await couponService.quote({ themeId: newId(), priceCents: 2900, code: " save20 " });

    expect(result.code).toBe("SAVE20");
  });

  it("writes nothing: redemptionsCount is still 0 after a quote", async () => {
    const coupon = await createCoupon({ code: "SAVE20" });

    await couponService.quote({ themeId: newId(), priceCents: 2900, code: "SAVE20" });

    const saved = await CouponModel.findById(coupon._id).lean();
    expect(saved?.redemptionsCount).toBe(0);
    expect(await CouponModel.countDocuments()).toBe(1);
  });
});

describe("createCoupon", () => {
  it("saves an all-themes percent coupon and writes one coupon_created log", async () => {
    const admin = await createAdmin();

    const { id } = await couponService.createCoupon(couponInput({ code: "SAVE20" }), admin._id.toString());

    const saved = await CouponModel.findById(id).lean();
    expect(saved).toMatchObject({
      code: "SAVE20",
      type: "percent",
      percentOff: 20,
      amountOffCents: null,
      appliesTo: "all",
      redemptionsCount: 0,
      active: true,
      expiresAt: null,
      maxRedemptions: null,
    });
    expect(saved?.themeIds).toEqual([]);
    const logs = await ActivityLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: "coupon_created",
      actorRole: "admin",
      targetType: "coupon",
      summary: "Coupon created: SAVE20",
      subjectUserId: null,
    });
    expect(logs[0]?.actorUserId?.toString()).toBe(admin._id.toString());
    expect(logs[0]?.targetId?.toString()).toBe(id);
  });

  it("sends the coupon to the provider and stores the id", async () => {
    setTestNow(FIXED_NOW);
    const admin = await createAdmin();

    const { id } = await couponService.createCoupon(couponInput(), admin._id.toString());

    expect(fakePaymentProvider.calls).toEqual([
      {
        method: "upsertDiscount",
        input: {
          couponId: id,
          code: "SAVE20",
          type: "percent",
          percentOff: 20,
          amountOffCents: null,
          productIds: null,
          existingDiscountId: null,
        },
      },
    ]);
    const saved = await CouponModel.findById(id).lean();
    expect(saved?.provider.discountId).toBe("fake_disc_" + id);
    expect(saved?.provider.syncedAt).toEqual(FIXED_NOW);
  });

  it("for selected themes sends their product ids to the provider", async () => {
    const admin = await createAdmin();
    const first = await createSyncedTheme("prod_1");
    const second = await createSyncedTheme("prod_2");
    await createSyncedTheme("prod_3");

    const { id } = await couponService.createCoupon(
      couponInput({
        type: "fixed",
        percentOff: null,
        amountOffCents: 500,
        appliesTo: "selected",
        themeIds: [first._id.toString(), second._id.toString()],
      }),
      admin._id.toString(),
    );

    expect(fakePaymentProvider.calls).toHaveLength(1);
    expect(fakePaymentProvider.calls[0]?.input).toEqual({
      couponId: id,
      code: "SAVE20",
      type: "fixed",
      percentOff: null,
      amountOffCents: 500,
      productIds: expect.arrayContaining(["prod_1", "prod_2"]),
      existingDiscountId: null,
    });
    const saved = await CouponModel.findById(id).lean();
    expect(saved?.themeIds.map(String).sort()).toEqual([first._id.toString(), second._id.toString()].sort());
  });

  it("keeps the coupon when the provider fails", async () => {
    const consoleError = silenceConsoleError();
    const admin = await createAdmin();
    fakePaymentProvider.failNext(new Error("Polar is down"));

    try {
      const { id } = await couponService.createCoupon(couponInput(), admin._id.toString());

      expect(await CouponModel.countDocuments()).toBe(1);
      const saved = await CouponModel.findById(id).lean();
      expect(saved?.provider.discountId).toBeNull();
      expect(saved?.provider.syncedAt).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("refuses a used code, also in another letter case", async () => {
    const admin = await createAdmin();
    const adminId = admin._id.toString();
    await couponService.createCoupon(couponInput({ code: "SAVE20" }), adminId);

    await expectError(couponService.createCoupon(couponInput({ code: "SAVE20" }), adminId), "CONFLICT", CODE_USED);
    await expectError(couponService.createCoupon(couponInput({ code: "save20" }), adminId), "CONFLICT", CODE_USED);

    expect(await CouponModel.countDocuments()).toBe(1);
    expect(await ActivityLogModel.countDocuments()).toBe(1);
  });

  it("refuses a selected theme without a Polar product id, and an unknown theme id", async () => {
    const admin = await createAdmin();
    const adminId = admin._id.toString();
    const unsynced = await createTheme();
    const synced = await createSyncedTheme("prod_1");

    await expectError(
      couponService.createCoupon(couponInput({ appliesTo: "selected", themeIds: [unsynced._id.toString()] }), adminId),
      "INVALID",
      NOT_SYNCED,
    );
    await expectError(
      couponService.createCoupon(couponInput({ appliesTo: "selected", themeIds: [newId()] }), adminId),
      "INVALID",
      NOT_SYNCED,
    );
    await expectError(
      couponService.createCoupon(
        couponInput({ appliesTo: "selected", themeIds: [synced._id.toString(), newId()] }),
        adminId,
      ),
      "INVALID",
      NOT_SYNCED,
    );

    expect(await CouponModel.countDocuments()).toBe(0);
    expect(fakePaymentProvider.calls).toEqual([]);
  });
});

describe("updateCoupon", () => {
  it("changes every field and keeps redemptionsCount", async () => {
    const theme = await createSyncedTheme("prod_1");
    const coupon = await createCoupon({ code: "SAVE20", redemptionsCount: 2 });
    const expiresAt = new Date("2026-12-31T23:59:59.999Z");

    await couponService.updateCoupon(
      coupon._id.toString(),
      updateInput({
        code: "NEW-CODE",
        type: "fixed",
        percentOff: null,
        amountOffCents: 500,
        appliesTo: "selected",
        themeIds: [theme._id.toString()],
        expiresAt,
        maxRedemptions: 3,
        active: false,
      }),
    );

    const saved = await CouponModel.findById(coupon._id).lean();
    expect(saved).toMatchObject({
      code: "NEW-CODE",
      type: "fixed",
      percentOff: null,
      amountOffCents: 500,
      appliesTo: "selected",
      expiresAt,
      maxRedemptions: 3,
      active: false,
      redemptionsCount: 2,
    });
    expect(saved?.themeIds.map(String)).toEqual([theme._id.toString()]);
  });

  it("replaces the provider discount when the discount changes", async () => {
    const coupon = await createCoupon({ code: "SAVE20", provider: { discountId: "old_disc_1", syncedAt: EARLIER } });
    const id = coupon._id.toString();

    await couponService.updateCoupon(id, updateInput({ percentOff: 30 }));

    expect(fakePaymentProvider.calls).toEqual([
      {
        method: "upsertDiscount",
        input: {
          couponId: id,
          code: "SAVE20",
          type: "percent",
          percentOff: 30,
          amountOffCents: null,
          productIds: null,
          existingDiscountId: null,
        },
      },
      { method: "deleteDiscount", input: { discountId: "old_disc_1" } },
    ]);
    const saved = await CouponModel.findById(id).lean();
    expect(saved?.percentOff).toBe(30);
    expect(saved?.provider.discountId).toBe("fake_disc_" + id);
  });

  it("makes no provider call when only active, expiresAt or maxRedemptions change", async () => {
    const coupon = await createCoupon({ code: "SAVE20", provider: { discountId: "old_disc_1", syncedAt: EARLIER } });

    await couponService.updateCoupon(
      coupon._id.toString(),
      updateInput({ active: false, expiresAt: LATER, maxRedemptions: 7 }),
    );

    expect(fakePaymentProvider.calls).toEqual([]);
    const saved = await CouponModel.findById(coupon._id).lean();
    expect(saved).toMatchObject({ active: false, expiresAt: LATER, maxRedemptions: 7 });
    expect(saved?.provider.discountId).toBe("old_disc_1");
  });

  it("saves the changes and clears the discount id when the provider fails", async () => {
    const consoleError = silenceConsoleError();
    const coupon = await createCoupon({ code: "SAVE20", provider: { discountId: "old_disc_1", syncedAt: EARLIER } });
    fakePaymentProvider.failNext(new Error("Polar is down"));

    try {
      await couponService.updateCoupon(coupon._id.toString(), updateInput({ percentOff: 30 }));

      const saved = await CouponModel.findById(coupon._id).lean();
      expect(saved?.percentOff).toBe(30);
      expect(saved?.provider.discountId).toBeNull();
      expect(saved?.provider.syncedAt).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("refuses a code used by another coupon; keeping its own code is accepted", async () => {
    await createCoupon({ code: "FIRST" });
    const second = await createCoupon({ code: "SECOND" });
    const id = second._id.toString();

    await expectError(couponService.updateCoupon(id, updateInput({ code: "FIRST" })), "CONFLICT", CODE_USED);
    await expectError(couponService.updateCoupon(id, updateInput({ code: "first" })), "CONFLICT", CODE_USED);
    await couponService.updateCoupon(id, updateInput({ code: "SECOND", maxRedemptions: 4 }));

    const saved = await CouponModel.findById(id).lean();
    expect(saved).toMatchObject({ code: "SECOND", maxRedemptions: 4 });
  });

  it("refuses a selected theme without a Polar product id; the coupon is unchanged", async () => {
    const unsynced = await createTheme();
    const coupon = await createCoupon({ code: "SAVE20" });

    await expectError(
      couponService.updateCoupon(
        coupon._id.toString(),
        updateInput({ appliesTo: "selected", themeIds: [unsynced._id.toString()], percentOff: 50 }),
      ),
      "INVALID",
      NOT_SYNCED,
    );

    const saved = await CouponModel.findById(coupon._id).lean();
    expect(saved).toMatchObject({ appliesTo: "all", percentOff: 20 });
    expect(saved?.themeIds).toEqual([]);
    expect(fakePaymentProvider.calls).toEqual([]);
  });

  it("unknown id → NOT_FOUND 'Coupon not found.'", async () => {
    await expectError(couponService.updateCoupon(UNKNOWN_ID, updateInput()), "NOT_FOUND", NOT_FOUND);
    await expectError(couponService.updateCoupon("not-an-id", updateInput()), "NOT_FOUND", NOT_FOUND);
  });
});

describe("deleteCoupon", () => {
  it("removes the coupon and deletes its provider discount", async () => {
    const coupon = await createCoupon({ provider: { discountId: "old_disc_1", syncedAt: EARLIER } });
    await createCoupon();

    await couponService.deleteCoupon(coupon._id.toString());

    expect(await CouponModel.findById(coupon._id).lean()).toBeNull();
    expect(await CouponModel.countDocuments()).toBe(1);
    expect(fakePaymentProvider.calls).toEqual([{ method: "deleteDiscount", input: { discountId: "old_disc_1" } }]);
  });

  it("still deletes when the provider fails", async () => {
    const consoleError = silenceConsoleError();
    const coupon = await createCoupon({ provider: { discountId: "old_disc_1", syncedAt: EARLIER } });
    fakePaymentProvider.failNext(new Error("Polar is down"));

    try {
      await couponService.deleteCoupon(coupon._id.toString());

      expect(await CouponModel.countDocuments()).toBe(0);
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("makes no provider call for a coupon that was never synced", async () => {
    const coupon = await createCoupon();

    await couponService.deleteCoupon(coupon._id.toString());

    expect(await CouponModel.countDocuments()).toBe(0);
    expect(fakePaymentProvider.calls).toEqual([]);
  });

  it("unknown id → NOT_FOUND 'Coupon not found.'", async () => {
    await expectError(couponService.deleteCoupon(UNKNOWN_ID), "NOT_FOUND", NOT_FOUND);
    await expectError(couponService.deleteCoupon("not-an-id"), "NOT_FOUND", NOT_FOUND);
  });
});

describe("ensureDiscountId", () => {
  it("returns the saved id without calling the provider", async () => {
    const coupon = await createCoupon({ provider: { discountId: "disc_saved", syncedAt: EARLIER } });

    const discountId = await couponService.ensureDiscountId(coupon._id.toString());

    expect(discountId).toBe("disc_saved");
    expect(fakePaymentProvider.calls).toEqual([]);
  });

  it("syncs a coupon that has no id, saves it and returns it; returns null and saves nothing when the provider fails", async () => {
    setTestNow(FIXED_NOW);
    const consoleError = silenceConsoleError();
    const coupon = await createCoupon();
    const id = coupon._id.toString();
    fakePaymentProvider.failNext(new Error("Polar is down"));

    try {
      const failed = await couponService.ensureDiscountId(id);

      expect(failed).toBeNull();
      expect((await CouponModel.findById(id).lean())?.provider).toEqual({ discountId: null, syncedAt: null });

      const synced = await couponService.ensureDiscountId(id);

      expect(synced).toBe("fake_disc_" + id);
      expect((await CouponModel.findById(id).lean())?.provider).toEqual({
        discountId: "fake_disc_" + id,
        syncedAt: FIXED_NOW,
      });
      expect(await couponService.ensureDiscountId(UNKNOWN_ID)).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("recordRedemption", () => {
  it("adds 1 to redemptionsCount", async () => {
    const coupon = await createCoupon({ redemptionsCount: 2 });

    await withTransaction((session) => couponService.recordRedemption(coupon._id.toString(), session));

    expect((await CouponModel.findById(coupon._id).lean())?.redemptionsCount).toBe(3);
  });
});

describe("getCouponSummary", () => {
  it("returns { id, code }; null for an unknown or invalid id", async () => {
    const coupon = await createCoupon({ code: "SAVE20" });

    expect(await couponService.getCouponSummary(coupon._id.toString())).toEqual({
      id: coupon._id.toString(),
      code: "SAVE20",
    });
    expect(await couponService.getCouponSummary(UNKNOWN_ID)).toBeNull();
    expect(await couponService.getCouponSummary("not-an-id")).toBeNull();
  });
});

describe("getCouponForAdmin and listCouponsForAdmin", () => {
  it("returns the coupon with theme names and isSynced; null for an unknown id", async () => {
    const theme = await createSyncedTheme("prod_1");
    const coupon = await createCoupon({
      code: "SAVE20",
      appliesTo: "selected",
      themeIds: [theme._id],
      provider: { discountId: "disc_1", syncedAt: EARLIER },
    });
    const unsynced = await createCoupon({ code: "OTHER" });

    const dto = await couponService.getCouponForAdmin(coupon._id.toString());

    expect(dto).toMatchObject({
      id: coupon._id.toString(),
      code: "SAVE20",
      themeIds: [theme._id.toString()],
      themeNames: [theme.name],
      isSynced: true,
    });
    expect((await couponService.getCouponForAdmin(unsynced._id.toString()))?.isSynced).toBe(false);
    expect(await couponService.getCouponForAdmin(UNKNOWN_ID)).toBeNull();
  });

  it("lists the coupons newest first", async () => {
    await createCoupon({ code: "OLDER" });
    await createCoupon({ code: "NEWER" });

    const list = await couponService.listCouponsForAdmin();

    expect(list.map((item) => item.code)).toEqual(["NEWER", "OLDER"]);
  });
});
