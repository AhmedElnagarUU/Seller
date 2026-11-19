import { getUsersForNotification, isAdminEmail, listCustomerRowsAfter } from "@/features/users/user.service";
import { listFavoriteRowsAfter } from "@/features/favorites/favorite.service";
import { listActiveOwnerRowsAfter } from "@/features/ownerships/ownership.service";
import { JOB_BATCH_SIZE } from "@/features/notifications/notification.constants";
import { findNotifiedUserIds } from "@/features/notifications/notification.service";
import type { NotificationJobRecord } from "@/features/notifications/notification-job.model";

// One source row of a stage (an ownership, a favorite or a user). `rowId` is the cursor of the job.
export type AudienceRow = { rowId: string; userId: string };
export type Recipient = { userId: string; name: string; email: string; wantsEmail: boolean };

type NotificationUser = Awaited<ReturnType<typeof getUsersForNotification>>[number];

// Step 1 of docs/09-emails.md section 5.4: the next JOB_BATCH_SIZE source rows after the cursor of the current stage.
export async function readAudienceRows(job: NotificationJobRecord): Promise<AudienceRow[]> {
  const afterId = job.cursor ? job.cursor.toString() : null;
  const limit = JOB_BATCH_SIZE;
  const themeId = job.themeId?.toString() ?? null;
  const categoryId = job.categoryId?.toString() ?? null;
  const { announcement } = job;
  if (job.stage === "theme_owners") {
    const ownersThemeId = job.kind === "announcement" ? announcement.audienceThemeId?.toString() : themeId;
    return ownersThemeId ? listActiveOwnerRowsAfter({ themeId: ownersThemeId, afterId, limit }) : [];
  }
  if (job.stage === "theme_favoriters") {
    return themeId ? listFavoriteRowsAfter({ targetType: "theme", targetId: themeId, afterId, limit }) : [];
  }
  if (job.stage === "category_followers") {
    return categoryId ? listFavoriteRowsAfter({ targetType: "category", targetId: categoryId, afterId, limit }) : [];
  }
  if (job.stage === "all_customers") return listCustomerRowsAfter({ afterId, limit });
  const userId = announcement.audienceUserId?.toString();
  if (afterId !== null || !userId) return [];
  return [{ rowId: userId, userId }];
}

// Does this user want the email of this job and stage? (docs/09-emails.md section 3, docs/03-data-model.md section 13)
function wantsEmail(job: NotificationJobRecord, user: NotificationUser): boolean {
  if (job.kind === "announcement") return job.announcement.sendEmail === true && user.emailAnnouncements;
  if (job.kind === "theme_published") return user.emailFollowedCategoryThemes;
  if (job.stage === "theme_owners") return user.emailOwnedThemeUpdates;
  return user.emailFavoriteThemeUpdates;
}

// Steps 3 and 4 and the email switch: who really gets a notification in this batch.
export async function selectRecipients(job: NotificationJobRecord, rows: AudienceRow[]): Promise<Recipient[]> {
  const users = await getUsersForNotification(rows.map((row) => row.userId));
  const usersById = new Map(users.map((user) => [user.id, user]));
  // In the order of the source rows, so a retry of the batch builds the same emails.
  const customers = [...new Set(rows.map((row) => row.userId))].flatMap((userId) => {
    const user = usersById.get(userId);
    return user && !user.disabled && !isAdminEmail(user.email) ? [user] : [];
  });
  const alreadyNotified = await findNotifiedUserIds(
    job._id.toString(),
    customers.map((user) => user.id),
  );
  return customers
    .filter((user) => !alreadyNotified.has(user.id))
    .map((user) => ({ userId: user.id, name: user.name, email: user.email, wantsEmail: wantsEmail(job, user) }));
}
