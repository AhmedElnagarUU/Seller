export const WEBHOOK_EVENT_STATUSES = ["processing", "processed", "ignored", "failed"] as const;
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

export const WEBHOOK_PROVIDERS = ["polar", "fake"] as const;
export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number];

export const WEBHOOK_TYPE_MAX = 100;
export const WEBHOOK_ERROR_MAX = 1000;
// The database removes webhook events after 90 days.
export const WEBHOOK_EVENT_RETENTION_SECONDS = 7_776_000;
