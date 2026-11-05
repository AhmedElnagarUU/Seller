import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/shared/layout/PageContainer";
import { ThemeDetail } from "@/features/themes/components/ThemeDetail";
import { getPublishedThemeBySlug } from "@/features/themes/theme.service";

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

  return (
    <PageContainer width="wide">
      <ThemeDetail theme={theme} />
    </PageContainer>
  );
}
