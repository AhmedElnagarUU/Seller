import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { WalletSettingsForm } from "@/features/settings/components/admin/WalletSettingsForm";
import { getWalletSettings } from "@/features/settings/settings.service";

export const metadata: Metadata = {
  title: "Settings · Theme Store",
  robots: { index: false },
};

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getWalletSettings();

  return (
    <Stack>
      <Heading level={1}>Settings</Heading>
      <Card>
        <Stack>
          <Heading level={2}>Wallet payments</Heading>
          <WalletSettingsForm settings={settings} />
        </Stack>
      </Card>
    </Stack>
  );
}
