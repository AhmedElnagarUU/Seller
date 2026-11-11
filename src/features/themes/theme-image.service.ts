import { AppError } from "@/shared/errors";
import { IMAGE_CONTENT_TYPES, newThemeImageKey, themeImagePrefix, type ImageContentType } from "@/shared/storage/keys";
import { createUploadUrl, deleteObject, headObject, type PresignedUpload } from "@/shared/storage/s3";
import {
  IMAGE_CACHE_CONTROL,
  IMAGE_UPLOAD_SECONDS,
  MAX_IMAGE_BYTES,
  MAX_THEME_IMAGES,
} from "@/features/themes/theme.constants";
import type {
  AddThemeImageInput,
  CreateImageUploadUrlInput,
  RemoveThemeImageInput,
  ReorderThemeImagesInput,
  UpdateThemeImageAltInput,
} from "@/features/themes/theme-image.schemas";
import type { ThemeRecord } from "@/features/themes/theme.model";
import * as themeRepository from "@/features/themes/theme.repository";
import type { ThemeImageFields } from "@/features/themes/theme.repository";

// Messages of docs/07-delivery-updates.md section 3.
const TOO_MANY_IMAGES_MESSAGE = "A theme can have at most 12 images.";
const BAD_IMAGE_MESSAGE = "Please upload a JPG, PNG or WebP image up to 3 MB.";
const UPLOAD_NOT_FOUND_MESSAGE = "We could not find the uploaded image. Please upload it again.";

async function getTheme(themeId: string): Promise<ThemeRecord> {
  const theme = await themeRepository.findThemeById(themeId);
  if (!theme) throw new AppError("NOT_FOUND", "Theme not found.");
  return theme;
}

function isImageContentType(contentType: string): contentType is ImageContentType {
  return IMAGE_CONTENT_TYPES.some((allowed) => allowed === contentType);
}

function hasImage(theme: ThemeRecord, key: string): boolean {
  return theme.images.some((image) => image.key === key);
}

function assertHasImage(theme: ThemeRecord, key: string): void {
  if (!hasImage(theme, key)) throw new AppError("NOT_FOUND", "Image not found.");
}

// Step 1 of an upload: checks the rules and returns a presigned PUT for the public bucket.
export async function createImageUploadUrl(input: CreateImageUploadUrlInput): Promise<PresignedUpload> {
  const theme = await getTheme(input.themeId);
  if (theme.images.length >= MAX_THEME_IMAGES) throw new AppError("CONFLICT", TOO_MANY_IMAGES_MESSAGE);
  const { contentType, sizeBytes } = input;
  const isSizeAllowed = sizeBytes >= 1 && sizeBytes <= MAX_IMAGE_BYTES;
  if (!isImageContentType(contentType) || !isSizeAllowed) throw new AppError("INVALID", BAD_IMAGE_MESSAGE);
  return createUploadUrl({
    bucket: "public",
    key: newThemeImageKey(input.themeId, contentType),
    contentType,
    sizeBytes,
    cacheControl: IMAGE_CACHE_CONTROL,
    expiresInSeconds: IMAGE_UPLOAD_SECONDS,
  });
}

// Last step of an upload: checks the stored file and saves it at the end of the theme's image list.
export async function addThemeImage(input: AddThemeImageInput): Promise<void> {
  const { themeId, key } = input;
  const theme = await getTheme(themeId);
  if (!key.startsWith(themeImagePrefix(themeId)) || hasImage(theme, key)) {
    throw new AppError("INVALID", UPLOAD_NOT_FOUND_MESSAGE);
  }
  const stored = await headObject({ bucket: "public", key });
  if (!stored) throw new AppError("INVALID", UPLOAD_NOT_FOUND_MESSAGE);
  if (!isImageContentType(stored.contentType) || stored.sizeBytes > MAX_IMAGE_BYTES) {
    await deleteObject({ bucket: "public", key });
    throw new AppError("INVALID", BAD_IMAGE_MESSAGE);
  }
  const image = { key, alt: input.alt, width: input.width, height: input.height };
  const wasAdded = await themeRepository.pushThemeImage(themeId, image);
  if (!wasAdded) throw new AppError("CONFLICT", TOO_MANY_IMAGES_MESSAGE);
}

// Removes an image from the theme, then deletes the stored file.
export async function removeThemeImage(input: RemoveThemeImageInput): Promise<void> {
  const { themeId, key } = input;
  const theme = await getTheme(themeId);
  assertHasImage(theme, key);
  if (theme.status === "published" && theme.images.length === 1) {
    throw new AppError("CONFLICT", "A published theme needs at least one image.");
  }
  await themeRepository.pullThemeImage(themeId, key);
  try {
    await deleteObject({ bucket: "public", key });
  } catch {
    // The image is already gone for the admin. No key and no URL in the log.
    console.error("removeThemeImage: could not delete the stored image");
  }
}

// Saves a new order. `keys` must hold exactly the keys of the theme's images. The first image is the cover.
export async function reorderThemeImages(input: ReorderThemeImagesInput): Promise<void> {
  const { themeId, keys } = input;
  const theme = await getTheme(themeId);
  const imagesByKey = new Map(theme.images.map((image) => [image.key, image]));
  const reordered: ThemeImageFields[] = [];
  for (const key of new Set(keys)) {
    const image = imagesByKey.get(key);
    if (image) reordered.push({ key: image.key, alt: image.alt, width: image.width, height: image.height });
  }
  const isSameList = keys.length === theme.images.length && reordered.length === theme.images.length;
  if (!isSameList) throw new AppError("INVALID", "The image list changed. Please reload the page.");
  await themeRepository.replaceThemeImages(themeId, reordered);
}

// Changes the alt text of one image.
export async function updateThemeImageAlt(input: UpdateThemeImageAltInput): Promise<void> {
  const theme = await getTheme(input.themeId);
  assertHasImage(theme, input.key);
  await themeRepository.setThemeImageAlt(input.themeId, input.key, input.alt);
}
