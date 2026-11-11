import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { Badge } from "@/shared/ui/Badge";
import { Heading } from "@/shared/ui/Heading";
import { TextLink } from "@/shared/ui/TextLink";
import { requireAdmin } from "@/features/auth/session";
import { listCategoriesForAdmin } from "@/features/categories/category.service";
import { ThemeForm } from "@/features/themes/components/admin/ThemeForm";
import { ThemeImagesManager } from "@/features/themes/components/admin/ThemeImagesManager";
import { THEME_STATUS_LABELS } from "@/features/themes/theme.constants";
import { getThemeForAdmin } from "@/features/themes/theme.service";

export const metadata: Metadata = {
  title: "Edit theme · Theme Store",
  robots: { index: false },
};

type EditThemePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function EditThemePage({ params, searchParams }: EditThemePageProps) {
  await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  const theme = await getThemeForAdmin(id);
  if (!theme) notFound();
  const categories = await listCategoriesForAdmin();
  const categoryOptions = categories.map((category) => ({ value: category.id, label: category.name }));

  return (
    <Stack gap="lg">
      {created === "1" ? <Alert tone="success">Draft created.</Alert> : null}
      <Inline wrap>
        <Heading level={1}>{theme.name}</Heading>
        <Badge>{THEME_STATUS_LABELS[theme.status]}</Badge>
        {theme.status === "published" ? <TextLink href={`/themes/${theme.slug}`}>View in store</TextLink> : null}
      </Inline>
      <ThemeForm theme={theme} categoryOptions={categoryOptions} />
      <ThemeImagesManager themeId={theme.id} images={theme.images} />
    </Stack>
  );
}
