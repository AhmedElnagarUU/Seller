import clsx from "clsx";

type CardPadding = "md" | "lg";

type CardProps = {
  children: React.ReactNode;
  padding?: CardPadding;
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  md: "p-4",
  lg: "p-6",
};

export function Card({ children, padding = "md" }: CardProps) {
  return (
    <div className={clsx("bg-background border-border rounded-lg border shadow-sm", PADDING_CLASSES[padding])}>
      {children}
    </div>
  );
}
