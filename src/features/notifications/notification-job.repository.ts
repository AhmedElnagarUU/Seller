import type { ClientSession, Types } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId } from "@/shared/db/ids";
import { now } from "@/shared/lib/clock";
import {
  JOB_ERROR_MAX,
  JOB_LOCK_SECONDS,
  MAX_JOB_ATTEMPTS,
  type AnnouncementAudience,
  type NotificationJobKind,
  type NotificationJobStage,
  type NotificationJobStatus,
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

const MILLISECONDS_PER_SECOND = 1000;

// Takes the oldest open job that no other run works on (docs/09-emails.md section 5.3). One atomic update:
// the job is locked for JOB_LOCK_SECONDS and set to "running". null when there is none.
export async function claimNextJob(): Promise<NotificationJobRecord | null> {
  await connectDB();
  const claimed = await NotificationJobModel.findOneAndUpdate(
    {
      status: { $in: ["pending", "running"] },
      $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now() } }],
    },
    {
      $set: { status: "running", lockedUntil: new Date(now().getTime() + JOB_LOCK_SECONDS * MILLISECONDS_PER_SECOND) },
    },
    { sort: { createdAt: 1 }, returnDocument: "after" },
  ).lean<NotificationJobRecord>();
  if (!claimed) return null;
  if (claimed.startedAt) return claimed;
  const startedAt = now();
  await NotificationJobModel.updateOne({ _id: claimed._id }, { $set: { startedAt } });
  return { ...claimed, startedAt };
}

// The batch worked: moves the cursor, adds to the counters and releases the lock.
export async function saveBatchProgress(
  jobId: Types.ObjectId,
  progress: { cursor: Types.ObjectId; notifiedDelta: number; emailedDelta: number },
): Promise<void> {
  await connectDB();
  await NotificationJobModel.updateOne(
    { _id: jobId },
    {
      $set: { cursor: progress.cursor, lockedUntil: null },
      $inc: { notifiedCount: progress.notifiedDelta, emailedCount: progress.emailedDelta },
    },
  );
}

// The stage has no more rows: starts the next stage from its beginning and releases the lock.
export async function moveJobToStage(jobId: Types.ObjectId, stage: NotificationJobStage): Promise<void> {
  await connectDB();
  await NotificationJobModel.updateOne({ _id: jobId }, { $set: { stage, cursor: null, lockedUntil: null } });
}

export async function markJobDone(jobId: Types.ObjectId): Promise<void> {
  await connectDB();
  await NotificationJobModel.updateOne(
    { _id: jobId },
    { $set: { status: "done", finishedAt: now(), lockedUntil: null } },
  );
}

// Releases the lock without counting an attempt (a rate limit).
export async function releaseJobLock(jobId: Types.ObjectId): Promise<void> {
  await connectDB();
  await NotificationJobModel.updateOne({ _id: jobId }, { $set: { lockedUntil: null } });
}

// A batch failed: adds an attempt, stores the message and releases the lock. At MAX_JOB_ATTEMPTS the job is "failed".
export async function recordJobFailure(jobId: Types.ObjectId, message: string): Promise<void> {
  await connectDB();
  const updated = await NotificationJobModel.findOneAndUpdate(
    { _id: jobId },
    { $inc: { attempts: 1 }, $set: { error: message.slice(0, JOB_ERROR_MAX), lockedUntil: null } },
    { returnDocument: "after" },
  ).lean<NotificationJobRecord>();
  if (!updated || updated.attempts < MAX_JOB_ATTEMPTS) return;
  await NotificationJobModel.updateOne({ _id: jobId }, { $set: { status: "failed", finishedAt: now() } });
}

// One page of the announcement jobs, newest first.
export async function findAnnouncementJobsPage(page: number, pageSize: number): Promise<NotificationJobRecord[]> {
  await connectDB();
  return NotificationJobModel.find({ kind: "announcement" })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean<NotificationJobRecord[]>();
}

export async function countAnnouncementJobs(): Promise<number> {
  await connectDB();
  return NotificationJobModel.countDocuments({ kind: "announcement" });
}

// Finds a job by id, or null (also when the id is not a valid id).
export async function findJobById(id: string): Promise<NotificationJobRecord | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  await connectDB();
  return NotificationJobModel.findById(objectId).lean<NotificationJobRecord>();
}

// Puts a failed job back in the queue (docs/09-emails.md section 5.5): the cursor stays. Returns true when it changed.
export async function resetFailedJob(id: string): Promise<boolean> {
  const objectId = parseObjectId(id);
  if (!objectId) return false;
  await connectDB();
  const result = await NotificationJobModel.updateOne(
    { _id: objectId, status: "failed" },
    { $set: { status: "pending", attempts: 0, error: null } },
  );
  return result.modifiedCount === 1;
}
