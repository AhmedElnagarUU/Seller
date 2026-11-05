import clsx from "clsx";

type AlertTone = "info" | "success" | "warning" | "danger";

type AlertProps = {
  tone: AlertTone;
  title?: string;
  children: React.ReactNode;
};

const TONE_CLASSES: Record<AlertTone, string> = {
  info: "border-focus text-text bg-surface",
  success: "border-success text-success bg-surface",
  warning: "border-warning text-warning bg-surface",
  danger: "border-danger text-danger bg-surface",
};

export function Alert({ tone, title, children }: AlertProps) {
  const role = tone === "danger" || tone === "warning" ? "alert" : "status";
  return (
    <div role={role} className={clsx("rounded-md border p-4 text-sm", TONE_CLASSES[tone])}>
      {title ? <p className="font-bold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}
