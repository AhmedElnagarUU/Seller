import type { AnnouncementAudience } from "@/features/notifications/notification.constants";

// The title, message and link limits are the NOTIFICATION_* limits of notification.constants.ts (03 §13).
export const ANNOUNCEMENT_JOBS_PER_PAGE = 20;

export const ANNOUNCEMENT_AUDIENCE_OPTIONS: readonly { value: AnnouncementAudience; label: string }[] = [
  { value: "all_customers", label: "All customers" }, // 05 §5
  { value: "theme_owners", label: "Owners of a theme" },
  { value: "one_customer", label: "One customer" },
];

export const NO_CUSTOMER_MESSAGE = "No customer with this email."; // 05 §5, word for word
export const ANNOUNCEMENT_QUEUED_MESSAGE = "Announcement queued."; // 05 §5, word for word

// Texts decided by the owner (T-017, notes 17-A, 17-B and 17-G).
export const ANNOUNCEMENT_MESSAGES = {
  titleLength: "Use 2 to 120 characters.",
  bodyLength: "Use 2 to 1 000 characters.",
  link: "Enter a path that starts with / (for example /themes).",
  audience: "Choose who gets this announcement.",
  theme: "Choose a theme.",
  linkHint: "Optional. A page of this store, for example /themes.",
  sendEmailHint: "Only customers who have announcement emails turned on get the email.",
  empty: "No announcements yet.",
  allCustomersLabel: "All customers",
  jobNotFound: "Notification job not found.",
  onlyFailedCanRetry: "Only failed jobs can be retried.",
} as const;
