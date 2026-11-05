import clsx from "clsx";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

type BadgeProps = {
  tone?: BadgeTone;
  children: React.ReactNode;
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-surface text-text-muted border-border",
  primary: "bg-primary text-primary-foreground border-primary",
  success: "bg-surface text-success border-success",
  warning: "bg-surface text-warning border-warning",
  danger: "bg-surface text-danger border-danger",
};

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span className={clsx("inline-block rounded-md border px-2 py-0.5 text-xs font-medium", TONE_CLASSES[tone])}>
      {children}
    </span>
  );
}
