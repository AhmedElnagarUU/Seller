import type { ClientSession, Types } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId } from "@/shared/db/ids";
import type { NotificationType } from "@/features/notifications/notification.constants";
import { NotificationModel, type NotificationRecord } from "@/features/notifications/notification.model";

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

// Inserts many notifications. `ordered: false`: a row refused by the unique { jobId, userId } index does not stop
// the others (the error is thrown at the end).
export async function insertManyNotifications(rows: NewNotificationFields[]): Promise<void> {
  await connectDB();
  await NotificationModel.insertMany(rows, { ordered: false });
}

// The ids of the users, among `userIds`, that already have a notification of this job.
export async function findNotifiedUserIdsOfJob(
  jobId: Types.ObjectId,
  userIds: Types.ObjectId[],
): Promise<Types.ObjectId[]> {
  if (userIds.length === 0) return [];
  await connectDB();
  const rows = await NotificationModel.find({ jobId, userId: { $in: userIds } })
    .select({ userId: 1 })
    .lean<{ userId: Types.ObjectId }[]>();
  return rows.map((row) => row.userId);
}

// How many notifications of this job exist for these users.
export async function countNotificationsOfJob(jobId: Types.ObjectId, userIds: Types.ObjectId[]): Promise<number> {
  await connectDB();
  return NotificationModel.countDocuments({ jobId, userId: { $in: userIds } });
}

// One page of a user's notifications, newest first. Pages are numbered from 1.
export async function findNotificationsByUser(
  userId: Types.ObjectId,
  page: number,
  pageSize: number,
): Promise<NotificationRecord[]> {
  await connectDB();
  return NotificationModel.find({ userId })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean<NotificationRecord[]>();
}

export async function countNotificationsByUser(userId: Types.ObjectId): Promise<number> {
  await connectDB();
  return NotificationModel.countDocuments({ userId });
}

export async function countUnreadNotificationsByUser(userId: Types.ObjectId): Promise<number> {
  await connectDB();
  return NotificationModel.countDocuments({ userId, readAt: null });
}

// Sets `readAt` on this user's notification when it is unread, then returns the notification (its link).
// null for an invalid id, an unknown id or another user's notification.
export async function markNotificationReadForUser(
  userId: Types.ObjectId,
  notificationId: string,
  readAt: Date,
): Promise<{ link: string | null } | null> {
  const objectId = parseObjectId(notificationId);
  if (!objectId) return null;
  await connectDB();
  await NotificationModel.updateOne({ _id: objectId, userId, readAt: null }, { $set: { readAt } });
  const found = await NotificationModel.findOne({ _id: objectId, userId })
    .select({ link: 1 })
    .lean<{ link: string | null }>();
  return found ? { link: found.link ?? null } : null;
}

// Sets `readAt` on all unread notifications of the user. Returns how many changed.
export async function markAllNotificationsReadForUser(userId: Types.ObjectId, readAt: Date): Promise<number> {
  await connectDB();
  const result = await NotificationModel.updateMany({ userId, readAt: null }, { $set: { readAt } });
  return result.modifiedCount;
}
