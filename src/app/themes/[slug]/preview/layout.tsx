import { FullScreenFrame } from "@/shared/layout/FullScreenFrame";

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <FullScreenFrame>{children}</FullScreenFrame>;
}
