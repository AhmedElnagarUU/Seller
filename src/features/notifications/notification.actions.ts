"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readText } from "@/shared/lib/form-data";
import { requireUser } from "@/features/auth/session";
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
