import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import { ThemeModel } from "@/features/themes/theme.model";
import * as themeRepository from "@/features/themes/theme.repository";
import { getPublishChecklist, publishTheme, unpublishTheme } from "@/features/themes/theme-publish.service";
import { setTestNow } from "@/shared/lib/clock";
import { createAdmin, createTheme } from "@/shared/test/factories";

const FIXED_NOW = new Date("2026-11-01T10:00:00Z");
const UNKNOWN_ID = "665f1c2e8f1b2c3d4e5f6a7b";

const LATEST_VERSION = {
  versionId: new Types.ObjectId(),
  version: "1.0.0",
  releasedAt: new Date("2026-10-01T00:00:00Z"),
};
const IMAGES = [{ key: "theme-images/a/1.jpg", alt: "Home page", width: 1200, height: 800 }];
const PROVIDER = { productId: "fake_prod_x", syncedAt: new Date("2026-10-02T00:00:00Z") };

function buildReadyTheme(overrides: Parameters<typeof createTheme>[0] = {}) {
  return createTheme({
    status: "draft",
    latestVersion: LATEST_VERSION,
    images: IMAGES,
    provider: PROVIDER,
    ...overrides,
  });
}

async function countSideEffects() {
  return {
    jobs: await NotificationJobModel.countDocuments(),
    logs: await ActivityLogModel.countDocuments(),
  };
}

describe("publishTheme", () => {
  it("refuses a theme without a version", async () => {
    const admin = await createAdmin();
    const theme = await buildReadyTheme({ latestVersion: null });

    await expect(publishTheme(theme._id.toString(), admin._id.toString())).rejects.toMatchObject({
      code: "INVALID",
      message: "Upload at least one version before publishing.",
    });

    const saved = await ThemeModel.findById(theme._id).lean();
    expect(saved?.status).toBe("draft");
    expect(await countSideEffects()).toEqual({ jobs: 0, logs: 0 });
  });

  it("refuses a theme without an image", async () => {
    const admin = await createAdmin();
    const theme = await buildReadyTheme({ images: [] });

    await expect(publishTheme(theme._id.toString(), admin._id.toString())).rejects.toMatchObject({
      code: "INVALID",
      message: "Add at least one image before publishing.",
    });
  });

  it("refuses a theme that was never synced", async () => {
    const admin = await createAdmin();
    const theme = await buildReadyTheme({ provider: { productId: null, syncedAt: null } });

    await expect(publishTheme(theme._id.toString(), admin._id.toString())).rejects.toMatchObject({
      code: "INVALID",
      message: "Sync the theme with the payment provider before publishing.",
    });
  });

  it("refuses an already published theme; an unknown id is NOT_FOUND", async () => {
    const admin = await createAdmin();
    const theme = await buildReadyTheme({ status: "published" });

    await expect(publishTheme(theme._id.toString(), admin._id.toString())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This theme is already published.",
    });
    await expect(publishTheme(UNKNOWN_ID, admin._id.toString())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Theme not found.",
    });
  });

  it("first publish sets status and publishedAt, creates one job and one activity log", async () => {
    setTestNow(FIXED_NOW);
    const admin = await createAdmin();
    const theme = await buildReadyTheme();
    const themeId = theme._id.toString();

    await publishTheme(themeId, admin._id.toString());

    const saved = await ThemeModel.findById(themeId).lean();
    expect(saved?.status).toBe("published");
    expect(saved?.publishedAt).toEqual(FIXED_NOW);
    const jobs = await NotificationJobModel.find().lean();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: "theme_published", stage: "category_followers", status: "pending" });
    expect(jobs[0]?.themeId?.toString()).toBe(themeId);
    expect(jobs[0]?.categoryId?.toString()).toBe(theme.categoryId.toString());
    expect(jobs[0]?.createdByUserId.toString()).toBe(admin._id.toString());
    const logs = await ActivityLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: "theme_published",
      actorRole: "admin",
      targetType: "theme",
      summary: `Theme published: ${theme.name}`,
    });
    expect(logs[0]?.actorUserId?.toString()).toBe(admin._id.toString());
    expect(logs[0]?.targetId?.toString()).toBe(themeId);
  });

  it("publishing again after unpublish keeps the old publishedAt and creates no second job", async () => {
    setTestNow(FIXED_NOW);
    const admin = await createAdmin();
    const adminId = admin._id.toString();
    const theme = await buildReadyTheme();
    const themeId = theme._id.toString();
    await publishTheme(themeId, adminId);
    await unpublishTheme(themeId, adminId);
    setTestNow(new Date("2026-12-01T10:00:00Z"));

    await publishTheme(themeId, adminId);

    const saved = await ThemeModel.findById(themeId).lean();
    expect(saved?.status).toBe("published");
    expect(saved?.publishedAt).toEqual(FIXED_NOW);
    expect(await NotificationJobModel.countDocuments()).toBe(1);
    expect(await ActivityLogModel.countDocuments({ action: "theme_published" })).toBe(2);
  });

  it("rolls back everything when the log insert fails", async () => {
    const admin = await createAdmin();
    const theme = await buildReadyTheme();
    // Bypasses validation: the activity summary becomes longer than the 300 characters of activityLogs.summary.
    await ThemeModel.collection.updateOne({ _id: theme._id }, { $set: { name: "x".repeat(400) } });

    await expect(publishTheme(theme._id.toString(), admin._id.toString())).rejects.toThrow();

    const saved = await ThemeModel.findById(theme._id).lean();
    expect(saved?.status).toBe("draft");
    expect(saved?.publishedAt).toBeNull();
    expect(await countSideEffects()).toEqual({ jobs: 0, logs: 0 });
  });
});

describe("publishTheme when the status changed after it was read", () => {
  it("markThemePublished refuses a theme that is already published and keeps its publishedAt", async () => {
    const publishedAt = new Date("2026-10-05T00:00:00Z");
    const theme = await buildReadyTheme({ status: "published", publishedAt });

    const wasMarked = await themeRepository.markThemePublished(theme._id.toString(), FIXED_NOW, undefined);

    expect(wasMarked).toBe(false);
    const saved = await ThemeModel.findById(theme._id).lean();
    expect(saved?.status).toBe("published");
    expect(saved?.publishedAt).toEqual(publishedAt);
  });
});

describe("unpublishTheme", () => {
  it("sets unpublished and logs theme_unpublished", async () => {
    const admin = await createAdmin();
    const theme = await buildReadyTheme({ status: "published" });

    await unpublishTheme(theme._id.toString(), admin._id.toString());

    const saved = await ThemeModel.findById(theme._id).lean();
    expect(saved?.status).toBe("unpublished");
    const logs = await ActivityLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: "theme_unpublished",
      actorRole: "admin",
      targetType: "theme",
      summary: `Theme unpublished: ${theme.name}`,
    });
    expect(logs[0]?.actorUserId?.toString()).toBe(admin._id.toString());
    expect(logs[0]?.targetId?.toString()).toBe(theme._id.toString());
    expect(await NotificationJobModel.countDocuments()).toBe(0);
  });

  it("refuses a draft and an already unpublished theme", async () => {
    const admin = await createAdmin();
    const draft = await buildReadyTheme({ status: "draft" });
    const unpublished = await buildReadyTheme({ status: "unpublished" });

    for (const theme of [draft, unpublished]) {
      await expect(unpublishTheme(theme._id.toString(), admin._id.toString())).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Only a published theme can be unpublished.",
      });
    }
    await expect(unpublishTheme(UNKNOWN_ID, admin._id.toString())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Theme not found.",
    });
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });
});

describe("getPublishChecklist", () => {
  it("reports the three checks and canPublish; null for an unknown id", async () => {
    const ready = await buildReadyTheme();
    const empty = await createTheme({ status: "draft" });
    const published = await buildReadyTheme({ status: "published" });

    expect(await getPublishChecklist(ready._id.toString())).toEqual({
      status: "draft",
      hasVersion: true,
      hasImage: true,
      isSynced: true,
      canPublish: true,
    });
    expect(await getPublishChecklist(empty._id.toString())).toEqual({
      status: "draft",
      hasVersion: false,
      hasImage: false,
      isSynced: false,
      canPublish: false,
    });
    expect(await getPublishChecklist(published._id.toString())).toMatchObject({
      status: "published",
      canPublish: false,
    });
    expect(await getPublishChecklist(UNKNOWN_ID)).toBeNull();
  });
});
