"use client";

import { useState, useTransition } from "react";
import { uploadFile } from "@/shared/storage/upload-file";
import { IMAGE_MAX_PX, IMAGE_MIN_PX } from "@/features/themes/theme.constants";
import { addThemeImageAction, createImageUploadUrlAction } from "@/features/themes/theme-image.actions";

const BAD_IMAGE_MESSAGE = "Please upload a JPG, PNG or WebP image up to 3 MB.";
const PIXELS_MESSAGE = "Images must be 400 to 6000 pixels wide and high.";
const UPLOAD_FAILED_MESSAGE = "The upload failed. Please check your connection and try again.";

type ImageSize = { width: number; height: number };

type ThemeImageUpload = {
  error: string | null;
  percent: number;
  isUploading: boolean;
  // Changes after every finished upload, so the file field can be reset.
  finishedUploads: number;
  startUpload: (file: File) => void;
};

// The size of the picture in pixels, or null when the browser cannot read the file as an image.
async function readImageSize(file: File): Promise<ImageSize | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

function isAllowedPixels(value: number): boolean {
  return value >= IMAGE_MIN_PX && value <= IMAGE_MAX_PX;
}

// Runs the upload steps of docs/07-delivery-updates.md section 3.1. Returns the error to show, or null.
async function uploadThemeImage(
  themeId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<string | null> {
  const size = await readImageSize(file);
  if (!size) return BAD_IMAGE_MESSAGE;
  if (!isAllowedPixels(size.width) || !isAllowedPixels(size.height)) return PIXELS_MESSAGE;
  const upload = await createImageUploadUrlAction({ themeId, contentType: file.type, sizeBytes: file.size });
  if (!upload.ok) return upload.error;
  try {
    await uploadFile(upload.data, file, onProgress);
  } catch {
    return UPLOAD_FAILED_MESSAGE;
  }
  const saved = await addThemeImageAction({ themeId, key: upload.data.key, alt: "", ...size });
  return saved.ok ? null : saved.error;
}

export function useThemeImageUpload(themeId: string): ThemeImageUpload {
  const [error, setError] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [finishedUploads, setFinishedUploads] = useState(0);
  const [isUploading, startTransition] = useTransition();

  function startUpload(file: File): void {
    setError(null);
    setPercent(0);
    startTransition(async () => {
      setError(await uploadThemeImage(themeId, file, setPercent));
      setFinishedUploads((count) => count + 1);
    });
  }

  return { error, percent, isUploading, finishedUploads, startUpload };
}
