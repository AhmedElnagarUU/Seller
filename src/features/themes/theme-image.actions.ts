"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import type { PresignedUpload } from "@/shared/storage/s3";
import { requireAdmin } from "@/features/auth/session";
import {
  addThemeImageSchema,
  createImageUploadUrlSchema,
  removeThemeImageSchema,
  reorderThemeImagesSchema,
  updateThemeImageAltSchema,
} from "@/features/themes/theme-image.schemas";
import {
  addThemeImage,
  createImageUploadUrl,
  removeThemeImage,
  reorderThemeImages,
  updateThemeImageAlt,
} from "@/features/themes/theme-image.service";

// These actions are called from client code (not from a <form>), so they take one unknown argument.

// validationFailure and failureFrom are typed for actions without data. A failure has the same shape for
// every data type, so this only narrows the type (docs/QUESTIONS.md Q-009).
function asUploadFailure(result: ActionResult): ActionResult<PresignedUpload> {
  if (result.ok) throw new Error("Expected a failed action result.");
  return result;
}

function revalidateImagePages(): void {
  revalidatePath("/admin/themes/[id]", "page");
  revalidatePath("/themes/[slug]", "page");
  revalidatePath("/themes");
  revalidatePath("/");
}

export async function createImageUploadUrlAction(input: unknown): Promise<ActionResult<PresignedUpload>> {
  await requireAdmin();
  const parsed = createImageUploadUrlSchema.safeParse(input);
  if (!parsed.success) return asUploadFailure(validationFailure(parsed.error, {}));
  let upload: PresignedUpload;
  try {
    upload = await createImageUploadUrl(parsed.data);
  } catch (error) {
    return asUploadFailure(failureFrom(error, "createImageUploadUrlAction", {}));
  }
  revalidateImagePages();
  return { ok: true, data: upload };
}

export async function addThemeImageAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = addThemeImageSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await addThemeImage(parsed.data);
  } catch (error) {
    return failureFrom(error, "addThemeImageAction", {});
  }
  revalidateImagePages();
  return { ok: true, data: undefined };
}

export async function removeThemeImageAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = removeThemeImageSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await removeThemeImage(parsed.data);
  } catch (error) {
    return failureFrom(error, "removeThemeImageAction", {});
  }
  revalidateImagePages();
  return { ok: true, data: undefined };
}

export async function reorderThemeImagesAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = reorderThemeImagesSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await reorderThemeImages(parsed.data);
  } catch (error) {
    return failureFrom(error, "reorderThemeImagesAction", {});
  }
  revalidateImagePages();
  return { ok: true, data: undefined };
}

export async function updateThemeImageAltAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateThemeImageAltSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await updateThemeImageAlt(parsed.data);
  } catch (error) {
    return failureFrom(error, "updateThemeImageAltAction", {});
  }
  revalidateImagePages();
  return { ok: true, data: undefined };
}
