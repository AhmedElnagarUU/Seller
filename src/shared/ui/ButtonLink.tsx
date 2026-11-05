import Link from "next/link";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/shared/ui/buttonClasses";

type ButtonLinkProps = {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
};

export function ButtonLink({ href, variant = "primary", size = "md", fullWidth = false, children }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth })}>
      {children}
    </Link>
  );
}
