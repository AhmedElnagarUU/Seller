"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readCheckbox, readLines, readText } from "@/shared/lib/form-data";
import { requireAdmin } from "@/features/auth/session";
import { themeInputSchema } from "@/features/themes/theme.schemas";
import { createTheme, updateTheme } from "@/features/themes/theme.service";

// The text of every field as typed. It is sent back to the form after an error.
function readThemeValues(formData: FormData): Record<string, string> {
  return {
    name: readText(formData, "name"),
    slug: readText(formData, "slug"),
    tagline: readText(formData, "tagline"),
    description: readText(formData, "description"),
    features: readText(formData, "features"),
    categoryId: readText(formData, "categoryId"),
    price: readText(formData, "price"),
    demoUrl: readText(formData, "demoUrl"),
    wordpressMin: readText(formData, "wordpressMin"),
    phpMin: readText(formData, "phpMin"),
    testedUpTo: readText(formData, "testedUpTo"),
    featured: readCheckbox(formData, "featured") ? "on" : "",
  };
}

function readThemeForm(formData: FormData) {
  return {
    ...readThemeValues(formData),
    features: readLines(formData, "features"),
    featured: readCheckbox(formData, "featured"),
  };
}

function revalidateThemePages(): void {
  revalidatePath("/");
  revalidatePath("/themes");
  revalidatePath("/admin/themes");
  revalidatePath("/admin/categories");
  revalidatePath("/themes/[slug]", "page");
  revalidatePath("/categories/[slug]", "page");
}

export async function createThemeAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = themeInputSchema.safeParse(readThemeForm(formData));
  if (!parsed.success) return validationFailure(parsed.error, readThemeValues(formData));
  let themeId: string;
  try {
    ({ id: themeId } = await createTheme(parsed.data));
  } catch (error) {
    return failureFrom(error, "createThemeAction", readThemeValues(formData));
  }
  revalidateThemePages();
  redirect(`/admin/themes/${themeId}?created=1`);
}

export async function updateThemeAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = themeInputSchema.safeParse(readThemeForm(formData));
  if (!parsed.success) return validationFailure(parsed.error, readThemeValues(formData));
  try {
    await updateTheme(readText(formData, "id"), parsed.data);
  } catch (error) {
    return failureFrom(error, "updateThemeAction", readThemeValues(formData));
  }
  revalidateThemePages();
  return { ok: true, data: undefined, message: "Saved." };
}
