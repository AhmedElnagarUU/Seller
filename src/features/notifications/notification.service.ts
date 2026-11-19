import type { ClientSession } from "mongoose";
import { toObjectId } from "@/shared/db/ids";
import { now } from "@/shared/lib/clock";
import type { NotificationType } from "@/features/notifications/notification.constants";
import * as notificationRepository from "@/features/notifications/notification.repository";

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
};

// Saves one unread notification for a customer. With a session the write is part of that transaction.
export async function createNotification(input: CreateNotificationInput, session?: ClientSession): Promise<void> {
  await notificationRepository.insertNotification(
    {
      userId: toObjectId(input.userId),
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      readAt: null,
      jobId: null,
      createdAt: now(),
    },
    session,
  );
}
