import { redirect } from "next/navigation";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { ResendVerificationForm } from "@/features/auth/components/ResendVerificationForm";
import { requireUser } from "@/features/auth/session";

export default async function VerifyEmailPage() {
  const user = await requireUser("/verify-email");
  if (user.emailVerified) redirect("/account");

  return (
    <PageContainer width="narrow">
      <Card padding="lg">
        <Stack gap="lg">
          <Heading level={1}>Confirm your email</Heading>
          <Text>
            We sent a confirmation link to {user.email}. Click it to verify your account. You need a verified email to
            buy themes.
          </Text>
          <ResendVerificationForm />
        </Stack>
      </Card>
    </PageContainer>
  );
}
