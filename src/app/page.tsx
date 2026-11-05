import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";

export default function HomePage() {
  return (
    <PageContainer>
      <Stack>
        <Heading level={1}>Theme Store</Heading>
        <Text tone="muted">Premium WordPress themes.</Text>
      </Stack>
    </PageContainer>
  );
}
