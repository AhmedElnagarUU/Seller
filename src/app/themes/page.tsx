import type { Metadata } from "next";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Pagination } from "@/shared/ui/Pagination";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { listCategoriesWithPublishedCounts } from "@/features/categories/category.service";
import { ThemeFilters } from "@/features/themes/components/ThemeFilters";
import { ThemeGrid } from "@/features/themes/components/ThemeGrid";
import { DEFAULT_THEME_SORT } from "@/features/themes/theme.constants";
import { themeSearchParamsSchema } from "@/features/themes/theme.schemas";
import { listPublishedThemes } from "@/features/themes/theme.service";

export const metadata: Metadata = {
  title: "Themes · Theme Store",
};

type ThemesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ThemesPage({ searchParams }: ThemesPageProps) {
  const filters = themeSearchParamsSchema.parse(await searchParams);
  const [result, categories] = await Promise.all([
    listPublishedThemes({ q: filters.q, categorySlug: filters.category, sort: filters.sort, page: filters.page }),
    listCategoriesWithPublishedCounts(),
  ]);

  // Links to other pages keep the current filters.
  function buildHref(page: number): string {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.category) params.set("category", filters.category);
    if (filters.sort !== DEFAULT_THEME_SORT) params.set("sort", filters.sort);
    params.set("page", String(page));
    return `/themes?${params.toString()}`;
  }

  return (
    <PageContainer width="wide">
      <Stack gap="lg">
        <Heading level={1}>Themes</Heading>
        <ThemeFilters q={filters.q} categorySlug={filters.category} sort={filters.sort} categories={categories} />
        <Text tone="muted">{result.total} themes</Text>
        {result.items.length > 0 ? (
          <ThemeGrid themes={result.items} />
        ) : (
          <Stack align="start">
            <Text>No themes match your search.</Text>
            <TextLink href="/themes">Clear filters</TextLink>
          </Stack>
        )}
        <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
      </Stack>
    </PageContainer>
  );
}
