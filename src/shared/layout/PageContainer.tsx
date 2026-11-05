import clsx from "clsx";

type PageContainerWidth = "narrow" | "normal" | "wide";

type PageContainerProps = {
  width?: PageContainerWidth;
  children: React.ReactNode;
};

const WIDTH_CLASSES: Record<PageContainerWidth, string> = {
  narrow: "max-w-md",
  normal: "max-w-5xl",
  wide: "max-w-7xl",
};

export function PageContainer({ width = "normal", children }: PageContainerProps) {
  return <div className={clsx("mx-auto w-full px-4 py-8", WIDTH_CLASSES[width])}>{children}</div>;
}
