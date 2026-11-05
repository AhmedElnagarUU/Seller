import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Pagination } from "@/shared/ui/Pagination";
import { Text } from "@/shared/ui/Text";
import { getCategoryBySlug } from "@/features/categories/category.service";
import { ThemeGrid } from "@/features/themes/components/ThemeGrid";
import { themeSearchParamsSchema } from "@/features/themes/theme.schemas";
import { listPublishedThemes } from "@/features/themes/theme.service";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  return { title: `${category?.name ?? "Category"} · Theme Store` };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const { page } = themeSearchParamsSchema.parse(await searchParams);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  const result = await listPublishedThemes({ categorySlug: slug, page });

  return (
    <PageContainer width="wide">
      <Stack gap="lg">
        <Stack>
          <Heading level={1}>{category.name}</Heading>
          {category.description ? <Text tone="muted">{category.description}</Text> : null}
        </Stack>
        {result.items.length > 0 ? <ThemeGrid themes={result.items} /> : <Text>No themes in this category yet.</Text>}
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          buildHref={(targetPage) => `/categories/${slug}?page=${targetPage}`}
        />
      </Stack>
    </PageContainer>
  );
}
