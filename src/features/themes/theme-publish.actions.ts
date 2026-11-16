"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom } from "@/shared/lib/action-result";
import { readText } from "@/shared/lib/form-data";
import { requireAdmin } from "@/features/auth/session";
import { THEME_PUBLISH_MESSAGES } from "@/features/themes/theme.constants";
import { publishTheme, unpublishTheme } from "@/features/themes/theme-publish.service";
import { retryThemeSync } from "@/features/themes/theme-sync.service";

function revalidateThemePages(): void {
  revalidatePath("/");
  revalidatePath("/themes");
  revalidatePath("/admin/themes");
  revalidatePath("/admin/themes/[id]", "page");
  revalidatePath("/themes/[slug]", "page");
  revalidatePath("/categories/[slug]", "page");
}

export async function publishThemeAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  try {
    await publishTheme(readText(formData, "id"), user.id);
  } catch (error) {
    return failureFrom(error, "publishThemeAction", {});
  }
  revalidateThemePages();
  return { ok: true, data: undefined, message: THEME_PUBLISH_MESSAGES.published };
}

export async function unpublishThemeAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  try {
    await unpublishTheme(readText(formData, "id"), user.id);
  } catch (error) {
    return failureFrom(error, "unpublishThemeAction", {});
  }
  revalidateThemePages();
  return { ok: true, data: undefined, message: THEME_PUBLISH_MESSAGES.unpublished };
}

export async function syncThemeAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    await retryThemeSync(readText(formData, "id"));
  } catch (error) {
    return failureFrom(error, "syncThemeAction", {});
  }
  revalidateThemePages();
  return { ok: true, data: undefined, message: THEME_PUBLISH_MESSAGES.synced };
}
