type DividerProps = {
  label?: string;
};

export function Divider({ label }: DividerProps) {
  if (!label) return <hr className="border-border border-t" />;
  return (
    <div className="flex items-center gap-3">
      <hr className="border-border grow border-t" />
      <span className="text-text-muted text-sm">{label}</span>
      <hr className="border-border grow border-t" />
    </div>
  );
}
