"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TextLink } from "@/shared/ui/TextLink";

const ACCOUNT_LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/themes", label: "My themes" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/favorites", label: "Favorites" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/feedback", label: "Feedback" },
  { href: "/account/settings", label: "Settings" },
];

const LINK_CLASSES =
  "rounded-sm whitespace-nowrap hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

type AccountNavProps = {
  isAdmin: boolean;
};

// The menu of the account pages. The current page is highlighted.
export function AccountNav({ isAdmin }: AccountNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Account"
      className="flex gap-4 overflow-x-auto lg:w-48 lg:shrink-0 lg:flex-col lg:overflow-visible"
    >
      {ACCOUNT_LINKS.map((link) => {
        const isCurrent = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isCurrent ? "page" : undefined}
            className={clsx(LINK_CLASSES, isCurrent ? "text-primary font-bold" : "text-text-muted hover:text-text")}
          >
            {link.label}
          </Link>
        );
      })}
      {isAdmin ? <TextLink href="/admin">Admin panel</TextLink> : null}
    </nav>
  );
}
