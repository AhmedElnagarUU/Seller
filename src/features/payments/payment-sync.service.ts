import { getPaymentProvider } from "@/features/payments/payment.provider";

export type ThemeSyncInput = {
  themeId: string;
  name: string;
  tagline: string;
  priceCents: number;
  existingProductId: string | null;
};

export type ThemeSyncResult = { ok: true; productId: string } | { ok: false };

// Sends the theme to the payment provider. A failure is logged and returned, never thrown.
export async function syncThemeProduct(input: ThemeSyncInput): Promise<ThemeSyncResult> {
  try {
    const { productId } = await getPaymentProvider().upsertProduct(input);
    return { ok: true, productId };
  } catch (error) {
    console.error("syncThemeProduct failed", error);
    return { ok: false };
  }
}

export type CouponSyncInput = {
  couponId: string;
  code: string;
  type: "percent" | "fixed";
  percentOff: number | null;
  amountOffCents: number | null;
  productIds: string[] | null;
  existingDiscountId: string | null;
};

export type CouponSyncResult = { ok: true; discountId: string } | { ok: false };

// Sends the coupon to the payment provider as a discount. A failure is logged and returned, never thrown.
export async function syncCouponDiscount(input: CouponSyncInput): Promise<CouponSyncResult> {
  try {
    const { discountId } = await getPaymentProvider().upsertDiscount(input);
    return { ok: true, discountId };
  } catch (error) {
    console.error("syncCouponDiscount failed", error);
    return { ok: false };
  }
}

// Deletes a discount at the payment provider. A failure is logged and never thrown (an unused discount does no harm, docs/06-payments.md 3.2).
export async function deleteCouponDiscount(discountId: string): Promise<void> {
  try {
    await getPaymentProvider().deleteDiscount(discountId);
  } catch (error) {
    console.error("deleteCouponDiscount failed", error);
  }
}
