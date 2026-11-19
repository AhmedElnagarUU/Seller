import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import { usdCentsToEgpPounds } from "@/shared/lib/money";
import { ensureDiscountId, getCouponSummary, quote } from "@/features/coupons/coupon.service";
import type { CouponQuote } from "@/features/coupons/coupon.types";
import { ORDER_EVENT_MESSAGES } from "@/features/orders/order.constants";
import { hasActiveOwnership } from "@/features/ownerships/ownership.service";
import { CHECKOUT_MESSAGES } from "@/features/payments/checkout.constants";
import type { CheckoutPageData, CheckoutWalletDTO, FakeCheckoutDTO } from "@/features/payments/checkout.types";
import { getPaymentProvider } from "@/features/payments/payment.provider";
import { processPaymentEvent } from "@/features/payments/payment-event.service";
import { getWalletSettings } from "@/features/settings/settings.service";
import { getThemeForPurchase, getThemeForPurchaseById } from "@/features/themes/theme.service";
import type { ThemePurchaseDTO } from "@/features/themes/theme.types";
import { getUserSummary } from "@/features/users/user.service";

const EGYPT_COUNTRY_CODE = "EG";

type StartCardCheckoutInput = {
  userId: string;
  customerEmail: string;
  customerName: string;
  themeSlug: string;
  couponCode: string | null;
};

type SimulateFakePaymentInput = { userId: string; checkoutId: string; themeId: string; couponId: string };

function isPublished(theme: ThemePurchaseDTO | null): theme is ThemePurchaseDTO {
  return theme !== null && theme.status === "published";
}

function toCardUnavailableError(reason: string, themeId: string): AppError {
  console.error(reason, themeId);
  return new AppError("INVALID", CHECKOUT_MESSAGES.cardUnavailable);
}

// The wallet option of the checkout page: only for customers in Egypt, and only while wallet payments are on.
async function findWalletOption(userId: string, finalPriceCents: number): Promise<CheckoutWalletDTO | null> {
  const user = await getUserSummary(userId);
  if (user?.country !== EGYPT_COUNTRY_CODE) return null;
  const settings = await getWalletSettings();
  if (!settings.walletEnabled) return null;
  return {
    amountEgp: usdCentsToEgpPounds(finalPriceCents, settings.usdToEgpRate),
    exchangeRate: settings.usdToEgpRate,
  };
}

// The data of /checkout/[slug]: the theme, the coupon check and the price to pay (docs/06-payments.md section 5.2).
export async function getCheckoutPageData(
  userId: string,
  slug: string,
  couponCode: string | null,
): Promise<CheckoutPageData> {
  const theme = await getThemeForPurchase(slug);
  if (!isPublished(theme)) return { kind: "not_found" };
  if (await hasActiveOwnership(userId, theme.id)) return { kind: "owned" };
  const code = couponCode?.trim() ?? "";
  let couponQuote: CouponQuote | null = null;
  let couponError: string | null = null;
  if (code !== "") {
    try {
      couponQuote = await quote({ themeId: theme.id, priceCents: theme.priceCents, code });
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      couponError = error.message;
    }
  }
  const finalPriceCents = couponQuote?.finalCents ?? theme.priceCents;
  return {
    kind: "ready",
    theme: { id: theme.id, slug: theme.slug, name: theme.name, tagline: theme.tagline, priceCents: theme.priceCents },
    couponCode: code === "" ? null : code,
    quote: couponQuote,
    couponError,
    finalPriceCents,
    wallet: await findWalletOption(userId, finalPriceCents),
  };
}

// The discount id of the coupon at the payment provider. Null when there is no coupon.
async function findDiscountId(couponQuote: CouponQuote | null, themeId: string): Promise<string | null> {
  if (couponQuote === null) return null;
  const discountId = await ensureDiscountId(couponQuote.couponId);
  if (discountId === null) throw toCardUnavailableError("card checkout: coupon has no provider discount", themeId);
  return discountId;
}

// Checks everything on the server and creates the hosted checkout (docs/06-payments.md section 5.3).
export async function startCardCheckout(input: StartCardCheckoutInput): Promise<{ url: string }> {
  const theme = await getThemeForPurchase(input.themeSlug);
  if (!isPublished(theme)) throw new AppError("NOT_FOUND", CHECKOUT_MESSAGES.themeUnavailable);
  if (await hasActiveOwnership(input.userId, theme.id)) throw new AppError("CONFLICT", CHECKOUT_MESSAGES.alreadyOwned);
  const couponQuote = input.couponCode
    ? await quote({ themeId: theme.id, priceCents: theme.priceCents, code: input.couponCode })
    : null;
  if (theme.providerProductId === null) {
    throw toCardUnavailableError("card checkout: theme has no provider product", theme.id);
  }
  const discountId = await findDiscountId(couponQuote, theme.id);
  try {
    const checkout = await getPaymentProvider().createCheckout({
      productId: theme.providerProductId,
      discountId,
      userId: input.userId,
      themeId: theme.id,
      couponId: couponQuote?.couponId ?? null,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      successUrl: env.APP_URL + "/checkout/success?checkout_id={CHECKOUT_ID}",
    });
    return { url: checkout.url };
  } catch (error) {
    console.error("card checkout: createCheckout failed", error);
    throw new AppError("INVALID", CHECKOUT_MESSAGES.cardUnavailable);
  }
}

type FakePrices = { theme: ThemePurchaseDTO; discountCents: number; totalCents: number; couponCode: string | null };

// The price of the fake checkout. The coupon id comes from the link, so the coupon is checked like in a real checkout.
async function findFakePrices(theme: ThemePurchaseDTO, couponId: string): Promise<FakePrices | null> {
  if (couponId === "") return { theme, discountCents: 0, totalCents: theme.priceCents, couponCode: null };
  const coupon = await getCouponSummary(couponId);
  if (!coupon) return null;
  try {
    const couponQuote = await quote({ themeId: theme.id, priceCents: theme.priceCents, code: coupon.code });
    return {
      theme,
      discountCents: couponQuote.discountCents,
      totalCents: couponQuote.finalCents,
      couponCode: coupon.code,
    };
  } catch (error) {
    if (error instanceof AppError) return null;
    throw error;
  }
}

// The data of the fake checkout page, or null when the link is not usable.
export async function getFakeCheckoutData(input: {
  themeId: string;
  couponId: string;
}): Promise<FakeCheckoutDTO | null> {
  const theme = await getThemeForPurchaseById(input.themeId);
  if (!theme) return null;
  const prices = await findFakePrices(theme, input.couponId);
  if (!prices) return null;
  return {
    themeName: prices.theme.name,
    subtotalCents: prices.theme.priceCents,
    discountCents: prices.discountCents,
    totalCents: prices.totalCents,
    couponCode: prices.couponCode,
  };
}

// "Simulate successful payment" of the fake checkout: the same code path as a real webhook (docs/06-payments.md section 8).
export async function simulateFakePayment(input: SimulateFakePaymentInput): Promise<void> {
  const theme = await getThemeForPurchaseById(input.themeId);
  if (!theme) throw new AppError("NOT_FOUND", CHECKOUT_MESSAGES.themeUnavailable);
  const prices = await findFakePrices(theme, input.couponId);
  if (!prices) throw new AppError("INVALID", ORDER_EVENT_MESSAGES.simulateFailed);
  const outcome = await processPaymentEvent(
    {
      kind: "order_paid",
      eventId: "fake_evt_" + input.checkoutId,
      type: "order.paid",
      order: {
        providerOrderId: "fake_ord_" + input.checkoutId,
        checkoutId: input.checkoutId,
        providerCustomerId: null,
        userId: input.userId,
        themeId: input.themeId,
        couponId: input.couponId === "" ? null : input.couponId,
        currency: "usd",
        subtotalAmount: prices.theme.priceCents,
        discountAmount: prices.discountCents,
        taxAmount: 0,
        totalAmount: prices.totalCents,
        paidAt: now(),
      },
    },
    "fake",
  );
  if (outcome !== "processed" && outcome !== "duplicate") {
    throw new AppError("INVALID", ORDER_EVENT_MESSAGES.simulateFailed);
  }
}
