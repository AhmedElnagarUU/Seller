export const WALLET_PAYMENT_STATUSES = ["awaiting_payment", "submitted", "approved", "rejected", "cancelled"] as const;
export type WalletPaymentStatus = (typeof WALLET_PAYMENT_STATUSES)[number];

export const WALLET_REFERENCE_PATTERN = /^TS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;
export const REFERENCE_PREFIX = "TS-";
export const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const REFERENCE_LENGTH = 6;
export const MAX_REFERENCE_TRIES = 5;
export const EGYPT_MOBILE_PATTERN = /^01[0125]\d{8}$/;
export const MAX_PROOF_BYTES = 5_242_880;
export const PROOF_UPLOAD_SECONDS = 600;
export const PROOF_VIEW_SECONDS = 300;
export const TRANSACTION_ID_MAX = 100;
export const REJECTION_REASON_MIN = 5;
export const REJECTION_REASON_MAX = 500;
export const WALLET_PAYMENTS_PER_PAGE = 20;

export const WALLET_STATUS_LABELS: Record<WalletPaymentStatus, string> = {
  awaiting_payment: "Waiting for payment",
  submitted: "Waiting for review",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const WALLET_STATUS_TONES = {
  awaiting_payment: "neutral",
  submitted: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
} as const satisfies Record<WalletPaymentStatus, "neutral" | "warning" | "success" | "danger">;

// Tabs of /admin/wallet-payments (docs/05-pages.md section 5): key → status. "review" is the default.
export const WALLET_TABS = {
  review: "submitted",
  approved: "approved",
  rejected: "rejected",
  awaiting: "awaiting_payment",
  cancelled: "cancelled",
} as const;
export type WalletTab = keyof typeof WALLET_TABS;

export const WALLET_TAB_LABELS: Record<WalletTab, string> = {
  review: "Waiting for review",
  approved: "Approved",
  rejected: "Rejected",
  awaiting: "Waiting for payment",
  cancelled: "Cancelled",
};

export const WALLET_MESSAGES = {
  notEgypt: "Wallet payment is only available for customers in Egypt.",
  disabled: "Wallet payment is not available right now.",
  themeUnavailable: "This theme is not available.",
  alreadyOwned: "You already own this theme.",
  proofType: "Please upload a JPG, PNG or WebP image up to 5 MB.",
  phone: "Please enter the Egyptian mobile number you paid from (11 digits, starts with 01).",
  proofMissing: "We could not find your screenshot. Please upload it again.",
  alreadyReviewed: "This payment was already reviewed.",
  notFound: "Payment request not found.",
  notChangeable: "This payment can no longer be changed.",
  transactionIdLength: "Use up to 100 characters.",
  reasonLength: "Write between 5 and 500 characters.",
  approved: "Payment approved.",
  rejected: "Payment rejected.",
  detailsSent: "Payment details sent.",
  referenceFailed: "Could not generate a unique reference code.",
} as const;
