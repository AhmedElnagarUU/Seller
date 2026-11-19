import { parseObjectId } from "@/shared/db/ids";
import { changeUserPassword, updateUserName } from "@/features/auth/auth.service";
import { listNotifications, countUnreadNotifications } from "@/features/notifications/notification.service";
import { countActiveOwnershipsByUser } from "@/features/ownerships/ownership.service";
import { listBestSellingThemes } from "@/features/themes/theme.service";
import type { ChangePasswordInput, EmailPreferencesInput, ProfileInput } from "@/features/users/account.schemas";
import type { AccountOverviewDTO, AccountSettingsDTO } from "@/features/users/account.types";
import * as userRepository from "@/features/users/user.repository";
import { setUserCountry } from "@/features/users/user.service";
import { listWalletPaymentsForUser } from "@/features/wallet-payments/wallet-payment.service";

const LATEST_NOTIFICATIONS = 5;
const BEST_SELLERS = 4;

// The number of wallet requests that still wait for the customer or for the admin. null when not in Egypt.
async function countOpenWalletPayments(userId: string): Promise<number | null> {
  const user = await userRepository.findUserById(userId);
  if (user?.country !== "EG") return null;
  const payments = await listWalletPaymentsForUser(userId);
  return payments.filter((payment) => payment.status === "awaiting_payment" || payment.status === "submitted").length;
}

// Everything /account shows. The reads are independent, so they run together.
export async function getAccountOverview(userId: string): Promise<AccountOverviewDTO> {
  const [ownedCounts, unreadCount, notificationPage, bestSellers, openWalletPayments] = await Promise.all([
    countActiveOwnershipsByUser([userId]),
    countUnreadNotifications(userId),
    listNotifications(userId, 1),
    listBestSellingThemes(BEST_SELLERS),
    countOpenWalletPayments(userId),
  ]);
  return {
    ownedCount: ownedCounts.get(userId) ?? 0,
    unreadCount,
    latestNotifications: notificationPage.items.slice(0, LATEST_NOTIFICATIONS),
    bestSellers,
    openWalletPayments,
  };
}

// What /account/settings shows, or null for an unknown user.
export async function getAccountSettings(userId: string): Promise<AccountSettingsDTO | null> {
  if (!parseObjectId(userId)) return null;
  const user = await userRepository.findUserById(userId);
  if (!user) return null;
  return {
    name: user.name,
    email: user.email,
    country: user.country ?? null,
    hasPassword: await userRepository.hasCredentialAccount(userId),
    emailOwnedThemeUpdates: user.emailOwnedThemeUpdates,
    emailFavoriteThemeUpdates: user.emailFavoriteThemeUpdates,
    emailFollowedCategoryThemes: user.emailFollowedCategoryThemes,
    emailAnnouncements: user.emailAnnouncements,
  };
}

// Saves the country first (an unknown code writes nothing), then the name through Better Auth.
export async function updateProfile(userId: string, input: ProfileInput, headers: Headers): Promise<void> {
  await setUserCountry(userId, input.country);
  await updateUserName(input.name, headers);
}

export async function changePassword(input: ChangePasswordInput, headers: Headers): Promise<void> {
  await changeUserPassword({ currentPassword: input.currentPassword, newPassword: input.newPassword }, headers);
}

export async function updateEmailPreferences(userId: string, input: EmailPreferencesInput): Promise<void> {
  await userRepository.setEmailPreferences(userId, input);
}
