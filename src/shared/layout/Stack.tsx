import clsx from "clsx";

type StackGap = "xs" | "sm" | "md" | "lg" | "xl";
type StackAlign = "start" | "center" | "stretch";

type StackProps = {
  gap?: StackGap;
  align?: StackAlign;
  children: React.ReactNode;
};

const GAP_CLASSES: Record<StackGap, string> = {
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-10",
};

const ALIGN_CLASSES: Record<StackAlign, string> = {
  start: "items-start",
  center: "items-center",
  stretch: "items-stretch",
};

export function Stack({ gap = "md", align = "stretch", children }: StackProps) {
  return <div className={clsx("flex flex-col", GAP_CLASSES[gap], ALIGN_CLASSES[align])}>{children}</div>;
}
