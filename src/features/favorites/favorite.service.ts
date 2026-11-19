import { AppError } from "@/shared/errors";
import { getCategoryById } from "@/features/categories/category.service";
import type { FavoriteTargetType } from "@/features/favorites/favorite.constants";
import * as favoriteRepository from "@/features/favorites/favorite.repository";
import type { FavoritesDTO, FollowedCategoryDTO } from "@/features/favorites/favorite.types";
import { getPublishedThemeCardById, listPublishedThemeCardsByIds } from "@/features/themes/theme.service";

type ListFavoriteRowsInput = {
  targetType: FavoriteTargetType;
  targetId: string;
  afterId: string | null;
  limit: number;
};

// The next favorite rows of a theme or category after `afterId` (all when null), `_id` ascending.
// `rowId` is the favorite's `_id`: the cursor of a notification job.
export async function listFavoriteRowsAfter(
  input: ListFavoriteRowsInput,
): Promise<{ rowId: string; userId: string }[]> {
  const rows = await favoriteRepository.findFavoriteRowsAfter(input);
  return rows.map((row) => ({ rowId: row._id.toString(), userId: row.userId.toString() }));
}

// A favorite needs only a logged-in user. The theme must be published.
export async function favoriteTheme(userId: string, themeId: string): Promise<void> {
  const theme = await getPublishedThemeCardById(themeId);
  if (!theme) throw new AppError("NOT_FOUND", "This theme is not available.");
  await favoriteRepository.insertFavoriteIfMissing(userId, "theme", themeId);
}

// Removes a favorite theme. No theme check: a theme unpublished later must still be removable.
export async function unfavoriteTheme(userId: string, themeId: string): Promise<void> {
  await favoriteRepository.deleteFavorite(userId, "theme", themeId);
}

// Follows a category that exists.
export async function followCategory(userId: string, categoryId: string): Promise<void> {
  const category = await getCategoryById(categoryId);
  if (!category) throw new AppError("NOT_FOUND", "Category not found.");
  await favoriteRepository.insertFavoriteIfMissing(userId, "category", categoryId);
}

export async function unfollowCategory(userId: string, categoryId: string): Promise<void> {
  await favoriteRepository.deleteFavorite(userId, "category", categoryId);
}

async function listFollowedCategories(userId: string): Promise<FollowedCategoryDTO[]> {
  const rows = await favoriteRepository.listFavoritesByUser(userId, "category");
  const categories = await Promise.all(rows.map((row) => getCategoryById(row.targetId.toString())));
  return categories.flatMap((category) =>
    category ? [{ id: category.id, name: category.name, slug: category.slug }] : [],
  );
}

// The customer's favorite themes (published only) and followed categories, most recently added first.
export async function listFavorites(userId: string): Promise<FavoritesDTO> {
  const themeRows = await favoriteRepository.listFavoritesByUser(userId, "theme");
  const [themes, categories] = await Promise.all([
    listPublishedThemeCardsByIds(themeRows.map((row) => row.targetId.toString())),
    listFollowedCategories(userId),
  ]);
  return { themes, categories };
}

export async function isThemeFavorite(userId: string, themeId: string): Promise<boolean> {
  return favoriteRepository.existsFavorite(userId, "theme", themeId);
}

export async function isCategoryFollowed(userId: string, categoryId: string): Promise<boolean> {
  return favoriteRepository.existsFavorite(userId, "category", categoryId);
}

// Used by the category service when a category is deleted (docs/03-data-model.md section 4).
export async function deleteFavoritesForCategory(categoryId: string): Promise<void> {
  await favoriteRepository.deleteFavoritesByTarget("category", categoryId);
}
