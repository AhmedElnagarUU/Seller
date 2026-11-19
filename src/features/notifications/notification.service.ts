import type { ClientSession } from "mongoose";
import { isDuplicateKeyError } from "@/shared/db/duplicate-key";
import { parseObjectId, toObjectId } from "@/shared/db/ids";
import { now } from "@/shared/lib/clock";
import { NOTIFICATIONS_PER_PAGE, type NotificationType } from "@/features/notifications/notification.constants";
import { toNotificationDTO } from "@/features/notifications/notification.mapper";
import * as notificationRepository from "@/features/notifications/notification.repository";
import type { NewNotification } from "@/features/notifications/notification-message.service";
import type { NotificationPageDTO } from "@/features/notifications/notification.types";

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

// The users, among `userIds`, that already have a notification of this job. Invalid ids are ignored.
export async function findNotifiedUserIds(jobId: string, userIds: string[]): Promise<Set<string>> {
  const objectIds = userIds.flatMap((userId) => parseObjectId(userId) ?? []);
  const notified = await notificationRepository.findNotifiedUserIdsOfJob(toObjectId(jobId), objectIds);
  return new Set(notified.map((userId) => userId.toString()));
}

// Saves the notifications of one batch. A notification that the unique { jobId, userId } index refuses is skipped.
// Returns how many of these notifications exist now. The processor removed everyone who already had one,
// so this is the number inserted.
export async function insertNotificationsForJob(notifications: NewNotification[]): Promise<number> {
  const [first] = notifications;
  if (!first) return 0;
  const createdAt = now();
  const rows = notifications.map((notification) => ({
    userId: toObjectId(notification.userId),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    readAt: null,
    jobId: toObjectId(notification.jobId),
    createdAt,
  }));
  try {
    await notificationRepository.insertManyNotifications(rows);
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
  return notificationRepository.countNotificationsOfJob(
    toObjectId(first.jobId),
    rows.map((row) => row.userId),
  );
}

// One page of the customer's notifications, newest first, with the unread count.
export async function listNotifications(userId: string, page: number): Promise<NotificationPageDTO> {
  const userObjectId = toObjectId(userId);
  const currentPage = Math.max(1, page);
  const [records, total, unreadCount] = await Promise.all([
    notificationRepository.findNotificationsByUser(userObjectId, currentPage, NOTIFICATIONS_PER_PAGE),
    notificationRepository.countNotificationsByUser(userObjectId),
    notificationRepository.countUnreadNotificationsByUser(userObjectId),
  ]);
  return {
    items: records.map(toNotificationDTO),
    page: currentPage,
    totalPages: Math.ceil(total / NOTIFICATIONS_PER_PAGE),
    total,
    unreadCount,
  };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return notificationRepository.countUnreadNotificationsByUser(toObjectId(userId));
}

// Marks one of the customer's notifications as read and returns its link.
// null for an invalid id, an unknown id or another customer's notification (nothing changes).
export async function openNotification(
  userId: string,
  notificationId: string,
): Promise<{ link: string | null } | null> {
  return notificationRepository.markNotificationReadForUser(toObjectId(userId), notificationId, now());
}

// Marks all unread notifications of the customer as read. Returns how many changed.
export async function markAllNotificationsRead(userId: string): Promise<number> {
  return notificationRepository.markAllNotificationsReadForUser(toObjectId(userId), now());
}
