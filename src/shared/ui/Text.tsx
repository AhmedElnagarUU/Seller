import clsx from "clsx";

type TextSize = "sm" | "md" | "lg";
type TextTone = "default" | "muted" | "danger" | "success";
type TextWeight = "normal" | "bold";

type TextProps = {
  as?: "p" | "span";
  size?: TextSize;
  tone?: TextTone;
  weight?: TextWeight;
  children: React.ReactNode;
};

const SIZE_CLASSES: Record<TextSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

const TONE_CLASSES: Record<TextTone, string> = {
  default: "text-text",
  muted: "text-text-muted",
  danger: "text-danger",
  success: "text-success",
};

const WEIGHT_CLASSES: Record<TextWeight, string> = {
  normal: "font-normal",
  bold: "font-bold",
};

export function Text({ as: Tag = "p", size = "md", tone = "default", weight = "normal", children }: TextProps) {
  return <Tag className={clsx(SIZE_CLASSES[size], TONE_CLASSES[tone], WEIGHT_CLASSES[weight])}>{children}</Tag>;
}
