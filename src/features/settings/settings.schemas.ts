import { z } from "zod";
import {
  EGP_RATE_MAX,
  EGP_RATE_MIN,
  MAX_WALLET_ACCOUNTS,
  SETTINGS_MESSAGES,
  WALLET_ACCOUNT_MAX,
  WALLET_ACCOUNT_MIN,
  WALLET_INSTRUCTIONS_MAX,
  WALLET_LABEL_MAX,
  WALLET_LABEL_MIN,
} from "@/features/settings/settings.constants";

const RATE_TEXT_PATTERN = /^\d{1,4}(\.\d+)?$/;

function isValidRate(text: string): boolean {
  if (!RATE_TEXT_PATTERN.test(text)) return false;
  const value = Number(text);
  return value >= EGP_RATE_MIN && value <= EGP_RATE_MAX && Math.round(value * 100) / 100 === value;
}

// A row as typed in the form.
const typedAccountSchema = z.object({
  label: z.string().trim(),
  account: z.string().trim(),
  instructions: z.string().trim(),
});

type TypedAccount = z.infer<typeof typedAccountSchema>;

function isFilledIn(row: TypedAccount): boolean {
  return row.label !== "" || row.account !== "" || row.instructions !== "";
}

const checkedAccountSchema = z.object({
  label: z
    .string()
    .min(WALLET_LABEL_MIN, SETTINGS_MESSAGES.labelLength)
    .max(WALLET_LABEL_MAX, SETTINGS_MESSAGES.labelLength),
  account: z
    .string()
    .min(WALLET_ACCOUNT_MIN, SETTINGS_MESSAGES.accountLength)
    .max(WALLET_ACCOUNT_MAX, SETTINGS_MESSAGES.accountLength),
  instructions: z.string().max(WALLET_INSTRUCTIONS_MAX, SETTINGS_MESSAGES.instructionsLength),
});

// Rows that are completely empty are dropped before the rows are checked.
const walletAccountsSchema = z
  .array(typedAccountSchema)
  .transform((rows) => rows.filter(isFilledIn))
  .pipe(z.array(checkedAccountSchema).max(MAX_WALLET_ACCOUNTS, SETTINGS_MESSAGES.tooManyAccounts));

// The wallet part of /admin/settings. The rate comes in as text and goes out as a number.
export const walletSettingsSchema = z.object({
  walletEnabled: z.boolean(),
  usdToEgpRate: z
    .string()
    .trim()
    .refine(isValidRate, SETTINGS_MESSAGES.rateRange)
    .transform((text) => Number(text)),
  walletAccounts: walletAccountsSchema,
});

export type WalletSettingsInput = z.output<typeof walletSettingsSchema>;
