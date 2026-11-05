import { publicImageUrl } from "@/shared/storage/public-url";
import type { CategoryDTO } from "@/features/categories/category.types";
import type { ThemeRecord } from "@/features/themes/theme.model";
import type {
  ThemeAdminDTO,
  ThemeAdminListItemDTO,
  ThemeCardDTO,
  ThemeDetailDTO,
  ThemeImageDTO,
} from "@/features/themes/theme.types";

type ThemeImageRecord = ThemeRecord["images"][number];

function toThemeImageDTO(image: ThemeImageRecord): ThemeImageDTO {
  return { url: publicImageUrl(image.key), alt: image.alt, width: image.width, height: image.height };
}

export function toThemeCardDTO(theme: ThemeRecord, categoryName: string): ThemeCardDTO {
  const [firstImage] = theme.images;
  return {
    id: theme._id.toString(),
    slug: theme.slug,
    name: theme.name,
    tagline: theme.tagline,
    priceCents: theme.priceCents,
    coverImage: firstImage ? toThemeImageDTO(firstImage) : null,
    categoryName,
    latestVersion: theme.latestVersion?.version ?? null,
  };
}

export function toThemeDetailDTO(theme: ThemeRecord, category: CategoryDTO): ThemeDetailDTO {
  return {
    ...toThemeCardDTO(theme, category.name),
    description: theme.description,
    features: theme.features,
    images: theme.images.map(toThemeImageDTO),
    demoUrl: theme.demoUrl ?? null,
    requirements: {
      wordpressMin: theme.requirements.wordpressMin,
      phpMin: theme.requirements.phpMin,
      testedUpTo: theme.requirements.testedUpTo,
    },
    category: { name: category.name, slug: category.slug },
    latestVersionReleasedAt: theme.latestVersion?.releasedAt ?? null,
  };
}

export function toThemeAdminDTO(theme: ThemeRecord): ThemeAdminDTO {
  return {
    id: theme._id.toString(),
    name: theme.name,
    slug: theme.slug,
    status: theme.status,
    tagline: theme.tagline,
    description: theme.description,
    features: theme.features,
    categoryId: theme.categoryId.toString(),
    priceCents: theme.priceCents,
    demoUrl: theme.demoUrl ?? null,
    wordpressMin: theme.requirements.wordpressMin,
    phpMin: theme.requirements.phpMin,
    testedUpTo: theme.requirements.testedUpTo,
    featured: theme.featured,
    publishedAt: theme.publishedAt ?? null,
  };
}

export function toThemeAdminListItemDTO(theme: ThemeRecord): ThemeAdminListItemDTO {
  return {
    id: theme._id.toString(),
    name: theme.name,
    status: theme.status,
    priceCents: theme.priceCents,
    latestVersion: theme.latestVersion?.version ?? null,
    salesCount: theme.stats.salesCount,
    downloadCount: theme.stats.downloadCount,
    updatedAt: theme.updatedAt,
  };
}
