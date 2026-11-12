import { ButtonAnchor } from "@/shared/ui/ButtonAnchor";
import type { ButtonSize, ButtonVariant } from "@/shared/ui/buttonClasses";

type DownloadButtonProps = {
  versionId: string;
  label: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

// A plain link, never next/link: a prefetch would count as a download (docs/07-delivery-updates.md 7.3).
export function DownloadButton({ versionId, label, size, variant }: DownloadButtonProps) {
  return (
    <ButtonAnchor href={`/api/downloads/${versionId}`} rel="nofollow" size={size} variant={variant}>
      {label}
    </ButtonAnchor>
  );
}
