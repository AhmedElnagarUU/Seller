import { AccountNav } from "@/shared/layout/AccountNav";

type AccountShellProps = {
  isAdmin: boolean;
  unreadNotificationCount?: number;
  children: React.ReactNode;
};

// Frame of every account page: the menu on the side (on top on small screens) and the page next to it.
export function AccountShell({ isAdmin, unreadNotificationCount, children }: AccountShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <AccountNav isAdmin={isAdmin} unreadNotificationCount={unreadNotificationCount} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
