export type WalletAccountFields = { label: string; account: string; instructions: string };

// The wallet part of the settings, as the pages and services use it.
export type WalletSettingsDTO = {
  walletEnabled: boolean;
  usdToEgpRate: number;
  walletAccounts: WalletAccountFields[];
};
