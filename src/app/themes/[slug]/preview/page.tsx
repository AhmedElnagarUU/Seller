import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoPreview } from "@/features/themes/components/DemoPreview";
import { getPublishedThemeBySlug } from "@/features/themes/theme.service";

type PreviewPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PreviewPageProps): Promise<Metadata> {
  const { slug } = await params;
  const theme = await getPublishedThemeBySlug(slug);
  return { title: theme ? `${theme.name} live demo · Theme Store` : "Page not found · Theme Store" };
}

export default async function ThemePreviewPage({ params }: PreviewPageProps) {
  const { slug } = await params;
  const theme = await getPublishedThemeBySlug(slug);
  if (!theme || theme.demoUrl === null) notFound();
  return (
    <DemoPreview themeName={theme.name} themeSlug={theme.slug} priceCents={theme.priceCents} demoUrl={theme.demoUrl} />
  );
}
