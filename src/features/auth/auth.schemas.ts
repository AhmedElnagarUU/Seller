import { z } from "zod";
import { isCountryCode } from "@/shared/lib/countries";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";

const emailField = z.string().trim().toLowerCase().pipe(z.email(AUTH_MESSAGES.invalidEmail));
const newPasswordField = z.string().min(8, AUTH_MESSAGES.invalidPassword).max(128, AUTH_MESSAGES.invalidPassword);

export const registerSchema = z.object({
  name: z.string().trim().min(2, AUTH_MESSAGES.invalidName).max(80, AUTH_MESSAGES.invalidName),
  email: emailField,
  password: newPasswordField,
  country: z.string().refine((value): boolean => isCountryCode(value), AUTH_MESSAGES.invalidCountry),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, AUTH_MESSAGES.wrongCredentials).max(128, AUTH_MESSAGES.wrongCredentials),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: AUTH_MESSAGES.passwordsDiffer,
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
