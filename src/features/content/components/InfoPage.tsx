import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { MarkdownText } from "@/shared/ui/MarkdownText";
import type { InfoPageDTO } from "@/features/content/content.types";

type InfoPageProps = {
  page: InfoPageDTO;
};

export function InfoPage({ page }: InfoPageProps) {
  return (
    <PageContainer width="narrow">
      <Stack gap="lg">
        <Heading level={1}>{page.title}</Heading>
        <MarkdownText>{page.markdown}</MarkdownText>
      </Stack>
    </PageContainer>
  );
}
