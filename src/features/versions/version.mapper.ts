import type { VersionRecord } from "@/features/versions/version.model";
import type { VersionAdminDTO, VersionDTO } from "@/features/versions/version.types";

function toChangeDTOs(record: VersionRecord): VersionDTO["changes"] {
  return record.changes.map((change) => ({ type: change.type, text: change.text }));
}

export function toVersionDTO(record: VersionRecord): VersionDTO {
  return {
    id: record._id.toString(),
    version: record.version,
    releasedAt: record.releasedAt,
    changes: toChangeDTOs(record),
    sizeBytes: record.file.sizeBytes,
  };
}

export function toVersionAdminDTO(record: VersionRecord): VersionAdminDTO {
  return {
    ...toVersionDTO(record),
    sha256: record.file.sha256,
    originalName: record.file.originalName,
    notifyRequested: record.notifyRequested,
  };
}
