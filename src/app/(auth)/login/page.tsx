import { redirect } from "next/navigation";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { safeNextPath } from "@/shared/lib/paths";
import { Alert } from "@/shared/ui/Alert";
import { Card } from "@/shared/ui/Card";
import { Divider } from "@/shared/ui/Divider";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { getCurrentUser } from "@/features/auth/session";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>;
};

function readInitialError(error: string | undefined): string | null {
  if (!error) return null;
  return error.toUpperCase().includes("ACCOUNT_DISABLED") ? AUTH_MESSAGES.disabled : AUTH_MESSAGES.googleFailed;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, reset, error } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getCurrentUser()) redirect(nextPath);

  return (
    <PageContainer width="narrow">
      <Card padding="lg">
        <Stack gap="lg">
          <Heading level={1}>Log in</Heading>
          {reset === "1" ? <Alert tone="success">{AUTH_MESSAGES.passwordChanged}</Alert> : null}
          <LoginForm next={nextPath} initialError={readInitialError(error)} />
          <Divider label="or" />
          <GoogleButton callbackPath={next ? nextPath : undefined} />
          <Text size="sm" tone="muted">
            No account yet? <TextLink href="/register">Create one</TextLink>
          </Text>
        </Stack>
      </Card>
    </PageContainer>
  );
}
