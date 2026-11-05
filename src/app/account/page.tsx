import { Inline } from "@/shared/layout/Inline";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { Badge } from "@/shared/ui/Badge";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { requireUser } from "@/features/auth/session";

// Temporary account page. A later task replaces it.
export default async function AccountPage() {
  const user = await requireUser("/account");

  return (
    <PageContainer>
      <Stack>
        <Heading level={1}>Your account</Heading>
        <Text>Hi {user.name}</Text>
        <Inline gap="sm">
          {user.emailVerified ? <Badge tone="success">Email verified</Badge> : null}
          {user.isAdmin ? <Badge>Admin</Badge> : null}
        </Inline>
        {user.emailVerified ? null : (
          <Alert tone="warning">
            Please confirm your email address. <TextLink href="/verify-email">Confirm email</TextLink>
          </Alert>
        )}
      </Stack>
    </PageContainer>
  );
}
