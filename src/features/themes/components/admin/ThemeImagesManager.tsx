"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/shared/types/action";
import { Stack } from "@/shared/layout/Stack";
import { FileField } from "@/shared/ui/FileField";
import { FormError } from "@/shared/ui/FormError";
import { Heading } from "@/shared/ui/Heading";
import { ProgressBar } from "@/shared/ui/ProgressBar";
import { Text } from "@/shared/ui/Text";
import { ThemeImageRow } from "@/features/themes/components/admin/ThemeImageRow";
import { useThemeImageUpload } from "@/features/themes/components/admin/useThemeImageUpload";
import {
  removeThemeImageAction,
  reorderThemeImagesAction,
  updateThemeImageAltAction,
} from "@/features/themes/theme-image.actions";
import type { ThemeAdminImageDTO } from "@/features/themes/theme.types";

type ThemeImagesManagerProps = {
  themeId: string;
  images: ThemeAdminImageDTO[];
};

// The keys with the image at `index` moved one place (`step` -1 = up, 1 = down).
function movedKeys(images: ThemeAdminImageDTO[], index: number, step: number): string[] {
  const keys = images.map((image) => image.key);
  const [moved] = keys.splice(index, 1);
  if (moved !== undefined) keys.splice(index + step, 0, moved);
  return keys;
}

export function ThemeImagesManager({ themeId, images }: ThemeImagesManagerProps) {
  const upload = useThemeImageUpload(themeId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();
  const isBusy = isSaving || upload.isUploading;

  function run(action: () => Promise<ActionResult>): void {
    setActionError(null);
    startTransition(async () => {
      const result = await action();
      setActionError(result.ok ? null : result.error);
    });
  }

  return (
    <Stack>
      <Heading level={2}>Images</Heading>
      <Text tone="muted">
        The first image is the cover. Up to 12 images, JPG, PNG or WebP, 3 MB each, 400 to 6000 pixels.
      </Text>
      <FormError message={upload.error ?? actionError} />
      {images.length === 0 ? <Text>No images yet.</Text> : null}
      {images.map((image, index) => (
        <ThemeImageRow
          key={image.key}
          image={image}
          position={index + 1}
          isLast={index === images.length - 1}
          disabled={isBusy}
          onSaveAlt={(alt) => run(() => updateThemeImageAltAction({ themeId, key: image.key, alt }))}
          onMoveUp={() => run(() => reorderThemeImagesAction({ themeId, keys: movedKeys(images, index, -1) }))}
          onMoveDown={() => run(() => reorderThemeImagesAction({ themeId, keys: movedKeys(images, index, 1) }))}
          onRemove={() => run(() => removeThemeImageAction({ themeId, key: image.key }))}
        />
      ))}
      <FileField
        key={upload.finishedUploads}
        label="Add an image"
        name="image"
        accept="image/jpeg,image/png,image/webp"
        disabled={isBusy}
        onChange={(file) => {
          if (file) upload.startUpload(file);
        }}
      />
      {upload.isUploading ? (
        <Stack gap="xs">
          <ProgressBar percent={upload.percent} label="Uploading image" />
          <Text>Uploading… {upload.percent}%</Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
