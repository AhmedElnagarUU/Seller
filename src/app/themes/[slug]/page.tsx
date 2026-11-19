import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { getCurrentUser } from "@/features/auth/session";
import { isThemeFavorite } from "@/features/favorites/favorite.service";
import { ThemeDetail } from "@/features/themes/components/ThemeDetail";
import { getPublishedThemeBySlug } from "@/features/themes/theme.service";
import { Changelog } from "@/features/versions/components/Changelog";
import { listVersionsForTheme } from "@/features/versions/version.service";

type ThemePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ThemePageProps): Promise<Metadata> {
  const { slug } = await params;
  const theme = await getPublishedThemeBySlug(slug);
  if (!theme) return { title: "Theme Store" };
  return {
    title: `${theme.name} · Theme Store`,
    description: theme.tagline,
    openGraph: { images: theme.coverImage ? [theme.coverImage.url] : [] },
  };
}

export default async function ThemePage({ params }: ThemePageProps) {
  const { slug } = await params;
  const theme = await getPublishedThemeBySlug(slug);
  if (!theme) notFound();
  const user = await getCurrentUser();
  const isFavorite = user ? await isThemeFavorite(user.id, theme.id) : false;

  return (
    <PageContainer width="wide">
      <Stack gap="xl">
        <ThemeDetail theme={theme} isLoggedIn={user !== null} isFavorite={isFavorite} />
        <Changelog versions={await listVersionsForTheme(theme.id)} />
      </Stack>
    </PageContainer>
  );
}
