import { getCategoryById } from "@/features/categories/category.service";
import {
  buildAnnouncementEmail,
  buildFavoriteUpdateEmail,
  buildNewThemeInCategoryEmail,
  buildThemeUpdateEmail,
} from "@/features/emails/email.service";
import type { EmailMessage } from "@/features/emails/email.types";
import type { NotificationType } from "@/features/notifications/notification.constants";
import type { Recipient } from "@/features/notifications/notification-audience.service";
import type { NotificationJobRecord } from "@/features/notifications/notification-job.model";
import {
  buildAnnouncementText,
  buildCategoryNewThemeText,
  buildFavoriteThemeUpdatedText,
  buildOwnedThemeUpdatedText,
} from "@/features/notifications/notification.texts";
import type { NotificationText } from "@/features/notifications/notification.types";
import { getThemeForNotification } from "@/features/themes/theme.service";
import { getVersionForNotification } from "@/features/versions/version.service";

export type NewNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  jobId: string;
};
export type BatchMessages = { emails: EmailMessage[]; notifications: NewNotification[] };

// What one batch builds its messages from. Loaded once per batch.
type Builder = {
  type: NotificationType;
  text: NotificationText;
  buildEmail: (recipient: Recipient) => Promise<EmailMessage>;
};

const MISSING_DATA_MESSAGE = "Notification job data is missing.";

async function createVersionReleasedBuilder(job: NotificationJobRecord): Promise<Builder> {
  const theme = job.themeId ? await getThemeForNotification(job.themeId.toString()) : null;
  const version = job.versionId ? await getVersionForNotification(job.versionId.toString()) : null;
  if (!theme || !version) throw new Error(MISSING_DATA_MESSAGE);
  const changeTexts = version.changes.map((change) => change.text);
  if (job.stage === "theme_owners") {
    return {
      type: "owned_theme_updated",
      text: buildOwnedThemeUpdatedText({ themeName: theme.name, version: version.version, changeTexts }),
      buildEmail: (recipient) =>
        buildThemeUpdateEmail({
          to: recipient.email,
          name: recipient.name,
          themeName: theme.name,
          version: version.version,
          releasedAt: version.releasedAt,
          changes: version.changes,
        }),
    };
  }
  return {
    type: "favorite_theme_updated",
    text: buildFavoriteThemeUpdatedText({
      themeName: theme.name,
      themeSlug: theme.slug,
      version: version.version,
      changeTexts,
    }),
    buildEmail: (recipient) =>
      buildFavoriteUpdateEmail({
        to: recipient.email,
        name: recipient.name,
        themeName: theme.name,
        themeSlug: theme.slug,
        version: version.version,
        changes: version.changes,
      }),
  };
}

async function createThemePublishedBuilder(job: NotificationJobRecord): Promise<Builder> {
  const theme = job.themeId ? await getThemeForNotification(job.themeId.toString()) : null;
  const category = theme ? await getCategoryById(theme.categoryId) : null;
  if (!theme || !category) throw new Error(MISSING_DATA_MESSAGE);
  return {
    type: "category_new_theme",
    text: buildCategoryNewThemeText({
      categoryName: category.name,
      themeName: theme.name,
      themeSlug: theme.slug,
      tagline: theme.tagline,
    }),
    buildEmail: (recipient) =>
      buildNewThemeInCategoryEmail({
        to: recipient.email,
        name: recipient.name,
        categoryName: category.name,
        themeName: theme.name,
        themeSlug: theme.slug,
        tagline: theme.tagline,
      }),
  };
}

function createAnnouncementBuilder(job: NotificationJobRecord): Builder {
  const { title, body, link } = job.announcement;
  if (!title || !body) throw new Error(MISSING_DATA_MESSAGE);
  return {
    type: "announcement",
    text: buildAnnouncementText({ title, body, link: link ?? null }),
    buildEmail: (recipient) =>
      buildAnnouncementEmail({ to: recipient.email, name: recipient.name, title, body, link: link ?? null }),
  };
}

async function createBuilder(job: NotificationJobRecord): Promise<Builder> {
  if (job.kind === "version_released") return createVersionReleasedBuilder(job);
  if (job.kind === "theme_published") return createThemePublishedBuilder(job);
  return createAnnouncementBuilder(job);
}

// Steps 5 and 7 of docs/09-emails.md section 5.4: one notification per recipient, one email per recipient who
// wants it. Loads the theme, version and category once. Throws when they no longer exist.
export async function buildBatchMessages(job: NotificationJobRecord, recipients: Recipient[]): Promise<BatchMessages> {
  const builder = await createBuilder(job);
  const jobId = job._id.toString();
  const notifications = recipients.map((recipient) => ({
    userId: recipient.userId,
    type: builder.type,
    title: builder.text.title,
    body: builder.text.body,
    link: builder.text.link,
    jobId,
  }));
  const emails = await Promise.all(recipients.filter((recipient) => recipient.wantsEmail).map(builder.buildEmail));
  return { emails, notifications };
}
