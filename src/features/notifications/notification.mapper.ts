import type { NotificationRecord } from "@/features/notifications/notification.model";
import type { NotificationDTO } from "@/features/notifications/notification.types";

export function toNotificationDTO(record: NotificationRecord): NotificationDTO {
  return {
    id: record._id.toString(),
    type: record.type,
    title: record.title,
    body: record.body,
    link: record.link ?? null,
    isRead: record.readAt !== null && record.readAt !== undefined,
    createdAt: record.createdAt,
  };
}
