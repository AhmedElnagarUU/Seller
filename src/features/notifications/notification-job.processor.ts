import { toObjectId } from "@/shared/db/ids";
import { getEmailSender } from "@/features/emails/email.sender";
import { EmailRateLimitError } from "@/features/emails/email.types";
import { JOB_STAGES_BY_KIND, MAX_BATCHES_PER_RUN } from "@/features/notifications/notification.constants";
import { insertNotificationsForJob } from "@/features/notifications/notification.service";
import { readAudienceRows, selectRecipients } from "@/features/notifications/notification-audience.service";
import type { NotificationJobRecord } from "@/features/notifications/notification-job.model";
import * as notificationJobRepository from "@/features/notifications/notification-job.repository";
import { buildBatchMessages } from "@/features/notifications/notification-message.service";

export type ProcessRunResult = { processedBatches: number; finishedJobs: number };
export type BatchResult = { result: "ok" | "rate_limited" | "failed"; isFinished: boolean };

// The stage after the current one, or null when the current stage is the last one of the job.
function findNextStage(job: NotificationJobRecord) {
  if (job.kind === "announcement") return null;
  const stages = JOB_STAGES_BY_KIND[job.kind];
  const nextIndex = stages.indexOf(job.stage) + 1;
  return stages[nextIndex] ?? null;
}

// One batch of one claimed job: steps 1 to 8 of docs/09-emails.md section 5.4.
// Without a rate limit or another error the lock is released by the last write of the batch.
async function runBatch(job: NotificationJobRecord): Promise<BatchResult> {
  const rows = await readAudienceRows(job);
  const lastRow = rows.at(-1);
  if (!lastRow) {
    const nextStage = findNextStage(job);
    if (nextStage) {
      await notificationJobRepository.moveJobToStage(job._id, nextStage);
      return { result: "ok", isFinished: false };
    }
    await notificationJobRepository.markJobDone(job._id);
    return { result: "ok", isFinished: true };
  }
  const recipients = await selectRecipients(job, rows);
  const { emails, notifications } = await buildBatchMessages(job, recipients);
  const firstRow = rows[0];
  // Emails go out before the notifications are written. A retry of this batch uses the same key.
  if (emails.length > 0 && firstRow) {
    await getEmailSender().sendBatch(emails, `job-${job._id.toString()}-${job.stage}-${firstRow.rowId}`);
  }
  const inserted = await insertNotificationsForJob(notifications);
  await notificationJobRepository.saveBatchProgress(job._id, {
    cursor: toObjectId(lastRow.rowId),
    notifiedDelta: inserted,
    emailedDelta: emails.length,
  });
  return { result: "ok", isFinished: false };
}

export async function processOneBatch(job: NotificationJobRecord): Promise<BatchResult> {
  try {
    return await runBatch(job);
  } catch (error) {
    if (error instanceof EmailRateLimitError) {
      await notificationJobRepository.releaseJobLock(job._id);
      return { result: "rate_limited", isFinished: false };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    await notificationJobRepository.recordJobFailure(job._id, message);
    // The id only: never the error body or the emails.
    console.error("notification batch failed", job._id.toString());
    return { result: "failed", isFinished: false };
  }
}

// The cron work: up to MAX_BATCHES_PER_RUN batches of the oldest open jobs. A rate limit or a failed batch stops
// the run; the same batch is tried again by the next run.
export async function processNotificationJobs(): Promise<ProcessRunResult> {
  let processedBatches = 0;
  let finishedJobs = 0;
  while (processedBatches < MAX_BATCHES_PER_RUN) {
    const job = await notificationJobRepository.claimNextJob();
    if (!job) break;
    const { result, isFinished } = await processOneBatch(job);
    processedBatches += 1;
    if (isFinished) finishedJobs += 1;
    if (result !== "ok") break;
  }
  return { processedBatches, finishedJobs };
}
