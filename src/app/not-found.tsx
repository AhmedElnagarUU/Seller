import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";

export default function NotFoundPage() {
  return (
    <PageContainer>
      <Stack align="start">
        <Heading level={1}>Page not found</Heading>
        <Text>The page you are looking for does not exist.</Text>
        <ButtonLink href="/themes">Browse themes</ButtonLink>
      </Stack>
    </PageContainer>
  );
}
