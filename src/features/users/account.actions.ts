"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readCheckbox, readText } from "@/shared/lib/form-data";
import { requireUser } from "@/features/auth/session";
import { ACCOUNT_MESSAGES } from "@/features/users/account.messages";
import { changePasswordSchema, emailPreferencesSchema, profileSchema } from "@/features/users/account.schemas";
import { changePassword, updateEmailPreferences, updateProfile } from "@/features/users/account.service";

function revalidateAccountPages(): void {
  revalidatePath("/account/settings");
  revalidatePath("/account");
}

export async function updateProfileAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser("/account/settings");
  const values = { name: readText(formData, "name"), country: readText(formData, "country") };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await updateProfile(user.id, parsed.data, await headers());
  } catch (error) {
    return failureFrom(error, "updateProfileAction", values);
  }
  revalidateAccountPages();
  return { ok: true, data: undefined, message: ACCOUNT_MESSAGES.saved };
}

// Passwords are never sent back: the values of every result are empty.
export async function changePasswordAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireUser("/account/settings");
  const parsed = changePasswordSchema.safeParse({
    currentPassword: readText(formData, "currentPassword"),
    newPassword: readText(formData, "newPassword"),
    confirmPassword: readText(formData, "confirmPassword"),
  });
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await changePassword(parsed.data, await headers());
  } catch (error) {
    return failureFrom(error, "changePasswordAction", {});
  }
  revalidateAccountPages();
  return { ok: true, data: undefined, message: ACCOUNT_MESSAGES.passwordChanged };
}

export async function updateEmailPreferencesAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/account/settings");
  const parsed = emailPreferencesSchema.safeParse({
    emailOwnedThemeUpdates: readCheckbox(formData, "emailOwnedThemeUpdates"),
    emailFavoriteThemeUpdates: readCheckbox(formData, "emailFavoriteThemeUpdates"),
    emailFollowedCategoryThemes: readCheckbox(formData, "emailFollowedCategoryThemes"),
    emailAnnouncements: readCheckbox(formData, "emailAnnouncements"),
  });
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await updateEmailPreferences(user.id, parsed.data);
  } catch (error) {
    return failureFrom(error, "updateEmailPreferencesAction", {});
  }
  revalidateAccountPages();
  return { ok: true, data: undefined, message: ACCOUNT_MESSAGES.saved };
}
