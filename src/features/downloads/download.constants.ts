import type { AppErrorCode } from "@/shared/errors";

// 30 downloads per user per rolling 60 minutes (D-057).
export const DOWNLOADS_PER_HOUR = 30;
export const DOWNLOAD_WINDOW_MINUTES = 60;
// How long a signed download link works.
export const DOWNLOAD_LINK_SECONDS = 300;
// The database removes download logs after 1 year (D-148).
export const DOWNLOAD_LOG_RETENTION_SECONDS = 31_536_000;

export const DOWNLOAD_ERROR_KEYS = ["not_found", "not_owned", "rate_limited", "failed"] as const;
export type DownloadErrorKey = (typeof DOWNLOAD_ERROR_KEYS)[number];
export const DOWNLOAD_ERROR_PARAMS: Record<AppErrorCode, DownloadErrorKey> = {
  NOT_FOUND: "not_found",
  FORBIDDEN: "not_owned",
  RATE_LIMITED: "rate_limited",
  CONFLICT: "failed",
  INVALID: "failed",
};
export const DOWNLOAD_ERROR_MESSAGES: Record<DownloadErrorKey, string> = {
  not_found: "This file does not exist.",
  not_owned: "You do not own this theme.",
  rate_limited: "You downloaded too many files in the last hour. Please try again later.",
  failed: "The download could not start. Please try again.",
};
