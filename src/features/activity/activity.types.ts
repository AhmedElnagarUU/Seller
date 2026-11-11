import type { ActivityAction, ActivityActorRole, ActivityTargetType } from "@/features/activity/activity.constants";

// What a caller gives to `activityService.log`. Omitted nullable fields are saved as null.
export type ActivityLogInput = {
  action: ActivityAction;
  actorRole: ActivityActorRole;
  actorUserId?: string | null;
  subjectUserId?: string | null;
  targetType?: ActivityTargetType | null;
  targetId?: string | null;
  summary: string;
};

export type ActivityLogDTO = {
  id: string;
  createdAt: Date;
  actorLabel: string;
  summary: string;
  targetPath: string | null;
};

export type ActivityPageDTO = {
  items: ActivityLogDTO[];
  page: number;
  totalPages: number;
  total: number;
};
