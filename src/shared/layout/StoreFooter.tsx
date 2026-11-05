import { now } from "@/shared/lib/clock";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund-policy", label: "Refund policy" },
  { href: "/license", label: "License" },
];

export function StoreFooter() {
  return (
    <footer className="border-border bg-surface border-t">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <TextLink key={link.href} href={link.href} tone="muted">
              {link.label}
            </TextLink>
          ))}
        </nav>
        <Text size="sm" tone="muted">
          © {now().getFullYear()} Theme Store
        </Text>
      </div>
    </footer>
  );
}
