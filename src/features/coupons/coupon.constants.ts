export const COUPON_TYPES = ["percent", "fixed"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const COUPON_APPLIES_TO = ["all", "selected"] as const;
export type CouponAppliesTo = (typeof COUPON_APPLIES_TO)[number];

export const COUPON_CODE_PATTERN = /^[A-Z0-9-]{3,32}$/;
export const PERCENT_OFF_MIN = 1;
export const PERCENT_OFF_MAX = 100;
export const AMOUNT_OFF_MIN_CENTS = 100;
export const AMOUNT_OFF_MAX_CENTS = 100_000;
export const MAX_COUPON_THEMES = 100;
// The price after the discount must be at least this much (docs/06-payments.md section 4, check 6).
export const MIN_FINAL_PRICE_CENTS = 100;

export const COUPON_MESSAGES = {
  notValid: "This coupon code is not valid.",
  expired: "This coupon has expired.",
  limitReached: "This coupon has reached its usage limit.",
  wrongTheme: "This coupon cannot be used for this theme.",
  codeFormat: "Use 3 to 32 letters, numbers and dashes.",
  typeChoice: "Choose a discount type.",
  percentRange: "Enter a whole number from 1 to 100.",
  amountRange: "Enter an amount between $1.00 and $1,000.00.",
  appliesToChoice: "Choose which themes the coupon works for.",
  themesRequired: "Choose at least one theme.",
  themesTooMany: "Choose up to 100 themes.",
  dateInvalid: "Enter a valid date.",
  limitInvalid: "Enter a whole number of 1 or more.",
  codeUsed: "This coupon code is already used.",
  themesNotSynced: "Choose themes that are synced with the payment provider.",
  notFound: "Coupon not found.",
  saved: "Saved.",
} as const;
