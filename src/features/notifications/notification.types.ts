import type { AnnouncementAudience } from "@/features/notifications/notification.constants";

// The text of one in-app notification.
export type NotificationText = { title: string; body: string; link: string | null };

export type VersionReleasedJobInput = {
  themeId: string;
  versionId: string;
  createdByUserId: string;
};

export type ThemePublishedJobInput = {
  themeId: string;
  categoryId: string;
  createdByUserId: string;
};

export type AnnouncementJobInput = {
  title: string;
  body: string;
  link: string | null;
  sendEmail: boolean;
  audience: AnnouncementAudience;
  audienceThemeId: string | null;
  audienceUserId: string | null;
  createdByUserId: string;
};
