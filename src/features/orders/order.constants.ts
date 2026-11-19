export const ORDER_METHODS = ["card", "wallet"] as const;
export type OrderMethod = (typeof ORDER_METHODS)[number];

export const ORDER_STATUSES = ["paid", "partially_refunded", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_CURRENCIES = ["usd", "egp"] as const;
export type OrderCurrency = (typeof ORDER_CURRENCIES)[number];

export const ORDER_PROVIDER_NAMES = ["polar", "fake", "manual_wallet"] as const;
export type OrderProviderName = (typeof ORDER_PROVIDER_NAMES)[number];

export const ORDERS_PER_PAGE = 20;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  paid: "Paid",
  partially_refunded: "Partly refunded",
  refunded: "Refunded",
};

export const ORDER_STATUS_TONES = {
  paid: "success",
  partially_refunded: "warning",
  refunded: "neutral",
} as const satisfies Record<OrderStatus, "success" | "warning" | "neutral">;

export const ORDER_METHOD_LABELS: Record<OrderMethod, string> = { card: "Card", wallet: "Wallet" };

// Saved in webhookEvents.error when a payment event fails (docs/06-payments.md section 6.3).
export const ORDER_EVENT_MESSAGES = {
  invalidUser: "The payment event has no valid user.",
  invalidTheme: "The payment event has no valid theme.",
  wrongCurrency: "The payment currency is not USD.",
  temporaryFailure: "Temporary error. The event will be retried.",
  refundOrderMissing: "The order for this refund was not found yet. The event will be retried.",
  simulateFailed: "The test payment could not be processed.",
} as const;
