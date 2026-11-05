import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { TextLink } from "@/shared/ui/TextLink";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token, error } = await searchParams;
  const linkIsInvalid = !token || error === "INVALID_TOKEN";

  return (
    <PageContainer width="narrow">
      <Card padding="lg">
        <Stack gap="lg">
          {linkIsInvalid ? (
            <>
              <Alert tone="danger">{AUTH_MESSAGES.resetLinkInvalid}</Alert>
              <TextLink href="/forgot-password">Ask for a new link</TextLink>
            </>
          ) : (
            <>
              <Heading level={1}>Choose a new password</Heading>
              <ResetPasswordForm token={token} />
            </>
          )}
        </Stack>
      </Card>
    </PageContainer>
  );
}
