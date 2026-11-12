import { z } from "zod";
import {
  CHANGE_TEXT_MAX,
  CHANGE_TEXT_MIN,
  CHANGE_TYPES,
  FILE_KEY_MAX,
  FILE_NAME_MAX,
  MAX_CHANGES,
  SEMVER_PATTERN,
  VERSION_MESSAGES,
} from "@/features/versions/version.constants";

const changeSchema = z.object({
  type: z.enum(CHANGE_TYPES, { error: VERSION_MESSAGES.changeText }),
  text: z
    .string({ error: VERSION_MESSAGES.changeText })
    .trim()
    .min(CHANGE_TEXT_MIN, VERSION_MESSAGES.changeText)
    .max(CHANGE_TEXT_MAX, VERSION_MESSAGES.changeText),
});

// Every error of the list ends up under the key "changes" of the field errors.
const changesSchema = z
  .array(changeSchema, { error: VERSION_MESSAGES.changesCount })
  .min(1, VERSION_MESSAGES.changesCount)
  .max(MAX_CHANGES, VERSION_MESSAGES.changesCount);

export const createVersionSchema = z.object({
  themeId: z.string(),
  version: z.string().trim().regex(SEMVER_PATTERN, VERSION_MESSAGES.versionFormat),
  changes: changesSchema,
  notify: z.boolean(),
  fileKey: z.string().min(1).max(FILE_KEY_MAX),
  originalName: z.string().min(1).max(FILE_NAME_MAX),
});

export const createZipUploadUrlSchema = z.object({
  themeId: z.string(),
  fileName: z.string(),
  sizeBytes: z.number(),
});

export const updateVersionChangesSchema = z.object({
  versionId: z.string(),
  changes: changesSchema,
});

export const versionsPageSearchParamsSchema = z.object({
  released: z.string().regex(SEMVER_PATTERN).optional().catch(undefined),
  notified: z.literal("1").optional().catch(undefined),
});

export type CreateVersionInput = z.output<typeof createVersionSchema>;
export type CreateZipUploadUrlInput = z.output<typeof createZipUploadUrlSchema>;
export type UpdateVersionChangesInput = z.output<typeof updateVersionChangesSchema>;
