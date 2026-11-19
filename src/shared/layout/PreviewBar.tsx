type PreviewBarProps = {
  children: React.ReactNode;
};

// The thin bar at the top of the demo preview.
export function PreviewBar({ children }: PreviewBarProps) {
  return <div className="border-border bg-background border-b px-4 py-2">{children}</div>;
}
