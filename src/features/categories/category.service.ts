import { AppError } from "@/shared/errors";
import {
  toCategoryAdminDTO,
  toCategoryAdminListItemDTO,
  toCategoryDTO,
  toCategoryWithCountDTO,
} from "@/features/categories/category.mapper";
import type { CategoryRecord } from "@/features/categories/category.model";
import * as categoryRepository from "@/features/categories/category.repository";
import type { CategoryInput } from "@/features/categories/category.schemas";
import type {
  CategoryAdminDTO,
  CategoryAdminListItemDTO,
  CategoryDTO,
  CategoryWithCountDTO,
} from "@/features/categories/category.types";
import { countPublishedThemesInCategory, countThemesInCategory } from "@/features/themes/theme.service";

async function assertNameIsFree(name: string, ownId?: string): Promise<void> {
  const isTaken = await categoryRepository.existsCategoryByNameInsensitive(name, ownId);
  if (isTaken) throw new AppError("CONFLICT", "A category with this name already exists.");
}

// Turns a unique-index error (the slug) into the message for the admin. Other errors pass through.
function throwSlugConflict(error: unknown): never {
  if (categoryRepository.isDuplicateKeyError(error)) throw new AppError("CONFLICT", "This slug is already used.");
  throw error;
}

// Creates a category.
export async function createCategory(input: CategoryInput): Promise<{ id: string }> {
  await assertNameIsFree(input.name);
  try {
    const created = await categoryRepository.insertCategory(input);
    return { id: created._id.toString() };
  } catch (error) {
    return throwSlugConflict(error);
  }
}

// Changes a category. Keeping its own name is allowed.
export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  await assertNameIsFree(input.name, id);
  let updated: CategoryRecord | null;
  try {
    updated = await categoryRepository.updateCategoryById(id, input);
  } catch (error) {
    throwSlugConflict(error);
  }
  if (!updated) throw new AppError("NOT_FOUND", "Category not found.");
}

// Deletes a category that has no themes (any status).
export async function deleteCategory(id: string): Promise<void> {
  const category = await categoryRepository.findCategoryById(id);
  if (!category) throw new AppError("NOT_FOUND", "Category not found.");
  if ((await countThemesInCategory(id)) > 0) {
    throw new AppError("CONFLICT", "This category still has themes. Move them to another category first.");
  }
  await categoryRepository.deleteCategoryById(id);
}

// All categories for the admin list, with the number of themes in any status.
export async function listCategoriesForAdmin(): Promise<CategoryAdminListItemDTO[]> {
  const categories = await categoryRepository.listCategories();
  return Promise.all(
    categories.map(async (category) =>
      toCategoryAdminListItemDTO(category, await countThemesInCategory(category._id.toString())),
    ),
  );
}

// All categories for the home page and the filter, with the number of published themes (0 included).
export async function listCategoriesWithPublishedCounts(): Promise<CategoryWithCountDTO[]> {
  const categories = await categoryRepository.listCategories();
  return Promise.all(
    categories.map(async (category) =>
      toCategoryWithCountDTO(category, await countPublishedThemesInCategory(category._id.toString())),
    ),
  );
}

// Finds a category by slug, or null.
export async function getCategoryBySlug(slug: string): Promise<CategoryDTO | null> {
  const category = await categoryRepository.findCategoryBySlug(slug);
  return category ? toCategoryDTO(category) : null;
}

// Finds a category by id for the admin edit page, or null.
export async function getCategoryById(id: string): Promise<CategoryAdminDTO | null> {
  const category = await categoryRepository.findCategoryById(id);
  return category ? toCategoryAdminDTO(category) : null;
}
