import { AccountShell } from "@/shared/layout/AccountShell";
import { getCurrentUser } from "@/features/auth/session";
import { countUnreadNotifications } from "@/features/notifications/notification.service";

// Does not guard: every account page guards itself.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unreadNotificationCount = user ? await countUnreadNotifications(user.id) : 0;
  return (
    <AccountShell isAdmin={user?.isAdmin === true} unreadNotificationCount={unreadNotificationCount}>
      {children}
    </AccountShell>
  );
}
