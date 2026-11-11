import { ACTIVITY_TARGET_PATHS } from "@/features/activity/activity.constants";
import type { ActivityLogRecord } from "@/features/activity/activity-log.model";
import type { ActivityLogDTO } from "@/features/activity/activity.types";

// The admin page of the target, or null when the row has no target or the target has no detail page.
function toTargetPath(record: ActivityLogRecord): string | null {
  if (!record.targetType || !record.targetId) return null;
  const basePath = ACTIVITY_TARGET_PATHS[record.targetType];
  if (basePath === null) return null;
  return `${basePath}/${record.targetId.toString()}`;
}

export function toActivityLogDTO(record: ActivityLogRecord, actorLabel: string): ActivityLogDTO {
  return {
    id: record._id.toString(),
    createdAt: record.createdAt,
    actorLabel,
    summary: record.summary,
    targetPath: toTargetPath(record),
  };
}
