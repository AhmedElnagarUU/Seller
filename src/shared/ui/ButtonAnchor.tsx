import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/shared/ui/buttonClasses";

type ButtonAnchorProps = {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
  rel?: string;
};

export function ButtonAnchor({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  children,
  rel,
}: ButtonAnchorProps) {
  return (
    <a href={href} rel={rel} className={buttonClasses({ variant, size, fullWidth })}>
      {children}
    </a>
  );
}
