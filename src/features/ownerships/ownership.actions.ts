"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readText } from "@/shared/lib/form-data";
import { requireAdmin } from "@/features/auth/session";
import { grantByAdmin, revokeByAdmin } from "@/features/ownerships/ownership.service";
import { grantThemeSchema, revokeOwnershipSchema } from "@/features/ownerships/ownership.schemas";
import { CUSTOMER_MESSAGES } from "@/features/users/user.constants";

function revalidateOwnershipPages(): void {
  revalidatePath("/admin/customers/[id]", "page");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/activity");
  revalidatePath("/account/themes");
}

export async function grantThemeAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const values = { themeId: readText(formData, "themeId"), note: readText(formData, "note") };
  const parsed = grantThemeSchema.safeParse({ userId: readText(formData, "userId"), ...values });
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    const note = parsed.data.note === "" ? null : parsed.data.note;
    await grantByAdmin({ userId: parsed.data.userId, themeId: parsed.data.themeId, note }, admin.id);
  } catch (error) {
    return failureFrom(error, "grantThemeAction", values);
  }
  revalidateOwnershipPages();
  return { ok: true, data: undefined, message: CUSTOMER_MESSAGES.themeGiven };
}

export async function revokeOwnershipAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const values = { note: readText(formData, "note") };
  const parsed = revokeOwnershipSchema.safeParse({
    userId: readText(formData, "userId"),
    themeId: readText(formData, "themeId"),
    note: values.note,
  });
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await revokeByAdmin(parsed.data, admin.id);
  } catch (error) {
    return failureFrom(error, "revokeOwnershipAction", values);
  }
  revalidateOwnershipPages();
  return { ok: true, data: undefined };
}
