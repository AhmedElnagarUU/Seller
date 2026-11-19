import { z } from "zod";
import { OBJECT_ID_PATTERN, THEME_SLUG_PATTERN } from "@/features/themes/theme.constants";
import { CHECKOUT_COUPON_MAX, CHECKOUT_ID_MAX } from "@/features/payments/checkout.constants";

const slugField = z.string().regex(THEME_SLUG_PATTERN);
// A coupon code from a form: trimmed and cut to the maximum length.
const couponTextField = z
  .string()
  .trim()
  .transform((value) => value.slice(0, CHECKOUT_COUPON_MAX));
const checkoutIdField = z.string().regex(new RegExp(`^[A-Za-z0-9_-]{1,${CHECKOUT_ID_MAX}}$`));

export const applyCouponSchema = z.object({ slug: slugField, code: couponTextField });

// The hidden coupon field is "" when no coupon is used.
export const startCardCheckoutSchema = z.object({
  slug: slugField,
  coupon: couponTextField.transform((value) => (value === "" ? null : value)),
});

// The service checks the country code and gives the message.
export const setCountrySchema = z.object({ slug: slugField, country: z.string(), coupon: couponTextField });

export const simulateFakePaymentSchema = z.object({
  checkoutId: checkoutIdField,
  themeId: z.string().regex(OBJECT_ID_PATTERN),
  couponId: z.union([z.string().regex(OBJECT_ID_PATTERN), z.literal("")]),
});

// The query of /checkout/[slug]. A bad value falls back to "" (docs/05-pages.md 1.4).
export const checkoutSearchParamsSchema = z.object({
  coupon: z.string().trim().max(CHECKOUT_COUPON_MAX).catch(""),
});

// The query of /checkout/success.
export const checkoutSuccessSearchParamsSchema = z.object({
  checkout_id: checkoutIdField.optional().catch(undefined),
});

// The query of /checkout/fake/[checkoutId]: the ids that the fake provider put in the link.
export const fakeCheckoutSearchParamsSchema = z.object({
  theme: z.string().trim().catch(""),
  coupon: z.string().trim().catch(""),
});
