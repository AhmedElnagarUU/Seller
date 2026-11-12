// The 7 types of docs/03-data-model.md section 12, in the same order.
export const NOTIFICATION_TYPES = [
  "owned_theme_updated",
  "favorite_theme_updated",
  "category_new_theme",
  "announcement",
  "wallet_payment_approved",
  "wallet_payment_rejected",
  "feedback_reply",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_JOB_KINDS = ["version_released", "theme_published", "announcement"] as const;
export type NotificationJobKind = (typeof NOTIFICATION_JOB_KINDS)[number];

export const NOTIFICATION_JOB_STATUSES = ["pending", "running", "done", "failed"] as const;
export type NotificationJobStatus = (typeof NOTIFICATION_JOB_STATUSES)[number];

// Which group of customers a job is working on.
export const NOTIFICATION_JOB_STAGES = [
  "theme_owners",
  "theme_favoriters",
  "category_followers",
  "all_customers",
  "one_customer",
] as const;
export type NotificationJobStage = (typeof NOTIFICATION_JOB_STAGES)[number];

export const ANNOUNCEMENT_AUDIENCES = ["all_customers", "theme_owners", "one_customer"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

// Used for the announcement title as well.
export const NOTIFICATION_TITLE_MIN = 2;
export const NOTIFICATION_TITLE_MAX = 120;
// Used for the announcement body as well.
export const NOTIFICATION_BODY_MIN = 2;
export const NOTIFICATION_BODY_MAX = 1000;
export const NOTIFICATION_LINK_MAX = 300;
// "internalPath" format of docs/03-data-model.md section 1: starts with "/", not "//".
export const INTERNAL_PATH_PATTERN = /^\/(?!\/)/;
// 1 year.
export const NOTIFICATION_RETENTION_SECONDS = 31_536_000;
export const JOB_ERROR_MAX = 500;
