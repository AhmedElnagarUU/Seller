import clsx from "clsx";
import Link from "next/link";

type TextLinkTone = "primary" | "muted";

type TextLinkProps = {
  href: string;
  children: React.ReactNode;
  tone?: TextLinkTone;
};

const BASE_CLASSES =
  "rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const TONE_CLASSES: Record<TextLinkTone, string> = {
  primary: "text-primary",
  muted: "text-text-muted hover:text-text",
};

export function TextLink({ href, children, tone = "primary" }: TextLinkProps) {
  return (
    <Link href={href} className={clsx(BASE_CLASSES, TONE_CLASSES[tone])}>
      {children}
    </Link>
  );
}
