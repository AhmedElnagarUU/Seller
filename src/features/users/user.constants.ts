export const CUSTOMERS_PER_PAGE = 20; // 02 §7
export const DISABLE_REASON_MIN = 1; // 05 §5: reason 1–300 chars
export const DISABLE_REASON_MAX = 300; // 03 §3 disabledReason
export const REVOKE_NOTE_MIN = 1; // 05 §5: required note 1–300 chars
export const REVOKE_NOTE_MAX = 300; // 03 §8 revokeNote
export const GRANT_NOTE_MAX = 300; // 03 §8 grantNote
export const CUSTOMER_STATUS_FILTERS = ["active", "disabled"] as const;
export type CustomerStatusFilter = (typeof CUSTOMER_STATUS_FILTERS)[number];
export const CUSTOMER_SEARCH_MAX = 80;

// Texts decided by the owner (T-017, notes 17-A and 17-B).
export const CUSTOMER_MESSAGES = {
  notFound: "Customer not found.",
  ownAccount: "You cannot disable your own account.",
  alreadyDisabled: "This account is already disabled.",
  notDisabled: "This account is not disabled.",
  reasonLength: "Write a reason (1 to 300 characters).",
  revokeNoteLength: "Write a note (1 to 300 characters).",
  grantNoteLength: "Use up to 300 characters.",
  themeGiven: "Theme given.",
  empty: "No customers found.",
  noThemes: "This customer owns no themes.",
  noOrders: "No orders yet.",
  noWalletPayments: "No wallet payments yet.",
  noFeedback: "No feedback yet.",
  noActivity: "No activity yet.",
} as const;
