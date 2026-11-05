import type { ThemeStatus } from "@/features/themes/theme.constants";
import type { CategoryWithCountDTO } from "@/features/categories/category.types";

export type ThemeImageDTO = {
  url: string;
  alt: string;
  width: number;
  height: number;
};

export type ThemeCardDTO = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  priceCents: number;
  coverImage: ThemeImageDTO | null;
  categoryName: string;
  latestVersion: string | null;
};

export type ThemeDetailDTO = ThemeCardDTO & {
  description: string;
  features: string[];
  images: ThemeImageDTO[];
  demoUrl: string | null;
  requirements: { wordpressMin: string; phpMin: string; testedUpTo: string };
  category: { name: string; slug: string };
  latestVersionReleasedAt: Date | null;
};

// Everything the admin form edits, plus status and publishedAt.
export type ThemeAdminDTO = {
  id: string;
  name: string;
  slug: string;
  status: ThemeStatus;
  tagline: string;
  description: string;
  features: string[];
  categoryId: string;
  priceCents: number;
  demoUrl: string | null;
  wordpressMin: string;
  phpMin: string;
  testedUpTo: string;
  featured: boolean;
  publishedAt: Date | null;
};

export type ThemeAdminListItemDTO = {
  id: string;
  name: string;
  status: ThemeStatus;
  priceCents: number;
  latestVersion: string | null;
  salesCount: number;
  downloadCount: number;
  updatedAt: Date;
};

export type ThemePageDTO<Item> = {
  items: Item[];
  page: number;
  totalPages: number;
  total: number;
};

export type HomePageDataDTO = {
  featured: ThemeCardDTO[];
  bestSellers: ThemeCardDTO[];
  newest: ThemeCardDTO[];
  categories: CategoryWithCountDTO[];
};
