// The 16 actions of docs/03-data-model.md section 15, in the same order.
export const ACTIVITY_ACTIONS = [
  "user_registered",
  "order_paid",
  "order_refunded",
  "wallet_payment_submitted",
  "wallet_payment_approved",
  "wallet_payment_rejected",
  "feedback_sent",
  "theme_published",
  "theme_unpublished",
  "version_released",
  "coupon_created",
  "account_disabled",
  "account_enabled",
  "ownership_granted",
  "ownership_revoked",
  "announcement_sent",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

// "system" = webhooks and cron.
export const ACTIVITY_ACTOR_ROLES = ["customer", "admin", "system"] as const;
export type ActivityActorRole = (typeof ACTIVITY_ACTOR_ROLES)[number];

export const ACTIVITY_TARGET_TYPES = [
  "theme",
  "order",
  "wallet_payment",
  "feedback",
  "coupon",
  "user",
  "notification_job",
] as const;
export type ActivityTargetType = (typeof ACTIVITY_TARGET_TYPES)[number];

export const ACTIVITY_SUMMARY_MIN = 2;
export const ACTIVITY_SUMMARY_MAX = 300;
// 1 year (D-123).
export const ACTIVITY_RETENTION_SECONDS = 31_536_000;
export const ACTIVITIES_PER_PAGE = 20;

export const SYSTEM_ACTOR_LABEL = "System";
export const ADMIN_ACTOR_LABEL = "Admin";
export const UNKNOWN_CUSTOMER_ACTOR_LABEL = "Unknown customer";

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  user_registered: "Customer registered",
  order_paid: "Order paid",
  order_refunded: "Order refunded",
  wallet_payment_submitted: "Wallet payment submitted",
  wallet_payment_approved: "Wallet payment approved",
  wallet_payment_rejected: "Wallet payment rejected",
  feedback_sent: "Feedback sent",
  theme_published: "Theme published",
  theme_unpublished: "Theme unpublished",
  version_released: "Version released",
  coupon_created: "Coupon created",
  account_disabled: "Account disabled",
  account_enabled: "Account enabled",
  ownership_granted: "Theme granted",
  ownership_revoked: "Theme revoked",
  announcement_sent: "Announcement sent",
};

// The admin page of each target type (docs/05-pages.md section 5). null = it has no detail page.
export const ACTIVITY_TARGET_PATHS: Record<ActivityTargetType, string | null> = {
  theme: "/admin/themes",
  order: "/admin/orders",
  wallet_payment: "/admin/wallet-payments",
  feedback: "/admin/feedback",
  coupon: "/admin/coupons",
  user: "/admin/customers",
  notification_job: null,
};
