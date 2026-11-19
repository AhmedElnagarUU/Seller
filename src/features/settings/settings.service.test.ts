import { describe, expect, it } from "vitest";
import { SettingsModel } from "@/features/settings/settings.model";
import { getWalletSettings, updateWalletSettings } from "@/features/settings/settings.service";
import { setSettings } from "@/shared/test/factories";

const ACCOUNT = { label: "Vodafone Cash", account: "01012345678", instructions: "Send from the app." };
const NEEDS_ACCOUNT = "Add at least one wallet account first.";

describe("getWalletSettings", () => {
  it("creates the defaults on first use and keeps exactly one document with _id 'global'", async () => {
    expect(await SettingsModel.countDocuments()).toBe(0);

    const first = await getWalletSettings();
    const second = await getWalletSettings();

    expect(first).toEqual({ walletEnabled: false, usdToEgpRate: 50, walletAccounts: [] });
    expect(second).toEqual(first);
    const documents = await SettingsModel.find().lean();
    expect(documents).toHaveLength(1);
    expect(documents[0]?._id).toBe("global");
  });
});

describe("updateWalletSettings", () => {
  it("saves the three fields", async () => {
    await updateWalletSettings({ walletEnabled: true, usdToEgpRate: 48.5, walletAccounts: [ACCOUNT] });

    expect(await getWalletSettings()).toEqual({ walletEnabled: true, usdToEgpRate: 48.5, walletAccounts: [ACCOUNT] });
    expect(await SettingsModel.countDocuments()).toBe(1);
  });

  it("refuses enabling with 0 accounts → INVALID 'Add at least one wallet account first.'; the document is unchanged", async () => {
    await setSettings({ walletEnabled: false, usdToEgpRate: 55, walletAccounts: [] });

    await expect(
      updateWalletSettings({ walletEnabled: true, usdToEgpRate: 60, walletAccounts: [] }),
    ).rejects.toMatchObject({ code: "INVALID", message: NEEDS_ACCOUNT });

    expect(await getWalletSettings()).toEqual({ walletEnabled: false, usdToEgpRate: 55, walletAccounts: [] });
  });

  it("allows disabling with 0 accounts and enabling with 1 account", async () => {
    await updateWalletSettings({ walletEnabled: false, usdToEgpRate: 50, walletAccounts: [] });
    expect((await getWalletSettings()).walletEnabled).toBe(false);

    await updateWalletSettings({ walletEnabled: true, usdToEgpRate: 50, walletAccounts: [ACCOUNT] });

    expect((await getWalletSettings()).walletEnabled).toBe(true);
  });
});
