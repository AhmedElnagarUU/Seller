import clsx from "clsx";

type GridColumns = 2 | 3 | 4;
type GridGap = "xs" | "sm" | "md" | "lg" | "xl";

type GridProps = {
  columns: GridColumns;
  gap?: GridGap;
  children: React.ReactNode;
};

const COLUMN_CLASSES: Record<GridColumns, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

const GAP_CLASSES: Record<GridGap, string> = {
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-10",
};

export function Grid({ columns, gap = "md", children }: GridProps) {
  return (
    <div className={clsx("grid grid-cols-1 sm:grid-cols-2", COLUMN_CLASSES[columns], GAP_CLASSES[gap])}>{children}</div>
  );
}
