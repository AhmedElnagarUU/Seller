import type { Metadata } from "next";
import { Inline } from "@/shared/layout/Inline";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { ThemeGrid } from "@/features/themes/components/ThemeGrid";
import { getHomePageData } from "@/features/themes/theme.service";
import type { ThemeCardDTO } from "@/features/themes/theme.types";

export const metadata: Metadata = {
  title: "Theme Store — Premium WordPress themes",
};

type ThemeSectionProps = {
  title: string;
  themes: ThemeCardDTO[];
  seeAllHref: string;
};

function ThemeSection({ title, themes, seeAllHref }: ThemeSectionProps) {
  if (themes.length === 0) return null;
  return (
    <Stack>
      <Inline justify="between">
        <Heading level={2}>{title}</Heading>
        <TextLink href={seeAllHref}>See all</TextLink>
      </Inline>
      <ThemeGrid themes={themes} />
    </Stack>
  );
}

export default async function HomePage() {
  const { featured, bestSellers, newest, categories } = await getHomePageData();
  const hasThemes = newest.length > 0;

  return (
    <PageContainer width="wide">
      <Stack gap="xl">
        <Stack align="start">
          <Heading level={1}>Premium WordPress themes</Heading>
          <Text tone="muted">Pay once, get every update for life.</Text>
          <ButtonLink href="/themes">Browse themes</ButtonLink>
        </Stack>
        {hasThemes ? null : <Text>New themes are coming soon.</Text>}
        <ThemeSection title="Featured" themes={featured} seeAllHref="/themes" />
        <ThemeSection title="Best sellers" themes={bestSellers} seeAllHref="/themes?sort=best" />
        <ThemeSection title="New themes" themes={newest} seeAllHref="/themes?sort=newest" />
        {categories.length > 0 ? (
          <Stack>
            <Heading level={2}>Categories</Heading>
            <Inline gap="lg" wrap>
              {categories.map((category) => (
                <TextLink key={category.slug} href={`/categories/${category.slug}`}>
                  {category.name} ({category.themeCount})
                </TextLink>
              ))}
            </Inline>
          </Stack>
        ) : null}
      </Stack>
    </PageContainer>
  );
}
