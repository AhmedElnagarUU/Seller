import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/shared/config/env";
import { Stack } from "@/shared/layout/Stack";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { requireUser } from "@/features/auth/session";
import { ACCOUNT_MESSAGES } from "@/features/users/account.messages";
import { getAccountSettings } from "@/features/users/account.service";
import { DeleteAccountCard } from "@/features/users/components/DeleteAccountCard";
import { EmailPreferencesForm } from "@/features/users/components/EmailPreferencesForm";
import { PasswordForm } from "@/features/users/components/PasswordForm";
import { ProfileForm } from "@/features/users/components/ProfileForm";

export const metadata: Metadata = { title: "Settings · Theme Store", robots: { index: false } };

export default async function AccountSettingsPage() {
  const user = await requireUser("/account/settings");
  const settings = await getAccountSettings(user.id);
  if (!settings) notFound();

  return (
    <Stack gap="lg">
      <Heading level={1}>Settings</Heading>
      <Card>
        <Stack>
          <Heading level={2}>Profile</Heading>
          <ProfileForm settings={settings} />
        </Stack>
      </Card>
      {settings.hasPassword ? (
        <Card>
          <Stack>
            <Heading level={2}>Password</Heading>
            <PasswordForm />
          </Stack>
        </Card>
      ) : null}
      <Card>
        <Stack>
          <Heading level={2}>{ACCOUNT_MESSAGES.emailNotificationsTitle}</Heading>
          <EmailPreferencesForm settings={settings} />
        </Stack>
      </Card>
      <Card>
        <Stack>
          <Heading level={2}>Delete account</Heading>
          <DeleteAccountCard supportEmail={env.SUPPORT_EMAIL} />
        </Stack>
      </Card>
    </Stack>
  );
}
