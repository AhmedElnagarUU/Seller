import clsx from "clsx";

type InlineGap = "xs" | "sm" | "md" | "lg" | "xl";
type InlineAlign = "start" | "center" | "end";
type InlineJustify = "start" | "between" | "end" | "center";

type InlineProps = {
  gap?: InlineGap;
  align?: InlineAlign;
  justify?: InlineJustify;
  wrap?: boolean;
  children: React.ReactNode;
};

const GAP_CLASSES: Record<InlineGap, string> = {
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-10",
};

const ALIGN_CLASSES: Record<InlineAlign, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
};

const JUSTIFY_CLASSES: Record<InlineJustify, string> = {
  start: "justify-start",
  between: "justify-between",
  end: "justify-end",
  center: "justify-center",
};

export function Inline({ gap = "md", align = "center", justify = "start", wrap = false, children }: InlineProps) {
  return (
    <div
      className={clsx("flex", GAP_CLASSES[gap], ALIGN_CLASSES[align], JUSTIFY_CLASSES[justify], wrap && "flex-wrap")}
    >
      {children}
    </div>
  );
}
