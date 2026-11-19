import { AppError } from "@/shared/errors";
import { SETTINGS_MESSAGES } from "@/features/settings/settings.constants";
import * as settingsRepository from "@/features/settings/settings.repository";
import type { WalletSettingsInput } from "@/features/settings/settings.schemas";
import type { WalletSettingsDTO } from "@/features/settings/settings.types";

// The wallet settings. The document is created with the defaults on first use.
export async function getWalletSettings(): Promise<WalletSettingsDTO> {
  const settings = await settingsRepository.findOrCreateSettings();
  return {
    walletEnabled: settings.walletEnabled,
    usdToEgpRate: settings.usdToEgpRate,
    walletAccounts: settings.walletAccounts.map((account) => ({
      label: account.label,
      account: account.account,
      instructions: account.instructions,
    })),
  };
}

// Saves the wallet settings. The wallet can only be switched on when there is an account to pay to.
export async function updateWalletSettings(input: WalletSettingsInput): Promise<void> {
  if (input.walletEnabled && input.walletAccounts.length === 0) {
    throw new AppError("INVALID", SETTINGS_MESSAGES.enableNeedsAccount);
  }
  await settingsRepository.saveWalletSettings({
    walletEnabled: input.walletEnabled,
    usdToEgpRate: input.usdToEgpRate,
    walletAccounts: input.walletAccounts,
  });
}
