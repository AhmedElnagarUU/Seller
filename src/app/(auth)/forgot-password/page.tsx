import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <PageContainer width="narrow">
      <Card padding="lg">
        <Stack gap="lg">
          <Heading level={1}>Reset your password</Heading>
          <ForgotPasswordForm />
        </Stack>
      </Card>
    </PageContainer>
  );
}
