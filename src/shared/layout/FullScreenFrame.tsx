type FullScreenFrameProps = {
  children: React.ReactNode;
};

// Covers the whole window, including the store header and footer under it.
export function FullScreenFrame({ children }: FullScreenFrameProps) {
  return <div className="bg-background fixed inset-0 z-50 flex flex-col">{children}</div>;
}
