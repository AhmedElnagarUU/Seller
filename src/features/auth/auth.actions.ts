"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readText } from "@/shared/lib/form-data";
import { safeNextPath } from "@/shared/lib/paths";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/features/auth/auth.schemas";
import {
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resendVerificationEmail,
  resetPassword,
} from "@/features/auth/auth.service";
import { requireUser } from "@/features/auth/session";

export async function registerAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const values = {
    name: readText(formData, "name"),
    email: readText(formData, "email"),
    country: readText(formData, "country"),
  };
  const parsed = registerSchema.safeParse({ ...values, password: readText(formData, "password") });
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await registerUser(parsed.data, await headers());
  } catch (error) {
    return failureFrom(error, "registerAction", values);
  }
  redirect("/verify-email");
}

export async function loginAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const values = { email: readText(formData, "email") };
  const parsed = loginSchema.safeParse({ ...values, password: readText(formData, "password") });
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await loginUser(parsed.data, await headers());
  } catch (error) {
    return failureFrom(error, "loginAction", values);
  }
  redirect(safeNextPath(readText(formData, "next")));
}

export async function logoutAction(): Promise<void> {
  await logoutUser(await headers());
  redirect("/");
}

export async function forgotPasswordAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const values = { email: readText(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  await requestPasswordReset(parsed.data.email, await headers());
  return { ok: true, data: undefined, message: AUTH_MESSAGES.resetEmailSent };
}

export async function resetPasswordAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: readText(formData, "token"),
    password: readText(formData, "password"),
    confirmPassword: readText(formData, "confirmPassword"),
  });
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await resetPassword(parsed.data.token, parsed.data.password, await headers());
  } catch (error) {
    return failureFrom(error, "resetPasswordAction", {});
  }
  redirect("/login?reset=1");
}

export async function resendVerificationAction(): Promise<ActionResult> {
  const user = await requireUser("/verify-email");
  try {
    await resendVerificationEmail(user.email, await headers());
  } catch (error) {
    return failureFrom(error, "resendVerificationAction", {});
  }
  return { ok: true, data: undefined, message: AUTH_MESSAGES.verificationSent };
}
