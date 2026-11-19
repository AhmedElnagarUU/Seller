import type { Metadata } from "next";
import { Inline } from "@/shared/layout/Inline";
import { AccountMenu } from "@/features/auth/components/AccountMenu";
import { getCurrentUser } from "@/features/auth/session";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { countUnreadNotifications } from "@/features/notifications/notification.service";
import { StoreFooter } from "@/shared/layout/StoreFooter";
import { StoreHeader } from "@/shared/layout/StoreHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Theme Store",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unreadCount = user ? await countUnreadNotifications(user.id) : 0;
  return (
    <html lang="en">
      <body className="bg-background text-text flex min-h-screen flex-col font-sans antialiased">
        <StoreHeader
          accountSlot={
            <Inline>
              {user ? <NotificationBell unreadCount={unreadCount} /> : null}
              <AccountMenu user={user} />
            </Inline>
          }
        />
        <main className="flex-1">{children}</main>
        <StoreFooter />
      </body>
    </html>
  );
}
