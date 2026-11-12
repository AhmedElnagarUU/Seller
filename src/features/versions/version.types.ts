import type { NotificationJobSummaryDTO } from "@/features/notifications/notification.types";
import type { ChangeType } from "@/features/versions/version.constants";

export type ChangeEntryDTO = { type: ChangeType; text: string };

// What the store pages show. No file key and no hash.
export type VersionDTO = {
  id: string;
  version: string;
  releasedAt: Date;
  changes: ChangeEntryDTO[];
  sizeBytes: number;
};

// What the admin pages show (docs/07-delivery-updates.md section 4.3).
export type VersionAdminDTO = {
  id: string;
  version: string;
  releasedAt: Date;
  changes: ChangeEntryDTO[];
  sizeBytes: number;
  sha256: string;
  originalName: string;
  notifyRequested: boolean;
};

export type VersionAdminListItemDTO = VersionAdminDTO & { notification: NotificationJobSummaryDTO | null };

// What the downloads service needs. Only this type holds the file key.
export type VersionDownloadDTO = { id: string; themeId: string; version: string; fileKey: string };
