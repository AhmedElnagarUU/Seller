"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import type { PresignedUpload } from "@/shared/storage/s3";
import { requireAdmin } from "@/features/auth/session";
import {
  createVersionSchema,
  createZipUploadUrlSchema,
  updateVersionChangesSchema,
} from "@/features/versions/version.schemas";
import { createVersion, createZipUploadUrl, updateVersionChanges } from "@/features/versions/version.service";

// These actions are called from client code (not from a <form>), so they take one unknown argument.

// validationFailure and failureFrom are typed for actions without data. A failure has the same shape for
// every data type, so this only narrows the type (docs/QUESTIONS.md Q-009).
function asUploadFailure(result: ActionResult): ActionResult<PresignedUpload> {
  if (result.ok) throw new Error("Expected a failed action result.");
  return result;
}

export async function createZipUploadUrlAction(input: unknown): Promise<ActionResult<PresignedUpload>> {
  await requireAdmin();
  const parsed = createZipUploadUrlSchema.safeParse(input);
  if (!parsed.success) return asUploadFailure(validationFailure(parsed.error, {}));
  try {
    const upload = await createZipUploadUrl(parsed.data);
    return { ok: true, data: upload };
  } catch (error) {
    return asUploadFailure(failureFrom(error, "createZipUploadUrlAction", {}));
  }
}

export async function createVersionAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = createVersionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await createVersion(parsed.data, admin.id);
  } catch (error) {
    return failureFrom(error, "createVersionAction", {});
  }
  revalidatePath("/admin/themes/[id]", "page");
  revalidatePath("/admin/themes/[id]/versions", "page");
  revalidatePath("/themes/[slug]", "page");
  revalidatePath("/account/themes");
  const notified = parsed.data.notify ? "&notified=1" : "";
  redirect(`/admin/themes/${parsed.data.themeId}/versions?released=${parsed.data.version}${notified}`);
}

export async function updateVersionChangesAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateVersionChangesSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await updateVersionChanges(parsed.data);
  } catch (error) {
    return failureFrom(error, "updateVersionChangesAction", {});
  }
  revalidatePath("/admin/themes/[id]/versions", "page");
  revalidatePath("/themes/[slug]", "page");
  return { ok: true, data: undefined, message: "Saved." };
}
