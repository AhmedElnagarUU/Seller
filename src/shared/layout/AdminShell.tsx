import { Badge } from "@/shared/ui/Badge";
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
  // Number next to a menu link. The key is the `href` of the link; a count of 0 shows nothing.
  badges?: Record<string, number>;
  children: React.ReactNode;
};

// Frame of every admin page: the menu on the side (on top on small screens) and the page next to it.
export function AdminShell({ badges = {}, children }: AdminShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <nav aria-label="Admin" className="flex flex-wrap gap-x-4 gap-y-2 lg:w-48 lg:shrink-0 lg:flex-col">
        {ADMIN_LINKS.map((link) => (
          <span key={link.href} className="flex items-center gap-2">
            <TextLink href={link.href}>{link.label}</TextLink>
            {(badges[link.href] ?? 0) > 0 ? <Badge tone="warning">{badges[link.href]}</Badge> : null}
          </span>
        ))}
        <TextLink href="/" tone="muted">
          View store
        </TextLink>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
