import type { ClientSession } from "mongoose";
import { withTransaction } from "@/shared/db/transaction";
import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import { compareSemver } from "@/shared/lib/semver";
import { newThemeZipKey } from "@/shared/storage/keys";
import { createUploadUrl, type PresignedUpload } from "@/shared/storage/s3";
import * as activityService from "@/features/activity/activity.service";
import { createVersionReleasedJob, getJobSummaries } from "@/features/notifications/notification-job.service";
import { getThemeForAdmin, setLatestVersion } from "@/features/themes/theme.service";
import type { ThemeAdminDTO } from "@/features/themes/theme.types";
import {
  FILE_NAME_MAX,
  VERSION_MESSAGES,
  ZIP_CONTENT_TYPE,
  ZIP_UPLOAD_SECONDS,
} from "@/features/versions/version.constants";
import { toVersionAdminDTO, toVersionDTO } from "@/features/versions/version.mapper";
import type { VersionRecord } from "@/features/versions/version.model";
import * as versionRepository from "@/features/versions/version.repository";
import type { CreateVersionInput, CreateZipUploadUrlInput } from "@/features/versions/version.schemas";
import type {
  VersionAdminDTO,
  VersionAdminListItemDTO,
  VersionDTO,
  VersionDownloadDTO,
} from "@/features/versions/version.types";
import { checkUploadedZip, isAllowedZipSize, type CheckedZip } from "@/features/versions/version-upload.service";

type UpdateChangesInput = { versionId: string; changes: versionRepository.ChangeFields[] };

async function getTheme(themeId: string): Promise<ThemeAdminDTO> {
  const theme = await getThemeForAdmin(themeId);
  if (!theme) throw new AppError("NOT_FOUND", VERSION_MESSAGES.themeNotFound);
  return theme;
}

function hasZipName(fileName: string): boolean {
  return fileName.length >= 1 && fileName.length <= FILE_NAME_MAX && fileName.toLowerCase().endsWith(".zip");
}

// Step 1 of a release: checks the rules and returns a presigned PUT for the private bucket.
export async function createZipUploadUrl(input: CreateZipUploadUrlInput): Promise<PresignedUpload> {
  await getTheme(input.themeId);
  if (!hasZipName(input.fileName) || !isAllowedZipSize(input.sizeBytes)) {
    throw new AppError("INVALID", VERSION_MESSAGES.invalidZip);
  }
  // Always our own content type, never the one of the browser (Windows sends another one for zips).
  return createUploadUrl({
    bucket: "private",
    key: newThemeZipKey(input.themeId),
    contentType: ZIP_CONTENT_TYPE,
    sizeBytes: input.sizeBytes,
    cacheControl: null,
    expiresInSeconds: ZIP_UPLOAD_SECONDS,
  });
}

function assertHigherThanLatest(version: string, latestVersion: string | null): void {
  if (latestVersion !== null && compareSemver(version, latestVersion) <= 0) {
    throw new AppError("CONFLICT", `The version must be higher than ${latestVersion}.`);
  }
}

// Turns a unique-index error into the message for the admin. Other errors pass through.
function throwDuplicateConflict(error: unknown, version: string): never {
  const duplicate = versionRepository.findDuplicateKeyField(error);
  if (duplicate === "version") throw new AppError("CONFLICT", `Version ${version} already exists for this theme.`);
  if (duplicate === "fileKey") throw new AppError("CONFLICT", VERSION_MESSAGES.fileAlreadyUsed);
  throw error;
}

// Writes everything of a release in one transaction (docs/03-data-model.md section 19).
async function saveRelease(
  input: CreateVersionInput,
  theme: ThemeAdminDTO,
  file: CheckedZip,
  adminUserId: string,
): Promise<VersionRecord> {
  const releasedAt = now();
  return withTransaction(async (session: ClientSession) => {
    const created = await versionRepository.insertVersion(
      {
        themeId: input.themeId,
        version: input.version,
        changes: input.changes,
        file: { key: input.fileKey, sizeBytes: file.sizeBytes, sha256: file.sha256, originalName: input.originalName },
        releasedAt,
        notifyRequested: input.notify,
      },
      session,
    );
    const versionId = created._id.toString();
    await setLatestVersion(input.themeId, { versionId, version: input.version, releasedAt }, session);
    if (input.notify) {
      const job = await createVersionReleasedJob(
        { themeId: input.themeId, versionId, createdByUserId: adminUserId },
        session,
      );
      await versionRepository.setVersionNotificationJobId(versionId, job.id, session);
    }
    await activityService.log(
      {
        action: "version_released",
        actorRole: "admin",
        actorUserId: adminUserId,
        targetType: "theme",
        targetId: input.themeId,
        summary: `Version released: ${theme.name} ${input.version}`,
      },
      session,
    );
    return created;
  });
}

// Releases a new version of a theme from a zip that the browser already uploaded (docs/07-delivery-updates.md 4.3).
export async function createVersion(input: CreateVersionInput, adminUserId: string): Promise<VersionAdminDTO> {
  const theme = await getTheme(input.themeId);
  assertHigherThanLatest(input.version, theme.latestVersion);
  const file = await checkUploadedZip(input.themeId, input.fileKey);
  try {
    const created = await saveRelease(input, theme, file, adminUserId);
    return toVersionAdminDTO(created);
  } catch (error) {
    return throwDuplicateConflict(error, input.version);
  }
}

// Changes the changelog of a version. Nothing else: no notification and no activity entry.
export async function updateVersionChanges(input: UpdateChangesInput): Promise<void> {
  const updated = await versionRepository.updateVersionChangesById(input.versionId, input.changes);
  if (!updated) throw new AppError("NOT_FOUND", VERSION_MESSAGES.versionNotFound);
}

// The versions of a theme for the store, newest first. No file key and no hash.
export async function listVersionsForTheme(themeId: string): Promise<VersionDTO[]> {
  const records = await versionRepository.findVersionsByThemeId(themeId);
  return records.map(toVersionDTO);
}

// Only the downloads service uses this one.
export async function getVersionForDownload(versionId: string): Promise<VersionDownloadDTO | null> {
  const record = await versionRepository.findVersionById(versionId);
  if (!record) return null;
  return {
    id: record._id.toString(),
    themeId: record.themeId.toString(),
    version: record.version,
    fileKey: record.file.key,
  };
}

// The versions of a theme for the admin, newest first, each with the summary of its notification job.
export async function listVersionsForAdmin(themeId: string): Promise<VersionAdminListItemDTO[]> {
  const records = await versionRepository.findVersionsByThemeId(themeId);
  const jobIds = records.flatMap((record) => (record.notificationJobId ? [record.notificationJobId.toString()] : []));
  const summaries = await getJobSummaries(jobIds);
  return records.map((record) => ({
    ...toVersionAdminDTO(record),
    notification: record.notificationJobId ? (summaries.get(record.notificationJobId.toString()) ?? null) : null,
  }));
}

// One version for the admin. null when it does not exist or belongs to another theme.
export async function getVersionForAdmin(themeId: string, versionId: string): Promise<VersionAdminDTO | null> {
  const record = await versionRepository.findVersionById(versionId);
  if (!record || record.themeId.toString() !== themeId) return null;
  return toVersionAdminDTO(record);
}

export async function countVersionsForTheme(themeId: string): Promise<number> {
  return versionRepository.countVersionsByThemeId(themeId);
}
