export const MAX_ZIP_BYTES = 209_715_200;
export const ZIP_UPLOAD_SECONDS = 1800;
export const ZIP_SIGNATURE_HEX = "504b0304";
export const ZIP_CONTENT_TYPE = "application/zip";
export const CHANGE_TYPES = ["new", "improved", "fixed", "removed"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];
export const MAX_CHANGES = 50;
export const CHANGE_TEXT_MIN = 2;
export const CHANGE_TEXT_MAX = 200;
// Original file name.
export const FILE_NAME_MAX = 200;
export const FILE_KEY_MAX = 300;
// Same regex as in theme.constants.ts (a model may import only its own constants).
export const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;

// docs/09-emails.md section 3.1 #7.
export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
  removed: "Removed",
};

export const VERSION_MESSAGES = {
  themeNotFound: "Theme not found.",
  versionNotFound: "Version not found.",
  invalidZip: "Please choose a .zip file of at most 200 MB.",
  fileNotFound: "We could not find the uploaded file. Please upload it again.",
  fileAlreadyUsed: "This file is already used by another version. Please upload it again.",
  notAZip: "This file is not a valid .zip file.",
  uploadFailed: "The upload failed. Please check your connection and try again.",
  versionFormat: "Use a version like 1.4.0.",
  changesCount: "Add between 1 and 50 changes.",
  changeText: "Each change needs 2 to 200 characters.",
} as const;
