import type { Metadata } from "next";
import { env } from "@/shared/config/env";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { getCurrentUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "Contact · Theme Store" };

export default async function ContactPage() {
  const user = await getCurrentUser();
  return (
    <PageContainer width="narrow">
      <Stack gap="lg">
        <Heading level={1}>Contact</Heading>
        <Text>
          Questions before or after buying? Email us at{" "}
          <TextLink href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</TextLink> and we usually reply within 1–2
          business days.
        </Text>
        {user ? <TextLink href="/account/feedback">Send feedback</TextLink> : null}
      </Stack>
    </PageContainer>
  );
}
