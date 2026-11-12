import type { ClientSession, Types } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId } from "@/shared/db/ids";
import type {
  AnnouncementAudience,
  NotificationJobKind,
  NotificationJobStage,
  NotificationJobStatus,
} from "@/features/notifications/notification.constants";
import { NotificationJobModel, type NotificationJobRecord } from "@/features/notifications/notification-job.model";

// The announcement part of a job. Every value is null for the other kinds.
export type AnnouncementFields = {
  title: string | null;
  body: string | null;
  link: string | null;
  sendEmail: boolean | null;
  audience: AnnouncementAudience | null;
  audienceThemeId: Types.ObjectId | null;
  audienceUserId: Types.ObjectId | null;
};

// Every field of a new job.
export type NotificationJobFields = {
  kind: NotificationJobKind;
  themeId: Types.ObjectId | null;
  versionId: Types.ObjectId | null;
  categoryId: Types.ObjectId | null;
  announcement: AnnouncementFields;
  status: NotificationJobStatus;
  stage: NotificationJobStage;
  cursor: Types.ObjectId | null;
  notifiedCount: number;
  emailedCount: number;
  attempts: number;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  lockedUntil: Date | null;
  createdByUserId: Types.ObjectId;
};

// Inserts one job. With a session the write is part of that transaction.
export async function insertNotificationJob(
  fields: NotificationJobFields,
  session?: ClientSession,
): Promise<NotificationJobRecord> {
  await connectDB();
  const [created] = await NotificationJobModel.create([fields], { session });
  if (!created) throw new Error("The notification job was not created.");
  return created.toObject();
}

// Finds the jobs with these ids. Ids that are not valid are ignored.
export async function findNotificationJobsByIds(ids: string[]): Promise<NotificationJobRecord[]> {
  const objectIds = ids.map((id) => parseObjectId(id)).filter((objectId) => objectId !== null);
  await connectDB();
  return NotificationJobModel.find({ _id: { $in: objectIds } }).lean<NotificationJobRecord[]>();
}
