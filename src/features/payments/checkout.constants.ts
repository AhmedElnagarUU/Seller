// Texts of docs/06-payments.md section 5.3.
export const CHECKOUT_MESSAGES = {
  themeUnavailable: "This theme is not available.",
  alreadyOwned: "You already own this theme.",
  cardUnavailable: "Card payment is not available for this theme right now. Please try again later.",
} as const;

// The longest coupon code that is read from a form or a link.
export const CHECKOUT_COUPON_MAX = 64;
// The longest checkout id that is read from a form or a link.
export const CHECKOUT_ID_MAX = 100;
