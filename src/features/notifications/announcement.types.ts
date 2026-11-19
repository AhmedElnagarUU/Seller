import type { AnnouncementAudience, NotificationJobStatus } from "@/features/notifications/notification.constants";

export type AnnouncementInput = {
  title: string;
  body: string;
  link: string | null;
  audience: AnnouncementAudience;
  themeId: string | null;
  customerEmail: string | null;
  sendEmail: boolean;
};

// One row of /admin/notifications.
export type AnnouncementJobRowDTO = {
  id: string;
  createdAt: Date;
  title: string;
  audienceLabel: string;
  status: NotificationJobStatus;
  notifiedCount: number;
  emailedCount: number;
  error: string | null;
};

export type AnnouncementJobPageDTO = {
  items: AnnouncementJobRowDTO[];
  page: number;
  totalPages: number;
  total: number;
};
