"use client";

import { useState } from "react";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Button } from "@/shared/ui/Button";
import { ImageFrame } from "@/shared/ui/ImageFrame";
import { ThemeImagePlaceholder } from "@/features/themes/components/ThemeImagePlaceholder";
import type { ThemeImageDTO } from "@/features/themes/theme.types";

const LARGE_IMAGE_SIZES = "(min-width: 1024px) 50vw, 100vw";
const THUMBNAIL_IMAGE_SIZES = "80px";

type ThemeGalleryProps = {
  themeName: string;
  images: ThemeImageDTO[];
};

// The first image is shown large. Clicking a thumbnail shows that image instead.
export function ThemeGallery({ themeName, images }: ThemeGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedImage = images[selectedIndex];
  if (!selectedImage) return <ThemeImagePlaceholder themeName={themeName} />;

  return (
    <Stack gap="sm">
      <ImageFrame src={selectedImage.url} alt={selectedImage.alt} sizes={LARGE_IMAGE_SIZES} priority />
      {images.length > 1 ? (
        <Inline gap="sm" wrap>
          {images.map((image, index) => (
            <Button
              key={image.url}
              variant={index === selectedIndex ? "primary" : "secondary"}
              size="sm"
              onClick={() => setSelectedIndex(index)}
            >
              <div className="w-20">
                <ImageFrame
                  src={image.url}
                  alt={image.alt || `${themeName} image ${index + 1}`}
                  sizes={THUMBNAIL_IMAGE_SIZES}
                />
              </div>
            </Button>
          ))}
        </Inline>
      ) : null}
    </Stack>
  );
}
