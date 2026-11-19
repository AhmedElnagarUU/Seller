import { env } from "@/shared/config/env";
import { parseObjectId } from "@/shared/db/ids";
import { withTransaction } from "@/shared/db/transaction";
import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import { isCountryCode } from "@/shared/lib/countries";
import * as activityService from "@/features/activity/activity.service";
import { countActiveOwnershipsByUser } from "@/features/ownerships/ownership.service";
import { CUSTOMERS_PER_PAGE, CUSTOMER_MESSAGES, type CustomerStatusFilter } from "@/features/users/user.constants";
import { toCustomerListItemDTO } from "@/features/users/user.mapper";
import type { UserRecord } from "@/features/users/user.model";
import * as userRepository from "@/features/users/user.repository";
import type { CustomerPageDTO, NotificationUserDTO, UserSummary } from "@/features/users/user.types";

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

// One page of customers (admins too), newest joined first. `ownedCount` counts active ownerships only.
export async function listCustomers(input: {
  q: string;
  status: CustomerStatusFilter | undefined;
  page: number;
}): Promise<CustomerPageDTO> {
  const page = Math.max(1, input.page);
  const query = { q: input.q.trim(), status: input.status };
  const [users, total] = await Promise.all([
    userRepository.findUsers(query, page, CUSTOMERS_PER_PAGE),
    userRepository.countUsers(query),
  ]);
  const ownedCounts = await countActiveOwnershipsByUser(users.map((user) => user._id.toString()));
  return {
    items: users.map((user) => toCustomerListItemDTO(user, ownedCounts.get(user._id.toString()) ?? 0)),
    page,
    totalPages: Math.ceil(total / CUSTOMERS_PER_PAGE),
    total,
  };
}

// Finds a customer by email (ignoring case and spaces), or null.
export async function findCustomerByEmail(email: string): Promise<{ id: string } | null> {
  const id = await getUserIdByEmail(email);
  return id ? { id } : null;
}

// The user, or NOT_FOUND for an unknown or invalid id.
async function getExistingUser(userId: string): Promise<UserRecord> {
  const user = parseObjectId(userId) ? await userRepository.findUserById(userId) : null;
  if (!user) throw new AppError("NOT_FOUND", CUSTOMER_MESSAGES.notFound);
  return user;
}

// Disables an account (D-120): it cannot log in, its sessions are deleted, its data stays.
export async function disableUser(userId: string, reason: string, adminUserId: string): Promise<void> {
  const user = await getExistingUser(userId);
  if (user._id.toString() === adminUserId) throw new AppError("FORBIDDEN", CUSTOMER_MESSAGES.ownAccount);
  if (user.disabled) throw new AppError("CONFLICT", CUSTOMER_MESSAGES.alreadyDisabled);
  await withTransaction(async (session) => {
    await userRepository.setUserDisabled(userId, reason, now(), session);
    await userRepository.deleteSessionsOfUser(userId, session);
    await activityService.log(
      {
        action: "account_disabled",
        actorRole: "admin",
        actorUserId: adminUserId,
        subjectUserId: userId,
        targetType: "user",
        targetId: userId,
        summary: `Account disabled: ${user.email}`,
      },
      session,
    );
  });
}

// Enables a disabled account again.
export async function enableUser(userId: string, adminUserId: string): Promise<void> {
  const user = await getExistingUser(userId);
  if (!user.disabled) throw new AppError("CONFLICT", CUSTOMER_MESSAGES.notDisabled);
  await withTransaction(async (session) => {
    await userRepository.setUserEnabled(userId, session);
    await activityService.log(
      {
        action: "account_enabled",
        actorRole: "admin",
        actorUserId: adminUserId,
        subjectUserId: userId,
        targetType: "user",
        targetId: userId,
        summary: `Account enabled: ${user.email}`,
      },
      session,
    );
  });
}
