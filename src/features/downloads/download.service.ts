import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import { createDownloadUrl } from "@/shared/storage/s3";
import {
  DOWNLOAD_ERROR_MESSAGES,
  DOWNLOAD_LINK_SECONDS,
  DOWNLOAD_WINDOW_MINUTES,
  DOWNLOADS_PER_HOUR,
} from "@/features/downloads/download.constants";
import * as downloadLogRepository from "@/features/downloads/download-log.repository";
import { hasActiveOwnership } from "@/features/ownerships/ownership.service";
import { getThemeForAdmin, incrementDownloadCount } from "@/features/themes/theme.service";
import { getVersionForDownload } from "@/features/versions/version.service";

const MILLISECONDS_PER_MINUTE = 60_000;

type CreateDownloadLinkInput = { userId: string; versionId: string };

// Checks the rules of docs/07-delivery-updates.md 7.1 and returns a short-lived link to the zip.
// No transaction (docs/03-data-model.md section 19). Admins are not an exception.
export async function createDownloadLink(input: CreateDownloadLinkInput): Promise<{ url: string }> {
  const version = await getVersionForDownload(input.versionId);
  if (!version) throw new AppError("NOT_FOUND", DOWNLOAD_ERROR_MESSAGES.not_found);
  if (!(await hasActiveOwnership(input.userId, version.themeId))) {
    throw new AppError("FORBIDDEN", DOWNLOAD_ERROR_MESSAGES.not_owned);
  }
  const since = new Date(now().getTime() - DOWNLOAD_WINDOW_MINUTES * MILLISECONDS_PER_MINUTE);
  const recentDownloads = await downloadLogRepository.countDownloadLogsForUserSince(input.userId, since);
  if (recentDownloads >= DOWNLOADS_PER_HOUR) throw new AppError("RATE_LIMITED", DOWNLOAD_ERROR_MESSAGES.rate_limited);

  await downloadLogRepository.insertDownloadLog({
    userId: input.userId,
    themeId: version.themeId,
    versionId: version.id,
    createdAt: now(),
  });
  await incrementDownloadCount(version.themeId);

  const theme = await getThemeForAdmin(version.themeId);
  if (!theme) throw new AppError("NOT_FOUND", DOWNLOAD_ERROR_MESSAGES.not_found);
  const url = await createDownloadUrl({
    key: version.fileKey,
    expiresInSeconds: DOWNLOAD_LINK_SECONDS,
    downloadFileName: `${theme.slug}-${version.version}.zip`,
  });
  return { url };
}
