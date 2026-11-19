import clsx from "clsx";

type EmbedFrameWidth = "desktop" | "tablet" | "mobile";

type EmbedFrameProps = {
  src: string;
  title: string;
  width: EmbedFrameWidth;
};

const WIDTH_CLASSES: Record<EmbedFrameWidth, string> = {
  desktop: "w-full",
  tablet: "w-[768px] max-w-full",
  mobile: "w-[375px] max-w-full",
};

export function EmbedFrame({ src, title, width }: EmbedFrameProps) {
  return (
    <iframe src={src} title={title} className={clsx("bg-surface mx-auto h-full border-0", WIDTH_CLASSES[width])} />
  );
}
