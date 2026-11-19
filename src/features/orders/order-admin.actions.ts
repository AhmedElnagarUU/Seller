"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readText } from "@/shared/lib/form-data";
import { requireAdmin } from "@/features/auth/session";
import { markRefundedSchema } from "@/features/orders/order-admin.schemas";
import { markWalletOrderRefunded } from "@/features/orders/order-admin.service";

export async function markWalletOrderRefundedAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = markRefundedSchema.safeParse({ orderId: readText(formData, "orderId") });
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await markWalletOrderRefunded(parsed.data.orderId, admin.id);
  } catch (error) {
    return failureFrom(error, "markWalletOrderRefundedAction", {});
  }
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/[id]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
  revalidatePath("/admin/customers/[id]", "page");
  revalidatePath("/account/orders");
  revalidatePath("/account/themes");
  return { ok: true, data: undefined };
}
