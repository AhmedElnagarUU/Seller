"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readText } from "@/shared/lib/form-data";
import { requireAdmin } from "@/features/auth/session";
import { categoryInputSchema } from "@/features/categories/category.schemas";
import { createCategory, deleteCategory, updateCategory } from "@/features/categories/category.service";

function readCategoryForm(formData: FormData): Record<string, string> {
  return {
    name: readText(formData, "name"),
    slug: readText(formData, "slug"),
    description: readText(formData, "description"),
    sortOrder: readText(formData, "sortOrder"),
  };
}

function revalidateCategoryPages(): void {
  revalidatePath("/");
  revalidatePath("/themes");
  revalidatePath("/admin/themes");
  revalidatePath("/admin/categories");
  revalidatePath("/categories/[slug]", "page");
}

export async function createCategoryAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const values = readCategoryForm(formData);
  const parsed = categoryInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await createCategory(parsed.data);
  } catch (error) {
    return failureFrom(error, "createCategoryAction", values);
  }
  revalidateCategoryPages();
  redirect("/admin/categories");
}

export async function updateCategoryAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const values = readCategoryForm(formData);
  const parsed = categoryInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await updateCategory(readText(formData, "id"), parsed.data);
  } catch (error) {
    return failureFrom(error, "updateCategoryAction", values);
  }
  revalidateCategoryPages();
  return { ok: true, data: undefined, message: "Saved." };
}

export async function deleteCategoryAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    await deleteCategory(readText(formData, "id"));
  } catch (error) {
    return failureFrom(error, "deleteCategoryAction", {});
  }
  revalidateCategoryPages();
  redirect("/admin/categories");
}
