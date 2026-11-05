import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

type ButtonClassesInput = {
  variant: ButtonVariant;
  size: ButtonSize;
  fullWidth: boolean;
};

const BASE_CLASSES =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-background text-text border border-border hover:bg-surface",
  ghost: "bg-transparent text-text hover:bg-surface",
  danger: "bg-danger text-primary-foreground hover:opacity-90",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
};

export function buttonClasses({ variant, size, fullWidth }: ButtonClassesInput): string {
  return clsx(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], fullWidth && "w-full");
}
