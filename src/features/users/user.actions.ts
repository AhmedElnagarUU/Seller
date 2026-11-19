"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readText } from "@/shared/lib/form-data";
import { requireAdmin } from "@/features/auth/session";
import { customerIdSchema, disableCustomerSchema } from "@/features/users/user.schemas";
import { disableUser, enableUser } from "@/features/users/user.service";

function revalidateCustomerPages(): void {
  revalidatePath("/admin/customers");
  revalidatePath("/admin/customers/[id]", "page");
  revalidatePath("/admin/activity");
}

export async function disableCustomerAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const values = { reason: readText(formData, "reason") };
  const parsed = disableCustomerSchema.safeParse({ id: readText(formData, "id"), reason: values.reason });
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await disableUser(parsed.data.id, parsed.data.reason, admin.id);
  } catch (error) {
    return failureFrom(error, "disableCustomerAction", values);
  }
  revalidateCustomerPages();
  return { ok: true, data: undefined };
}

export async function enableCustomerAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = customerIdSchema.safeParse({ id: readText(formData, "id") });
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await enableUser(parsed.data.id, admin.id);
  } catch (error) {
    return failureFrom(error, "enableCustomerAction", {});
  }
  revalidateCustomerPages();
  return { ok: true, data: undefined };
}
