import type { ClientSession, Types } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import type { NotificationType } from "@/features/notifications/notification.constants";
import { NotificationModel } from "@/features/notifications/notification.model";

// The fields of a new notification.
export type NewNotificationFields = {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: Date | null;
  jobId: Types.ObjectId | null;
  createdAt: Date;
};

// Inserts one notification. With a session the write is part of that transaction.
export async function insertNotification(fields: NewNotificationFields, session?: ClientSession): Promise<void> {
  await connectDB();
  await NotificationModel.create([fields], { session });
}
