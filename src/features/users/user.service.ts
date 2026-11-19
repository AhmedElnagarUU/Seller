import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors";
import { isCountryCode } from "@/shared/lib/countries";
import * as userRepository from "@/features/users/user.repository";
import type { NotificationUserDTO, UserSummary } from "@/features/users/user.types";

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

// The id, name, email and country of a user, or null for an unknown or invalid id.
export async function getUserSummary(userId: string): Promise<UserSummary | null> {
  const user = await userRepository.findUserSummaryById(userId);
  if (!user) return null;
  return { id: user._id.toString(), name: user.name, email: user.email, country: user.country ?? null };
}

// The summaries of the users that exist. Invalid and unknown ids are skipped. One query.
export async function getUserSummaries(userIds: string[]): Promise<UserSummary[]> {
  const users = await userRepository.findUserSummariesByIds(userIds);
  return users.map((user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    country: user.country ?? null,
  }));
}

// The notification data of the users that exist. Invalid and unknown ids are skipped. One query.
export async function getUsersForNotification(userIds: string[]): Promise<NotificationUserDTO[]> {
  const users = await userRepository.findNotificationUsersByIds(userIds);
  return users.map((user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    disabled: user.disabled,
    emailOwnedThemeUpdates: user.emailOwnedThemeUpdates,
    emailFavoriteThemeUpdates: user.emailFavoriteThemeUpdates,
    emailFollowedCategoryThemes: user.emailFollowedCategoryThemes,
    emailAnnouncements: user.emailAnnouncements,
  }));
}

// The next users that are not disabled after `afterId` (all when null), `_id` ascending.
// `rowId` and `userId` are both the user `_id`.
export async function listCustomerRowsAfter(input: {
  afterId: string | null;
  limit: number;
}): Promise<{ rowId: string; userId: string }[]> {
  const rows = await userRepository.findEnabledUserIdsAfter(input);
  return rows.map((row) => ({ rowId: row._id.toString(), userId: row._id.toString() }));
}
