import { z } from "zod";
import { isCountryCode } from "@/shared/lib/countries";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";

export const profileSchema = z.object({
  name: z.string().trim().min(2, AUTH_MESSAGES.invalidName).max(80, AUTH_MESSAGES.invalidName),
  country: z.string().refine((value): boolean => isCountryCode(value), AUTH_MESSAGES.invalidCountry),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, AUTH_MESSAGES.wrongCurrentPassword).max(128, AUTH_MESSAGES.wrongCurrentPassword),
    newPassword: z.string().min(8, AUTH_MESSAGES.invalidPassword).max(128, AUTH_MESSAGES.invalidPassword),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: AUTH_MESSAGES.passwordsDiffer,
  });

export const emailPreferencesSchema = z.object({
  emailOwnedThemeUpdates: z.boolean(),
  emailFavoriteThemeUpdates: z.boolean(),
  emailFollowedCategoryThemes: z.boolean(),
  emailAnnouncements: z.boolean(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type EmailPreferencesInput = z.infer<typeof emailPreferencesSchema>;
