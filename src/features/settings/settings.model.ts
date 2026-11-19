import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import {
  DEFAULT_USD_TO_EGP_RATE,
  EGP_RATE_MAX,
  EGP_RATE_MIN,
  MAX_WALLET_ACCOUNTS,
  SETTINGS_ID,
  WALLET_ACCOUNT_MAX,
  WALLET_ACCOUNT_MIN,
  WALLET_INSTRUCTIONS_MAX,
  WALLET_LABEL_MAX,
  WALLET_LABEL_MIN,
} from "@/features/settings/settings.constants";

// One account that the customer sends money to, e.g. "Vodafone Cash" and its number.
const walletAccountSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, minlength: WALLET_LABEL_MIN, maxlength: WALLET_LABEL_MAX },
    account: { type: String, required: true, trim: true, minlength: WALLET_ACCOUNT_MIN, maxlength: WALLET_ACCOUNT_MAX },
    instructions: { type: String, default: "", trim: true, maxlength: WALLET_INSTRUCTIONS_MAX },
  },
  { _id: false },
);

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.round(value * 100) / 100 === value;
}

function hasAtMostAccounts(accounts: unknown[]): boolean {
  return accounts.length <= MAX_WALLET_ACCOUNTS;
}

// Exactly one document with the string id "global" (docs/03-data-model.md section 18).
const settingsSchema = new Schema(
  {
    _id: { type: String, default: SETTINGS_ID },
    walletEnabled: { type: Boolean, required: true, default: false },
    // USD → EGP rate, 1 to 1000, at most 2 decimals.
    usdToEgpRate: {
      type: Number,
      required: true,
      default: DEFAULT_USD_TO_EGP_RATE,
      min: EGP_RATE_MIN,
      max: EGP_RATE_MAX,
      validate: hasAtMostTwoDecimals,
    },
    walletAccounts: { type: [walletAccountSchema], default: [], validate: hasAtMostAccounts },
  },
  { collection: "settings", timestamps: true },
);

export type SettingsRecord = InferSchemaType<typeof settingsSchema>;

// `models.Settings ||` stops hot reload from defining the model twice.
export const SettingsModel =
  (models.Settings as Model<SettingsRecord>) || model<SettingsRecord>("Settings", settingsSchema);
