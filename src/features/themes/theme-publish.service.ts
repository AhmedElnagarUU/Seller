import { AppError } from "@/shared/errors";
import { withTransaction } from "@/shared/db/transaction";
import { now } from "@/shared/lib/clock";
import * as activityService from "@/features/activity/activity.service";
import { createThemePublishedJob } from "@/features/notifications/notification-job.service";
import { THEME_PUBLISH_MESSAGES } from "@/features/themes/theme.constants";
import type { ThemeRecord } from "@/features/themes/theme.model";
import * as themeRepository from "@/features/themes/theme.repository";
import type { PublishChecklistDTO } from "@/features/themes/theme.types";

async function findThemeOrThrow(themeId: string): Promise<ThemeRecord> {
  const theme = await themeRepository.findThemeById(themeId);
  if (!theme) throw new AppError("NOT_FOUND", THEME_PUBLISH_MESSAGES.notFound);
  return theme;
}

function assertReadyToPublish(theme: ThemeRecord): void {
  if (!theme.latestVersion) throw new AppError("INVALID", THEME_PUBLISH_MESSAGES.noVersion);
  if (theme.images.length === 0) throw new AppError("INVALID", THEME_PUBLISH_MESSAGES.noImage);
  if (!theme.provider.productId) throw new AppError("INVALID", THEME_PUBLISH_MESSAGES.notSynced);
}

// Publishes a theme. The first publish also creates the notification job for the category's followers.
export async function publishTheme(themeId: string, adminUserId: string): Promise<void> {
  const theme = await findThemeOrThrow(themeId);
  if (theme.status === "published") throw new AppError("CONFLICT", THEME_PUBLISH_MESSAGES.alreadyPublished);
  assertReadyToPublish(theme);
  const isFirstPublish = theme.publishedAt === null || theme.publishedAt === undefined;
  await withTransaction(async (session) => {
    const wasPublished = await themeRepository.markThemePublished(themeId, isFirstPublish ? now() : null, session);
    if (!wasPublished) throw new AppError("CONFLICT", THEME_PUBLISH_MESSAGES.alreadyPublished);
    if (isFirstPublish) {
      await createThemePublishedJob(
        { themeId, categoryId: theme.categoryId.toString(), createdByUserId: adminUserId },
        session,
      );
    }
    await activityService.log(
      {
        action: "theme_published",
        actorRole: "admin",
        actorUserId: adminUserId,
        subjectUserId: null,
        targetType: "theme",
        targetId: themeId,
        summary: `Theme published: ${theme.name}`,
      },
      session,
    );
  });
}

// Takes a published theme out of the store. Owners keep their downloads.
export async function unpublishTheme(themeId: string, adminUserId: string): Promise<void> {
  const theme = await findThemeOrThrow(themeId);
  if (theme.status !== "published") throw new AppError("CONFLICT", THEME_PUBLISH_MESSAGES.notPublished);
  await withTransaction(async (session) => {
    const wasUnpublished = await themeRepository.markThemeUnpublished(themeId, session);
    if (!wasUnpublished) throw new AppError("CONFLICT", THEME_PUBLISH_MESSAGES.notPublished);
    await activityService.log(
      {
        action: "theme_unpublished",
        actorRole: "admin",
        actorUserId: adminUserId,
        subjectUserId: null,
        targetType: "theme",
        targetId: themeId,
        summary: `Theme unpublished: ${theme.name}`,
      },
      session,
    );
  });
}

// The publish checklist of the admin theme page, or null when the theme does not exist.
export async function getPublishChecklist(themeId: string): Promise<PublishChecklistDTO | null> {
  const theme = await themeRepository.findThemeById(themeId);
  if (!theme) return null;
  const hasVersion = Boolean(theme.latestVersion);
  const hasImage = theme.images.length > 0;
  const isSynced = Boolean(theme.provider.productId);
  return {
    status: theme.status,
    hasVersion,
    hasImage,
    isSynced,
    canPublish: hasVersion && hasImage && isSynced && theme.status !== "published",
  };
}
