"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom } from "@/shared/lib/action-result";
import { readText } from "@/shared/lib/form-data";
import { requireAdmin, requireUser } from "@/features/auth/session";
import { retryNotificationJob } from "@/features/notifications/notification-job.service";
import { markAllNotificationsRead, openNotification } from "@/features/notifications/notification.service";

const NOTIFICATIONS_PATH = "/account/notifications";

// Marks one notification as read and goes to its link (when it has one).
export async function openNotificationAction(formData: FormData): Promise<void> {
  const user = await requireUser(NOTIFICATIONS_PATH);
  const opened = await openNotification(user.id, readText(formData, "id"));
  revalidatePath(NOTIFICATIONS_PATH);
  if (opened?.link) redirect(opened.link);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser(NOTIFICATIONS_PATH);
  await markAllNotificationsRead(user.id);
  revalidatePath(NOTIFICATIONS_PATH);
}

// The admin puts a failed job back in the queue.
export async function retryNotificationJobAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  try {
    await retryNotificationJob(readText(formData, "jobId"));
  } catch (error) {
    return failureFrom(error, "retryNotificationJobAction", {});
  }
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/themes/[id]/versions", "page");
  return { ok: true, data: undefined };
}
