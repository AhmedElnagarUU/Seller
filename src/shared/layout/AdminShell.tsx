import { TextLink } from "@/shared/ui/TextLink";

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/themes", label: "Themes" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/wallet-payments", label: "Wallet payments" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/settings", label: "Settings" },
];

type AdminShellProps = {
  children: React.ReactNode;
};

// Frame of every admin page: the menu on the side (on top on small screens) and the page next to it.
export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <nav aria-label="Admin" className="flex flex-wrap gap-x-4 gap-y-2 lg:w-48 lg:shrink-0 lg:flex-col">
        {ADMIN_LINKS.map((link) => (
          <TextLink key={link.href} href={link.href}>
            {link.label}
          </TextLink>
        ))}
        <TextLink href="/" tone="muted">
          View store
        </TextLink>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
