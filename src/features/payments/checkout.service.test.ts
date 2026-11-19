import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestNow } from "@/shared/lib/clock";
import { fakePaymentProvider } from "@/shared/test/fakes/fake-payment-provider";
import { createCoupon, createOwnership, createTheme, createUser } from "@/shared/test/factories";
import { CouponModel } from "@/features/coupons/coupon.model";
import { OrderModel } from "@/features/orders/order.model";
import {
  getCheckoutPageData,
  getFakeCheckoutData,
  simulateFakePayment,
  startCardCheckout,
} from "@/features/payments/checkout.service";

const NOW = new Date("2026-11-01T10:00:00Z");
const CARD_UNAVAILABLE = "Card payment is not available for this theme right now. Please try again later.";

async function createPublishedTheme(overrides: Parameters<typeof createTheme>[0] = {}) {
  return createTheme({
    status: "published",
    priceCents: 2900,
    provider: { productId: "fake_prod_x", syncedAt: null },
    ...overrides,
  });
}

async function createCheckoutInput(themeSlug: string, couponCode: string | null = null) {
  const user = await createUser({ name: "Ann Lee", email: "ann@example.com" });
  return {
    user,
    input: {
      userId: user._id.toString(),
      customerEmail: "ann@example.com",
      customerName: "Ann Lee",
      themeSlug,
      couponCode,
    },
  };
}

function checkoutCalls() {
  return fakePaymentProvider.calls.filter((call) => call.method === "createCheckout");
}

beforeEach(() => {
  setTestNow(NOW);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startCardCheckout", () => {
  it("refuses a draft theme and an unknown slug → NOT_FOUND 'This theme is not available.'; 0 provider calls", async () => {
    const draft = await createTheme({ provider: { productId: "fake_prod_x", syncedAt: null } });
    const { input } = await createCheckoutInput(draft.slug);

    await expect(startCardCheckout(input)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "This theme is not available.",
    });
    await expect(startCardCheckout({ ...input, themeSlug: "unknown-slug" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "This theme is not available.",
    });
    expect(fakePaymentProvider.calls).toHaveLength(0);
  });

  it("refuses an already owned theme → CONFLICT 'You already own this theme.'; a revoked ownership is allowed", async () => {
    const theme = await createPublishedTheme();
    const { user, input } = await createCheckoutInput(theme.slug);
    await createOwnership(user._id.toString(), theme._id.toString());

    await expect(startCardCheckout(input)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "You already own this theme.",
    });
    expect(checkoutCalls()).toHaveLength(0);

    const revokedTheme = await createPublishedTheme();
    await createOwnership(user._id.toString(), revokedTheme._id.toString(), {
      status: "revoked",
      revokedAt: NOW,
      revokedReason: "refund",
    });

    const result = await startCardCheckout({ ...input, themeSlug: revokedTheme.slug });

    expect(result.url).toContain("/checkout/fake/");
    expect(checkoutCalls()).toHaveLength(1);
  });

  it("refuses an invalid coupon → INVALID 'This coupon code is not valid.'; 0 provider calls", async () => {
    const theme = await createPublishedTheme();
    const { input } = await createCheckoutInput(theme.slug, "NOPE");

    await expect(startCardCheckout(input)).rejects.toMatchObject({
      code: "INVALID",
      message: "This coupon code is not valid.",
    });
    expect(fakePaymentProvider.calls).toHaveLength(0);
  });

  it("refuses a theme without a provider product id → INVALID card unavailable; console.error was called", async () => {
    const theme = await createPublishedTheme({ provider: { productId: null, syncedAt: null } });
    const { input } = await createCheckoutInput(theme.slug);

    await expect(startCardCheckout(input)).rejects.toMatchObject({ code: "INVALID", message: CARD_UNAVAILABLE });

    expect(console.error).toHaveBeenCalledWith("card checkout: theme has no provider product", theme._id.toString());
    expect(fakePaymentProvider.calls).toHaveLength(0);
  });

  it("syncs a coupon that has no discount id first and uses the new id", async () => {
    const theme = await createPublishedTheme();
    const coupon = await createCoupon();
    const { input } = await createCheckoutInput(theme.slug, coupon.code);

    await startCardCheckout(input);

    expect(fakePaymentProvider.calls.map((call) => call.method)).toEqual(["upsertDiscount", "createCheckout"]);
    const couponId = coupon._id.toString();
    expect(checkoutCalls()[0]?.input).toMatchObject({ discountId: "fake_disc_" + couponId, couponId });
    expect((await CouponModel.findById(couponId).lean())?.provider.discountId).toBe("fake_disc_" + couponId);
  });

  it("uses the saved discount id of a coupon that is synced already", async () => {
    const theme = await createPublishedTheme();
    const coupon = await createCoupon({ provider: { discountId: "disc_saved", syncedAt: NOW } });
    const { input } = await createCheckoutInput(theme.slug, coupon.code);

    await startCardCheckout(input);

    expect(fakePaymentProvider.calls.map((call) => call.method)).toEqual(["createCheckout"]);
    expect(checkoutCalls()[0]?.input).toMatchObject({ discountId: "disc_saved" });
  });

  it("when the coupon sync fails → the same card-unavailable error and no checkout call", async () => {
    const theme = await createPublishedTheme();
    const coupon = await createCoupon();
    const { input } = await createCheckoutInput(theme.slug, coupon.code);
    fakePaymentProvider.failNext(new Error("Polar is down"));

    await expect(startCardCheckout(input)).rejects.toMatchObject({ code: "INVALID", message: CARD_UNAVAILABLE });

    expect(checkoutCalls()).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith("card checkout: coupon has no provider discount", theme._id.toString());
  });

  it("a provider failure (failNext) → the same card-unavailable error", async () => {
    const theme = await createPublishedTheme();
    const { input } = await createCheckoutInput(theme.slug);
    fakePaymentProvider.failNext(new Error("Polar is down"));

    await expect(startCardCheckout(input)).rejects.toMatchObject({ code: "INVALID", message: CARD_UNAVAILABLE });

    expect(checkoutCalls()).toHaveLength(1);
  });

  it("passes product id, discount id, userId, themeId, couponId, email, name and successUrl to the provider; returns the URL of the fake checkout", async () => {
    const theme = await createPublishedTheme();
    const coupon = await createCoupon({ provider: { discountId: "disc_1", syncedAt: NOW } });
    const { user, input } = await createCheckoutInput(theme.slug, coupon.code);

    const result = await startCardCheckout(input);

    expect(checkoutCalls()).toHaveLength(1);
    expect(checkoutCalls()[0]?.input).toEqual({
      productId: "fake_prod_x",
      discountId: "disc_1",
      userId: user._id.toString(),
      themeId: theme._id.toString(),
      couponId: coupon._id.toString(),
      customerEmail: "ann@example.com",
      customerName: "Ann Lee",
      successUrl: "http://localhost:3000/checkout/success?checkout_id={CHECKOUT_ID}",
    });
    expect(result.url).toMatch(
      new RegExp(
        `^http://localhost:3000/checkout/fake/fake_chk_[0-9a-f]{16}\\?theme=${theme._id.toString()}&coupon=${coupon._id.toString()}$`,
      ),
    );
  });

  it("without a coupon passes discountId null and couponId null", async () => {
    const theme = await createPublishedTheme();
    const { input } = await createCheckoutInput(theme.slug);

    const result = await startCardCheckout(input);

    expect(checkoutCalls()[0]?.input).toMatchObject({ discountId: null, couponId: null });
    expect(result.url).toContain(`?theme=${theme._id.toString()}&coupon=`);
    expect(result.url.endsWith("&coupon=")).toBe(true);
  });
});

describe("getCheckoutPageData", () => {
  it("ready: the 20 % coupon gives quote.finalCents 2320 and finalPriceCents 2320", async () => {
    const theme = await createPublishedTheme({ name: "Aurora Blog", tagline: "A calm theme for writers" });
    const coupon = await createCoupon({ percentOff: 20 });
    const user = await createUser();

    const data = await getCheckoutPageData(user._id.toString(), theme.slug, ` ${coupon.code} `);

    expect(data).toEqual({
      kind: "ready",
      theme: {
        id: theme._id.toString(),
        slug: theme.slug,
        name: "Aurora Blog",
        tagline: "A calm theme for writers",
        priceCents: 2900,
      },
      couponCode: coupon.code,
      quote: { couponId: coupon._id.toString(), code: coupon.code, discountCents: 580, finalCents: 2320 },
      couponError: null,
      finalPriceCents: 2320,
    });
  });

  it("ready without a coupon: finalPriceCents is the theme price", async () => {
    const theme = await createPublishedTheme();
    const user = await createUser();

    const withNull = await getCheckoutPageData(user._id.toString(), theme.slug, null);
    const withBlank = await getCheckoutPageData(user._id.toString(), theme.slug, "   ");

    for (const data of [withNull, withBlank]) {
      expect(data).toMatchObject({
        kind: "ready",
        couponCode: null,
        quote: null,
        couponError: null,
        finalPriceCents: 2900,
      });
    }
  });

  it("an expired coupon gives couponError 'This coupon has expired.', quote null, finalPriceCents 2900", async () => {
    const theme = await createPublishedTheme();
    const coupon = await createCoupon({ expiresAt: new Date("2026-10-01T10:00:00Z") });
    const user = await createUser();

    const data = await getCheckoutPageData(user._id.toString(), theme.slug, coupon.code);

    expect(data).toMatchObject({
      kind: "ready",
      couponCode: coupon.code,
      quote: null,
      couponError: "This coupon has expired.",
      finalPriceCents: 2900,
    });
  });

  it("owned for an owner, not_found for a draft theme and an unknown slug", async () => {
    const theme = await createPublishedTheme();
    const draft = await createTheme();
    const user = await createUser();
    await createOwnership(user._id.toString(), theme._id.toString());

    expect(await getCheckoutPageData(user._id.toString(), theme.slug, null)).toEqual({ kind: "owned" });
    expect(await getCheckoutPageData(user._id.toString(), draft.slug, null)).toEqual({ kind: "not_found" });
    expect(await getCheckoutPageData(user._id.toString(), "unknown-slug", null)).toEqual({ kind: "not_found" });
  });
});

describe("getFakeCheckoutData", () => {
  it("gives the prices with and without a coupon", async () => {
    const theme = await createPublishedTheme({ name: "Aurora Blog" });
    const coupon = await createCoupon({ percentOff: 20 });

    const withCoupon = await getFakeCheckoutData({ themeId: theme._id.toString(), couponId: coupon._id.toString() });
    const withoutCoupon = await getFakeCheckoutData({ themeId: theme._id.toString(), couponId: "" });

    expect(withCoupon).toEqual({
      themeName: "Aurora Blog",
      subtotalCents: 2900,
      discountCents: 580,
      totalCents: 2320,
      couponCode: coupon.code,
    });
    expect(withoutCoupon).toEqual({
      themeName: "Aurora Blog",
      subtotalCents: 2900,
      discountCents: 0,
      totalCents: 2900,
      couponCode: null,
    });
  });

  it("gives null for an unknown theme, an unknown coupon id and a coupon that cannot be used", async () => {
    const theme = await createPublishedTheme();
    const expired = await createCoupon({ expiresAt: new Date("2026-10-01T10:00:00Z") });
    const themeId = theme._id.toString();

    expect(await getFakeCheckoutData({ themeId: "not-an-id", couponId: "" })).toBeNull();
    expect(await getFakeCheckoutData({ themeId: new Types.ObjectId().toString(), couponId: "" })).toBeNull();
    expect(await getFakeCheckoutData({ themeId, couponId: new Types.ObjectId().toString() })).toBeNull();
    expect(await getFakeCheckoutData({ themeId, couponId: expired._id.toString() })).toBeNull();
  });
});

describe("simulateFakePayment", () => {
  it("creates the order through processPaymentEvent with provider fake, fake_ord_<checkoutId>, amounts from the coupon quote and userId = the given user; calling it twice leaves 1 order", async () => {
    const theme = await createPublishedTheme();
    const coupon = await createCoupon({ percentOff: 20 });
    const user = await createUser();
    const input = {
      userId: user._id.toString(),
      checkoutId: "fake_chk_abc",
      themeId: theme._id.toString(),
      couponId: coupon._id.toString(),
    };

    await simulateFakePayment(input);
    await simulateFakePayment(input);

    const orders = await OrderModel.find().lean();
    expect(orders).toHaveLength(1);
    expect(orders[0]?.provider).toEqual({
      name: "fake",
      orderId: "fake_ord_fake_chk_abc",
      checkoutId: "fake_chk_abc",
      customerId: null,
    });
    expect([
      orders[0]?.subtotalAmount,
      orders[0]?.discountAmount,
      orders[0]?.taxAmount,
      orders[0]?.totalAmount,
    ]).toEqual([2900, 580, 0, 2320]);
    expect(orders[0]?.userId.toString()).toBe(user._id.toString());
    expect(orders[0]?.couponCode).toBe(coupon.code);
    expect(orders[0]?.paidAt).toEqual(NOW);
  });

  it("without a coupon the amounts are the theme price", async () => {
    const theme = await createPublishedTheme();
    const user = await createUser();

    await simulateFakePayment({
      userId: user._id.toString(),
      checkoutId: "fake_chk_plain",
      themeId: theme._id.toString(),
      couponId: "",
    });

    expect(await OrderModel.findOne().lean()).toMatchObject({
      subtotalAmount: 2900,
      discountAmount: 0,
      totalAmount: 2900,
      couponId: null,
    });
  });

  it("an unknown theme → NOT_FOUND 'This theme is not available.'; an unknown coupon → INVALID 'The test payment could not be processed.'", async () => {
    const theme = await createPublishedTheme();
    const user = await createUser();
    const base = { userId: user._id.toString(), checkoutId: "fake_chk_bad", themeId: theme._id.toString() };

    await expect(
      simulateFakePayment({ ...base, themeId: new Types.ObjectId().toString(), couponId: "" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "This theme is not available." });
    await expect(simulateFakePayment({ ...base, couponId: new Types.ObjectId().toString() })).rejects.toMatchObject({
      code: "INVALID",
      message: "The test payment could not be processed.",
    });
    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it("a payment that cannot be processed (unknown user) → INVALID 'The test payment could not be processed.'", async () => {
    const theme = await createPublishedTheme();

    await expect(
      simulateFakePayment({
        userId: new Types.ObjectId().toString(),
        checkoutId: "fake_chk_nouser",
        themeId: theme._id.toString(),
        couponId: "",
      }),
    ).rejects.toMatchObject({ code: "INVALID", message: "The test payment could not be processed." });
    expect(await OrderModel.countDocuments()).toBe(0);
  });
});
