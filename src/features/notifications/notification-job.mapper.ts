import type { NotificationJobRecord } from "@/features/notifications/notification-job.model";
import type { NotificationJobSummaryDTO } from "@/features/notifications/notification.types";

export function toNotificationJobSummaryDTO(record: NotificationJobRecord): NotificationJobSummaryDTO {
  return {
    id: record._id.toString(),
    status: record.status,
    notifiedCount: record.notifiedCount,
    emailedCount: record.emailedCount,
    error: record.error ?? null,
  };
}
