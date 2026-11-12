import { AppError } from "@/shared/errors";
import { themeZipPrefix } from "@/shared/storage/keys";
import { deleteObject, hashObject, headObject } from "@/shared/storage/s3";
import { MAX_ZIP_BYTES, VERSION_MESSAGES, ZIP_SIGNATURE_HEX } from "@/features/versions/version.constants";
import * as versionRepository from "@/features/versions/version.repository";

export type CheckedZip = { sizeBytes: number; sha256: string };

// True when the size is allowed for a theme zip: 1 byte up to 200 MB.
export function isAllowedZipSize(sizeBytes: number): boolean {
  return sizeBytes >= 1 && sizeBytes <= MAX_ZIP_BYTES;
}

// Checks the file the browser uploaded (docs/07-delivery-updates.md section 4.3) and reads its size and SHA-256.
// A file that is too big, empty or not a zip is deleted. This is slow, so it runs before any transaction.
export async function checkUploadedZip(themeId: string, fileKey: string): Promise<CheckedZip> {
  if (!fileKey.startsWith(themeZipPrefix(themeId))) throw new AppError("INVALID", VERSION_MESSAGES.fileNotFound);
  if (await versionRepository.existsVersionByFileKey(fileKey)) {
    throw new AppError("CONFLICT", VERSION_MESSAGES.fileAlreadyUsed);
  }
  const stored = await headObject({ bucket: "private", key: fileKey });
  if (!stored) throw new AppError("INVALID", VERSION_MESSAGES.fileNotFound);
  if (!isAllowedZipSize(stored.sizeBytes)) {
    await deleteObject({ bucket: "private", key: fileKey });
    throw new AppError("INVALID", VERSION_MESSAGES.invalidZip);
  }
  const { sha256, firstBytesHex } = await hashObject({ bucket: "private", key: fileKey });
  if (firstBytesHex !== ZIP_SIGNATURE_HEX) {
    await deleteObject({ bucket: "private", key: fileKey });
    throw new AppError("INVALID", VERSION_MESSAGES.notAZip);
  }
  return { sizeBytes: stored.sizeBytes, sha256 };
}
