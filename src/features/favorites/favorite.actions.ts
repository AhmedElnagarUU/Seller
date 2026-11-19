"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readText } from "@/shared/lib/form-data";
import { requireUser } from "@/features/auth/session";
import { favoriteTargetSchema } from "@/features/favorites/favorite.schemas";
import {
  favoriteTheme,
  followCategory,
  unfavoriteTheme,
  unfollowCategory,
} from "@/features/favorites/favorite.service";

type FavoriteChange = (userId: string, targetId: string) => Promise<void>;

// The steps every favorite action shares (docs/02-architecture.md section 5.5).
async function runFavoriteChange(
  formData: FormData,
  actionName: string,
  change: FavoriteChange,
): Promise<ActionResult> {
  const user = await requireUser("/account/favorites");
  const parsed = favoriteTargetSchema.safeParse({ targetId: readText(formData, "targetId") });
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await change(user.id, parsed.data.targetId);
  } catch (error) {
    return failureFrom(error, actionName, {});
  }
  revalidatePath("/account/favorites");
  revalidatePath("/themes/[slug]", "page");
  revalidatePath("/categories/[slug]", "page");
  return { ok: true, data: undefined };
}

export async function favoriteThemeAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runFavoriteChange(formData, "favoriteThemeAction", favoriteTheme);
}

export async function unfavoriteThemeAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runFavoriteChange(formData, "unfavoriteThemeAction", unfavoriteTheme);
}

export async function followCategoryAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runFavoriteChange(formData, "followCategoryAction", followCategory);
}

export async function unfollowCategoryAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runFavoriteChange(formData, "unfollowCategoryAction", unfollowCategory);
}
