"use server";

import { notFound, redirect } from "next/navigation";
import type { ActionResult } from "@/shared/types/action";
import { env } from "@/shared/config/env";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readText } from "@/shared/lib/form-data";
import { requireVerifiedUser } from "@/features/auth/session";
import {
  applyCouponSchema,
  setCountrySchema,
  simulateFakePaymentSchema,
  startCardCheckoutSchema,
} from "@/features/payments/checkout.schemas";
import { simulateFakePayment, startCardCheckout } from "@/features/payments/checkout.service";
import { setUserCountry } from "@/features/users/user.service";

function checkoutPath(slug: string, couponCode: string | null): string {
  return "/checkout/" + slug + (couponCode ? "?coupon=" + encodeURIComponent(couponCode) : "");
}

// Puts the coupon in the address. It does not check the coupon: the page does.
export async function applyCouponAction(formData: FormData): Promise<void> {
  await requireVerifiedUser("/checkout/" + readText(formData, "slug"));
  const parsed = applyCouponSchema.safeParse({ slug: readText(formData, "slug"), code: readText(formData, "code") });
  if (!parsed.success) redirect("/themes");
  redirect(checkoutPath(parsed.data.slug, parsed.data.code));
}

export async function startCardCheckoutAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireVerifiedUser("/checkout/" + readText(formData, "slug"));
  const values = { slug: readText(formData, "slug"), coupon: readText(formData, "coupon") };
  const parsed = startCardCheckoutSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  let url: string;
  try {
    const checkout = await startCardCheckout({
      userId: user.id,
      customerEmail: user.email,
      customerName: user.name,
      themeSlug: parsed.data.slug,
      couponCode: parsed.data.coupon,
    });
    url = checkout.url;
  } catch (error) {
    return failureFrom(error, "startCardCheckoutAction", values);
  }
  redirect(url);
}

export async function setCountryAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireVerifiedUser("/checkout/" + readText(formData, "slug"));
  const values = {
    slug: readText(formData, "slug"),
    country: readText(formData, "country"),
    coupon: readText(formData, "coupon"),
  };
  const parsed = setCountrySchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await setUserCountry(user.id, parsed.data.country);
  } catch (error) {
    return failureFrom(error, "setCountryAction", values);
  }
  redirect(checkoutPath(parsed.data.slug, parsed.data.coupon === "" ? null : parsed.data.coupon));
}

export async function simulateFakePaymentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (env.PAYMENT_PROVIDER !== "fake") notFound();
  const user = await requireVerifiedUser("/checkout/fake/" + readText(formData, "checkoutId"));
  const values = {
    checkoutId: readText(formData, "checkoutId"),
    themeId: readText(formData, "themeId"),
    couponId: readText(formData, "couponId"),
  };
  const parsed = simulateFakePaymentSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await simulateFakePayment({ userId: user.id, ...parsed.data });
  } catch (error) {
    return failureFrom(error, "simulateFakePaymentAction", values);
  }
  redirect("/checkout/success?checkout_id=" + parsed.data.checkoutId);
}
