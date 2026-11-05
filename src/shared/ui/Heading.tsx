import clsx from "clsx";

type HeadingLevel = 1 | 2 | 3;

type HeadingProps = {
  level: HeadingLevel;
  children: React.ReactNode;
};

const LEVEL_CLASSES: Record<HeadingLevel, string> = {
  1: "text-3xl",
  2: "text-2xl",
  3: "text-lg",
};

export function Heading({ level, children }: HeadingProps) {
  const Tag = `h${level}` as const;
  return <Tag className={clsx("font-heading text-text font-bold", LEVEL_CLASSES[level])}>{children}</Tag>;
}
