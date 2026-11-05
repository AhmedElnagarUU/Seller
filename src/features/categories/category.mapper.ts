import type { CategoryRecord } from "@/features/categories/category.model";
import type {
  CategoryAdminDTO,
  CategoryAdminListItemDTO,
  CategoryDTO,
  CategoryWithCountDTO,
} from "@/features/categories/category.types";

export function toCategoryDTO(category: CategoryRecord): CategoryDTO {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
  };
}

export function toCategoryAdminDTO(category: CategoryRecord): CategoryAdminDTO {
  return { ...toCategoryDTO(category), sortOrder: category.sortOrder };
}

export function toCategoryAdminListItemDTO(category: CategoryRecord, themeCount: number): CategoryAdminListItemDTO {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
    themeCount,
  };
}

export function toCategoryWithCountDTO(category: CategoryRecord, themeCount: number): CategoryWithCountDTO {
  return { name: category.name, slug: category.slug, themeCount };
}
