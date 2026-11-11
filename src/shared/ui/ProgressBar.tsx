type ProgressBarProps = {
  percent: number;
  label: string;
};

export function ProgressBar({ percent, label }: ProgressBarProps) {
  return <progress value={percent} max={100} aria-label={label} className="accent-primary h-2 w-full" />;
}
