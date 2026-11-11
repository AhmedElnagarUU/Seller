import { z } from "zod";
import { IMAGE_ALT_MAX, IMAGE_MAX_PX, IMAGE_MIN_PX } from "@/features/themes/theme.constants";

const PIXELS_MESSAGE = "Images must be 400 to 6000 pixels wide and high.";
const ALT_MESSAGE = "Use up to 150 characters.";

function isImagePixels(value: number): boolean {
  return Number.isInteger(value) && value >= IMAGE_MIN_PX && value <= IMAGE_MAX_PX;
}

const altField = z.string().max(IMAGE_ALT_MAX, ALT_MESSAGE);
const pixelsField = z.number({ error: PIXELS_MESSAGE }).refine(isImagePixels, PIXELS_MESSAGE);

export const createImageUploadUrlSchema = z.object({
  themeId: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
});

export const addThemeImageSchema = z.object({
  themeId: z.string(),
  key: z.string(),
  alt: altField,
  width: pixelsField,
  height: pixelsField,
});

export const removeThemeImageSchema = z.object({
  themeId: z.string(),
  key: z.string(),
});

export const reorderThemeImagesSchema = z.object({
  themeId: z.string(),
  keys: z.array(z.string()),
});

export const updateThemeImageAltSchema = z.object({
  themeId: z.string(),
  key: z.string(),
  alt: altField,
});

export type CreateImageUploadUrlInput = z.output<typeof createImageUploadUrlSchema>;
export type AddThemeImageInput = z.output<typeof addThemeImageSchema>;
export type RemoveThemeImageInput = z.output<typeof removeThemeImageSchema>;
export type ReorderThemeImagesInput = z.output<typeof reorderThemeImagesSchema>;
export type UpdateThemeImageAltInput = z.output<typeof updateThemeImageAltSchema>;
