import { connectDB } from "@/shared/db/connect";
import { DEFAULT_USD_TO_EGP_RATE, SETTINGS_ID } from "@/features/settings/settings.constants";
import { SettingsModel, type SettingsRecord } from "@/features/settings/settings.model";
import type { WalletSettingsDTO } from "@/features/settings/settings.types";

// Returns the one settings document. It is created with the defaults when it does not exist.
export async function findOrCreateSettings(): Promise<SettingsRecord> {
  await connectDB();
  const settings = await SettingsModel.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $setOnInsert: { walletEnabled: false, usdToEgpRate: DEFAULT_USD_TO_EGP_RATE, walletAccounts: [] } },
    { upsert: true, returnDocument: "after" },
  ).lean<SettingsRecord>();
  if (!settings) throw new Error("The settings were not created.");
  return settings;
}

// Saves the three wallet fields.
export async function saveWalletSettings(fields: WalletSettingsDTO): Promise<SettingsRecord | null> {
  await connectDB();
  return SettingsModel.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $set: fields },
    { upsert: true, returnDocument: "after", runValidators: true },
  ).lean<SettingsRecord>();
}
