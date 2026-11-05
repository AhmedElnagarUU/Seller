import { AppError } from "@/shared/errors";
import {
  DEFAULT_THEME_SORT,
  HOME_SECTION_SIZE,
  THEMES_PER_PAGE,
  type ThemeSort,
  type ThemeStatus,
} from "@/features/themes/theme.constants";
import {
  getCategoryById,
  getCategoryBySlug,
  listCategoriesWithPublishedCounts,
} from "@/features/categories/category.service";
import {
  toThemeAdminDTO,
  toThemeAdminListItemDTO,
  toThemeCardDTO,
  toThemeDetailDTO,
} from "@/features/themes/theme.mapper";
import type { ThemeRecord } from "@/features/themes/theme.model";
import * as themeRepository from "@/features/themes/theme.repository";
import type { ThemeQuery } from "@/features/themes/theme.repository";
import type { ThemeInput } from "@/features/themes/theme.schemas";
import type {
  HomePageDataDTO,
  ThemeAdminDTO,
  ThemeAdminListItemDTO,
  ThemeCardDTO,
  ThemeDetailDTO,
  ThemePageDTO,
} from "@/features/themes/theme.types";

type PublishedThemesInput = {
  q?: string;
  categorySlug?: string;
  sort?: ThemeSort;
  page?: number;
};

type AdminThemesInput = {
  status?: ThemeStatus;
  q?: string;
  page?: number;
};

function toFields(input: ThemeInput): themeRepository.ThemeFields {
  return {
    name: input.name,
    slug: input.slug,
    tagline: input.tagline,
    description: input.description,
    features: input.features,
    categoryId: input.categoryId,
    priceCents: input.priceCents,
    demoUrl: input.demoUrl,
    requirements: { wordpressMin: input.wordpressMin, phpMin: input.phpMin, testedUpTo: input.testedUpTo },
    featured: input.featured,
  };
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await getCategoryById(categoryId);
  if (!category) throw new AppError("INVALID", "Choose a category.");
}

// Turns a unique-index error (the slug) into the message for the admin. Other errors pass through.
function throwSlugConflict(error: unknown): never {
  if (themeRepository.isDuplicateKeyError(error)) throw new AppError("CONFLICT", "This slug is already used.");
  throw error;
}

// Makes cards for themes. Looks up each category name once.
async function toCards(themes: ThemeRecord[]): Promise<ThemeCardDTO[]> {
  const categoryIds = [...new Set(themes.map((theme) => theme.categoryId.toString()))];
  const categories = await Promise.all(categoryIds.map((categoryId) => getCategoryById(categoryId)));
  const categoryNames = new Map<string, string>();
  for (const category of categories) {
    if (category) categoryNames.set(category.id, category.name);
  }
  return themes.map((theme) => toThemeCardDTO(theme, categoryNames.get(theme.categoryId.toString()) ?? ""));
}

function toPageNumber(page: number | undefined): number {
  return Math.max(1, page ?? 1);
}

function toTotalPages(total: number): number {
  return Math.ceil(total / THEMES_PER_PAGE);
}

// Creates a draft theme.
export async function createTheme(input: ThemeInput, adminUserId: string): Promise<{ id: string }> {
  void adminUserId; // Reserved for the activity log (a later task).
  await assertCategoryExists(input.categoryId);
  try {
    const created = await themeRepository.insertTheme(toFields(input));
    return { id: created._id.toString() };
  } catch (error) {
    return throwSlugConflict(error);
  }
}

// Changes the editable fields of a theme. Status, images, versions, stats and provider stay as they are.
export async function updateTheme(id: string, input: ThemeInput, adminUserId: string): Promise<void> {
  void adminUserId; // Reserved for the activity log (a later task).
  const theme = await themeRepository.findThemeById(id);
  if (!theme) throw new AppError("NOT_FOUND", "Theme not found.");
  const wasPublished = theme.publishedAt !== null && theme.publishedAt !== undefined;
  if (wasPublished && input.slug !== theme.slug) {
    throw new AppError("CONFLICT", "The slug cannot change after the theme was published.");
  }
  await assertCategoryExists(input.categoryId);
  try {
    await themeRepository.updateThemeById(id, toFields(input));
  } catch (error) {
    throwSlugConflict(error);
  }
}

// Finds a theme for the admin edit page, any status, or null.
export async function getThemeForAdmin(id: string): Promise<ThemeAdminDTO | null> {
  const theme = await themeRepository.findThemeById(id);
  return theme ? toThemeAdminDTO(theme) : null;
}

// One page of themes for the admin list, newest created first.
export async function listThemesForAdmin(input: AdminThemesInput): Promise<ThemePageDTO<ThemeAdminListItemDTO>> {
  const page = toPageNumber(input.page);
  const query: ThemeQuery = { status: input.status, nameContains: input.q?.trim() };
  const [themes, total] = await Promise.all([
    themeRepository.findThemes(query, "recently-created", page, THEMES_PER_PAGE),
    themeRepository.countThemes(query),
  ]);
  return { items: themes.map(toThemeAdminListItemDTO), page, totalPages: toTotalPages(total), total };
}

// One page of published themes for the store. Search is a case-insensitive "contains" on name and tagline.
export async function listPublishedThemes(input: PublishedThemesInput): Promise<ThemePageDTO<ThemeCardDTO>> {
  const page = toPageNumber(input.page);
  const category = input.categorySlug ? await getCategoryBySlug(input.categorySlug) : null;
  const query: ThemeQuery = {
    status: "published",
    categoryId: category?.id,
    nameOrTaglineContains: input.q?.trim(),
  };
  const [themes, total] = await Promise.all([
    themeRepository.findThemes(query, input.sort ?? DEFAULT_THEME_SORT, page, THEMES_PER_PAGE),
    themeRepository.countThemes(query),
  ]);
  return { items: await toCards(themes), page, totalPages: toTotalPages(total), total };
}

// Finds a published theme by slug. Draft and unpublished themes give null.
export async function getPublishedThemeBySlug(slug: string): Promise<ThemeDetailDTO | null> {
  const theme = await themeRepository.findThemeBySlug(slug);
  if (!theme || theme.status !== "published") return null;
  const category = await getCategoryById(theme.categoryId.toString());
  return category ? toThemeDetailDTO(theme, category) : null;
}

async function findHomeSection(sort: ThemeSort, extraQuery: ThemeQuery): Promise<ThemeCardDTO[]> {
  const themes = await themeRepository.findThemes({ ...extraQuery, status: "published" }, sort, 1, HOME_SECTION_SIZE);
  return toCards(themes);
}

// Everything the home page shows: up to 6 themes in each section and the categories.
export async function getHomePageData(): Promise<HomePageDataDTO> {
  const [featured, bestSellers, newest, categories] = await Promise.all([
    findHomeSection("newest", { isFeatured: true }),
    findHomeSection("best", {}),
    findHomeSection("newest", {}),
    listCategoriesWithPublishedCounts(),
  ]);
  return { featured, bestSellers, newest, categories };
}

// Counts the themes of a category, any status.
export async function countThemesInCategory(categoryId: string): Promise<number> {
  return themeRepository.countThemes({ categoryId });
}

// Counts the published themes of a category.
export async function countPublishedThemesInCategory(categoryId: string): Promise<number> {
  return themeRepository.countThemes({ categoryId, status: "published" });
}
