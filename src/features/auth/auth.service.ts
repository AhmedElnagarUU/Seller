import { isAPIError } from "better-auth/api";
import { AppError } from "@/shared/errors";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { auth } from "@/features/auth/auth";
import type { LoginInput, RegisterInput } from "@/features/auth/auth.schemas";
import { setUserCountry } from "@/features/users/user.service";

// Exception to the layer rule (T-003): this service calls `auth.api.*`. Better Auth is our auth "repository".

function readErrorCode(error: unknown): string {
  if (!isAPIError(error)) return "";
  const code = error.body?.code;
  return typeof code === "string" ? code : "";
}

function hasStatusCode(error: unknown, statusCode: number): boolean {
  return isAPIError(error) && error.statusCode === statusCode;
}

// Creates the account, saves the country and (through Better Auth) sends the verification email.
export async function registerUser(input: RegisterInput, headers: Headers): Promise<void> {
  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password, callbackURL: "/account" },
      headers,
    });
    userId = result.user.id;
  } catch (error) {
    if (readErrorCode(error).includes("USER_ALREADY_EXISTS")) throw new AppError("CONFLICT", AUTH_MESSAGES.emailTaken);
    console.error("registerUser failed", error);
    throw new AppError("INVALID", AUTH_MESSAGES.generic);
  }
  await setUserCountry(userId, input.country);
}

// Logs the user in and creates a session. Disabled users are refused by the Better Auth session hook.
export async function loginUser(input: LoginInput, headers: Headers): Promise<void> {
  try {
    await auth.api.signInEmail({ body: { email: input.email, password: input.password }, headers });
  } catch (error) {
    if (isAPIError(error) && error.message.includes("ACCOUNT_DISABLED")) {
      throw new AppError("FORBIDDEN", AUTH_MESSAGES.disabled);
    }
    if (hasStatusCode(error, 401)) throw new AppError("INVALID", AUTH_MESSAGES.wrongCredentials);
    if (hasStatusCode(error, 429)) throw new AppError("RATE_LIMITED", AUTH_MESSAGES.tooManyAttempts);
    console.error("loginUser failed", error);
    throw new AppError("INVALID", AUTH_MESSAGES.generic);
  }
}

// Ends the current session. Errors are ignored.
export async function logoutUser(headers: Headers): Promise<void> {
  try {
    await auth.api.signOut({ headers });
  } catch {
    // Nothing to do: the user is logged out either way.
  }
}

// Sends a reset email when the address is known. Always resolves: it never tells if the email exists.
export async function requestPasswordReset(email: string, headers: Headers): Promise<void> {
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers });
  } catch (error) {
    console.error("requestPasswordReset failed", error);
  }
}

// Sets a new password with the token from the reset email.
export async function resetPassword(token: string, newPassword: string, headers: Headers): Promise<void> {
  try {
    await auth.api.resetPassword({ body: { token, newPassword }, headers });
  } catch {
    throw new AppError("INVALID", AUTH_MESSAGES.resetLinkInvalid);
  }
}

// Sends the verification email again.
export async function resendVerificationEmail(email: string, headers: Headers): Promise<void> {
  try {
    await auth.api.sendVerificationEmail({ body: { email, callbackURL: "/account" }, headers });
  } catch (error) {
    if (hasStatusCode(error, 429)) throw new AppError("RATE_LIMITED", AUTH_MESSAGES.tooManyAttempts);
    console.error("resendVerificationEmail failed", error);
    throw new AppError("INVALID", AUTH_MESSAGES.generic);
  }
}
