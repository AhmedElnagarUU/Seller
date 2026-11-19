import type { NotificationDTO } from "@/features/notifications/notification.types";
import type { ThemeCardDTO } from "@/features/themes/theme.types";

export type AccountOverviewDTO = {
  ownedCount: number; // active ownerships
  unreadCount: number;
  latestNotifications: NotificationDTO[]; // newest first, at most 5
  bestSellers: ThemeCardDTO[]; // at most 4
  openWalletPayments: number | null; // requests awaiting_payment or submitted; null when the country is not "EG"
};

export type AccountSettingsDTO = {
  name: string;
  email: string;
  country: string | null;
  hasPassword: boolean;
  emailOwnedThemeUpdates: boolean;
  emailFavoriteThemeUpdates: boolean;
  emailFollowedCategoryThemes: boolean;
  emailAnnouncements: boolean;
};
