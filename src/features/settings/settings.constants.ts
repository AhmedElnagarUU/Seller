// The one settings document (docs/03-data-model.md section 18).
export const SETTINGS_ID = "global";
export const DEFAULT_USD_TO_EGP_RATE = 50;
export const EGP_RATE_MIN = 1;
export const EGP_RATE_MAX = 1000;
export const MAX_WALLET_ACCOUNTS = 5;
export const WALLET_LABEL_MIN = 2;
export const WALLET_LABEL_MAX = 40;
export const WALLET_ACCOUNT_MIN = 2;
export const WALLET_ACCOUNT_MAX = 100;
export const WALLET_INSTRUCTIONS_MAX = 500;

export const SETTINGS_MESSAGES = {
  enableNeedsAccount: "Add at least one wallet account first.",
  rateRange: "Enter a rate between 1 and 1000 with up to 2 decimals.",
  labelLength: "Use 2 to 40 characters.",
  accountLength: "Use 2 to 100 characters.",
  instructionsLength: "Use up to 500 characters.",
  tooManyAccounts: "You can add up to 5 wallet accounts.",
  saved: "Saved.",
} as const;
