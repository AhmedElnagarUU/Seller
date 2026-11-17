"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readCheckbox, readText } from "@/shared/lib/form-data";
import { requireAdmin } from "@/features/auth/session";
import { COUPON_MESSAGES } from "@/features/coupons/coupon.constants";
import { couponInputSchema, couponUpdateSchema } from "@/features/coupons/coupon.schemas";
import { createCoupon, deleteCoupon, updateCoupon } from "@/features/coupons/coupon.service";

// The text of every field as typed. It is sent back to the form after an error. The ticked themes are not sent back.
function readCouponValues(formData: FormData): Record<string, string> {
  return {
    code: readText(formData, "code"),
    type: readText(formData, "type"),
    value: readText(formData, "value"),
    appliesTo: readText(formData, "appliesTo"),
    expiresAt: readText(formData, "expiresAt"),
    maxRedemptions: readText(formData, "maxRedemptions"),
    active: readCheckbox(formData, "active") ? "on" : "",
  };
}

function readThemeIds(formData: FormData): string[] {
  return formData.getAll("themeIds").filter((value) => typeof value === "string");
}

function readCouponForm(formData: FormData) {
  return { ...readCouponValues(formData), themeIds: readThemeIds(formData), active: readCheckbox(formData, "active") };
}

function revalidateCouponPages(): void {
  revalidatePath("/admin/coupons");
  revalidatePath("/admin/coupons/[id]", "page");
}

export async function createCouponAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = couponInputSchema.safeParse(readCouponForm(formData));
  if (!parsed.success) return validationFailure(parsed.error, readCouponValues(formData));
  try {
    await createCoupon(parsed.data, user.id);
  } catch (error) {
    return failureFrom(error, "createCouponAction", readCouponValues(formData));
  }
  revalidateCouponPages();
  redirect("/admin/coupons");
}

export async function updateCouponAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = couponUpdateSchema.safeParse(readCouponForm(formData));
  if (!parsed.success) return validationFailure(parsed.error, readCouponValues(formData));
  try {
    await updateCoupon(readText(formData, "id"), parsed.data);
  } catch (error) {
    return failureFrom(error, "updateCouponAction", readCouponValues(formData));
  }
  revalidateCouponPages();
  return { ok: true, data: undefined, message: COUPON_MESSAGES.saved };
}

export async function deleteCouponAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    await deleteCoupon(readText(formData, "id"));
  } catch (error) {
    return failureFrom(error, "deleteCouponAction", {});
  }
  revalidateCouponPages();
  redirect("/admin/coupons");
}
