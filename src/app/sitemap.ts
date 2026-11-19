import type { MetadataRoute } from "next";
import { env } from "@/shared/config/env";
import { listCategoriesWithPublishedCounts } from "@/features/categories/category.service";
import { INFO_PAGES } from "@/features/content/content.constants";
import { listPublishedThemeSlugs } from "@/features/themes/theme.service";

// It reads the database, and `pnpm build` runs in CI without one.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, themeSlugs] = await Promise.all([listCategoriesWithPublishedCounts(), listPublishedThemeSlugs()]);
  const paths = [
    "/",
    "/themes",
    ...categories.map((category) => `/categories/${category.slug}`),
    ...themeSlugs.map((slug) => `/themes/${slug}`),
    ...INFO_PAGES.map((page) => `/${page.slug}`),
    "/contact",
  ];
  return paths.map((path) => ({ url: `${env.APP_URL}${path}` }));
}
