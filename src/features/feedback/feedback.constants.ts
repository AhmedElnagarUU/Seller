export const FEEDBACK_STATUSES = ["new", "read", "resolved"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_SUBJECT_MIN = 3; // 03 §14
export const FEEDBACK_SUBJECT_MAX = 120;
export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 5000;
export const FEEDBACK_REPLY_MIN = 2;
export const FEEDBACK_REPLY_MAX = 5000;
export const FEEDBACK_LIMIT_PER_DAY = 5; // 03 §14: at most 5 messages per 24 hours
export const FEEDBACK_LIMIT_WINDOW_HOURS = 24;
export const FEEDBACK_PER_PAGE = 20; // 02 §7
export const FEEDBACK_CUSTOMER_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "Sent",
  read: "Read",
  resolved: "Resolved",
}; // 05 §4
export const FEEDBACK_ADMIN_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  read: "Read",
  resolved: "Resolved",
}; // 05 §5 tabs
export const FEEDBACK_RATE_LIMIT_MESSAGE = "You have sent a lot of feedback today. Please try again tomorrow."; // 03 §14, word for word
export const FEEDBACK_SENT_MESSAGE = "Thank you! We read every message."; // 05 §4, word for word

// Texts decided by the owner (T-016, notes 16-A, 16-B and 16-C).
export const FEEDBACK_MESSAGES = {
  subjectLength: "Use 3 to 120 characters.",
  messageLength: "Use 10 to 5 000 characters.",
  replyLength: "Use 2 to 5 000 characters.",
  replySent: "Reply sent.",
  adminEmpty: "No feedback here yet.",
  customerEmpty: "You have not sent any feedback yet.",
  notFound: "Feedback not found.",
  alreadyReplied: "This feedback already has a reply.",
} as const;
