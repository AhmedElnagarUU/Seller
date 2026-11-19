"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readCheckbox, readText } from "@/shared/lib/form-data";
import { requireAdmin } from "@/features/auth/session";
import { announcementInputSchema } from "@/features/notifications/announcement.schemas";
import { sendAnnouncement } from "@/features/notifications/announcement.service";

export async function sendAnnouncementAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const values = {
    title: readText(formData, "title"),
    body: readText(formData, "body"),
    link: readText(formData, "link"),
    audience: readText(formData, "audience"),
    themeId: readText(formData, "themeId"),
    customerEmail: readText(formData, "customerEmail"),
  };
  const parsed = announcementInputSchema.safeParse({ ...values, sendEmail: readCheckbox(formData, "sendEmail") });
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await sendAnnouncement(parsed.data, admin.id);
  } catch (error) {
    return failureFrom(error, "sendAnnouncementAction", values);
  }
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/activity");
  redirect("/admin/notifications?queued=1");
}
