import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";

function buildVersionJob(overrides: Record<string, unknown> = {}) {
  return {
    kind: "version_released",
    stage: "theme_owners",
    themeId: new Types.ObjectId(),
    versionId: new Types.ObjectId(),
    createdByUserId: new Types.ObjectId(),
    ...overrides,
  };
}

function buildAnnouncementJob(announcement: Record<string, unknown>) {
  return { kind: "announcement", stage: "all_customers", announcement, createdByUserId: new Types.ObjectId() };
}

// Saves a job from loose test input (the tests also pass values that the types refuse).
async function saveJob(fields: Record<string, unknown>) {
  const job = new NotificationJobModel();
  job.set(fields);
  return job.save();
}

// The names of the fields that a ValidationError complains about, sorted.
async function refusedKeysOf(fields: Record<string, unknown>): Promise<string[]> {
  const error: unknown = await saveJob(fields).then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toMatchObject({ name: "ValidationError" });
  const errors = typeof error === "object" && error !== null && "errors" in error ? error.errors : {};
  return Object.keys(errors ?? {}).sort();
}

describe("notification job model", () => {
  it("refuses a version_released job without a version", async () => {
    expect(await refusedKeysOf(buildVersionJob({ versionId: null }))).toEqual(["versionId"]);
    expect(await NotificationJobModel.countDocuments()).toBe(0);
  });

  it("refuses a version_released job without a theme", async () => {
    expect(await refusedKeysOf(buildVersionJob({ themeId: null }))).toEqual(["themeId"]);
    expect(await NotificationJobModel.countDocuments()).toBe(0);
  });

  it("refuses a theme_published job without a category", async () => {
    const fields = buildVersionJob({ kind: "theme_published", stage: "category_followers", versionId: null });

    expect(await refusedKeysOf(fields)).toEqual(["categoryId"]);
    expect(await NotificationJobModel.countDocuments()).toBe(0);
  });

  it("refuses an announcement without title, body, sendEmail and audience", async () => {
    expect(await refusedKeysOf(buildAnnouncementJob({}))).toEqual([
      "announcement.audience",
      "announcement.body",
      "announcement.sendEmail",
      "announcement.title",
    ]);
    expect(await NotificationJobModel.countDocuments()).toBe(0);
  });

  it("accepts an announcement with `sendEmail: false`", async () => {
    const created = await saveJob(
      buildAnnouncementJob({
        title: "Winter sale",
        body: "All themes are 20% off.",
        sendEmail: false,
        audience: "all_customers",
      }),
    );

    const saved = await NotificationJobModel.findById(created._id).lean();
    expect(saved?.announcement.sendEmail).toBe(false);
    expect(saved?.announcement.title).toBe("Winter sale");
    expect(saved?.status).toBe("pending");
  });

  it("refuses an announcement for one customer without a customer", async () => {
    const fields = buildAnnouncementJob({
      title: "Winter sale",
      body: "All themes are 20% off.",
      sendEmail: true,
      audience: "one_customer",
    });

    expect(await refusedKeysOf(fields)).toEqual(["announcement.audienceUserId"]);
    expect(await NotificationJobModel.countDocuments()).toBe(0);
  });

  it("refuses an unknown status", async () => {
    expect(await refusedKeysOf(buildVersionJob({ status: "stuck" }))).toEqual(["status"]);
    expect(await NotificationJobModel.countDocuments()).toBe(0);
  });

  it("keeps the cron index", async () => {
    await NotificationJobModel.init();

    const indexes = await NotificationJobModel.collection.indexes();
    expect(indexes.map((index) => index.key)).toContainEqual({ status: 1, createdAt: 1 });
  });
});
