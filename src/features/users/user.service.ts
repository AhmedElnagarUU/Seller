import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors";
import { isCountryCode } from "@/shared/lib/countries";
import * as userRepository from "@/features/users/user.repository";

// Saves the user's country. Throws INVALID for an unknown code.
export async function setUserCountry(userId: string, country: string): Promise<void> {
  if (!isCountryCode(country)) throw new AppError("INVALID", "Please choose your country.");
  await userRepository.setUserCountry(userId, country);
}

// True when the user is disabled (D-120). An unknown user counts as not disabled.
export async function isUserDisabled(userId: string): Promise<boolean> {
  return userRepository.isUserDisabledById(userId);
}

// True when the email is in ADMIN_EMAILS (D-024). Case-insensitive.
export function isAdminEmail(email: string): boolean {
  return env.ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// Finds the id of the user with this email (ignoring case and spaces around it), or null.
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const user = await userRepository.findUserByEmail(email.trim().toLowerCase());
  return user ? user._id.toString() : null;
}

// Maps user id → name. Unknown and invalid ids are missing from the map.
export async function getUserNames(userIds: string[]): Promise<Map<string, string>> {
  const users = await userRepository.findUsersByIds(userIds);
  return new Map(users.map((user) => [user._id.toString(), user.name]));
}
