import type { ClientSession } from "mongoose";
import { toObjectId } from "@/shared/db/ids";
import { toNotificationJobSummaryDTO } from "@/features/notifications/notification-job.mapper";
import * as notificationJobRepository from "@/features/notifications/notification-job.repository";
import type { AnnouncementFields } from "@/features/notifications/notification-job.repository";
import type {
  AnnouncementJobInput,
  NotificationJobSummaryDTO,
  ThemePublishedJobInput,
  VersionReleasedJobInput,
} from "@/features/notifications/notification.types";

// These functions only insert the job. The caller checks that the theme, category, version or customer exists,
// validates the texts and writes the activity log entry in the same transaction (docs/03-data-model.md section 19).

// How every new job starts: waiting, nothing sent yet.
const NEW_JOB_STATE = {
  status: "pending",
  cursor: null,
  notifiedCount: 0,
  emailedCount: 0,
  attempts: 0,
  error: null,
  startedAt: null,
  finishedAt: null,
  lockedUntil: null,
} as const;

const NO_ANNOUNCEMENT: AnnouncementFields = {
  title: null,
  body: null,
  link: null,
  sendEmail: null,
  audience: null,
  audienceThemeId: null,
  audienceUserId: null,
};

// A new version of a theme: its owners first, then the customers who favorited it.
export async function createVersionReleasedJob(
  input: VersionReleasedJobInput,
  session?: ClientSession,
): Promise<{ id: string }> {
  const created = await notificationJobRepository.insertNotificationJob(
    {
      ...NEW_JOB_STATE,
      kind: "version_released",
      stage: "theme_owners",
      themeId: toObjectId(input.themeId),
      versionId: toObjectId(input.versionId),
      categoryId: null,
      announcement: NO_ANNOUNCEMENT,
      createdByUserId: toObjectId(input.createdByUserId),
    },
    session,
  );
  return { id: created._id.toString() };
}

// A newly published theme: the customers who follow its category.
export async function createThemePublishedJob(
  input: ThemePublishedJobInput,
  session?: ClientSession,
): Promise<{ id: string }> {
  const created = await notificationJobRepository.insertNotificationJob(
    {
      ...NEW_JOB_STATE,
      kind: "theme_published",
      stage: "category_followers",
      themeId: toObjectId(input.themeId),
      versionId: null,
      categoryId: toObjectId(input.categoryId),
      announcement: NO_ANNOUNCEMENT,
      createdByUserId: toObjectId(input.createdByUserId),
    },
    session,
  );
  return { id: created._id.toString() };
}

// An announcement from the admin. The stage is the audience: all customers, the owners of a theme or one customer.
export async function createAnnouncementJob(
  input: AnnouncementJobInput,
  session?: ClientSession,
): Promise<{ id: string }> {
  const created = await notificationJobRepository.insertNotificationJob(
    {
      ...NEW_JOB_STATE,
      kind: "announcement",
      stage: input.audience,
      themeId: null,
      versionId: null,
      categoryId: null,
      announcement: {
        title: input.title,
        body: input.body,
        link: input.link,
        sendEmail: input.sendEmail,
        audience: input.audience,
        audienceThemeId: input.audienceThemeId ? toObjectId(input.audienceThemeId) : null,
        audienceUserId: input.audienceUserId ? toObjectId(input.audienceUserId) : null,
      },
      createdByUserId: toObjectId(input.createdByUserId),
    },
    session,
  );
  return { id: created._id.toString() };
}

// The summary of each known job, by job id. Unknown ids are missing from the map.
export async function getJobSummaries(jobIds: string[]): Promise<Map<string, NotificationJobSummaryDTO>> {
  const records = await notificationJobRepository.findNotificationJobsByIds(jobIds);
  const summaries = new Map<string, NotificationJobSummaryDTO>();
  for (const record of records) {
    summaries.set(record._id.toString(), toNotificationJobSummaryDTO(record));
  }
  return summaries;
}
