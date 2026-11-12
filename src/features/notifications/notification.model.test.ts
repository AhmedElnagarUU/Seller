import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { NotificationModel } from "@/features/notifications/notification.model";

function buildFields(overrides: Record<string, unknown> = {}) {
  return {
    userId: new Types.ObjectId(),
    type: "announcement",
    title: "Winter sale",
    body: "All themes are 20% off.",
    ...overrides,
  };
}

// Saves a notification from loose test input (the tests also pass values that the types refuse).
async function saveNotification(fields: Record<string, unknown>) {
  const notification = new NotificationModel();
  notification.set(fields);
  return notification.save();
}

// The names of the fields that a ValidationError complains about.
async function refusedKeysOf(fields: Record<string, unknown>): Promise<string[]> {
  const error: unknown = await saveNotification(fields).then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toMatchObject({ name: "ValidationError" });
  const errors = typeof error === "object" && error !== null && "errors" in error ? error.errors : {};
  return Object.keys(errors ?? {});
}

describe("notification model", () => {
  it("refuses a second notification with the same job and user", async () => {
    await NotificationModel.init();
    const userId = new Types.ObjectId();
    const jobId = new Types.ObjectId();
    await saveNotification(buildFields({ userId, jobId }));

    await expect(saveNotification(buildFields({ userId, jobId }))).rejects.toMatchObject({ code: 11000 });
    expect(await NotificationModel.countDocuments()).toBe(1);
  });

  it("allows the same job for two different users", async () => {
    await NotificationModel.init();
    const jobId = new Types.ObjectId();

    await saveNotification(buildFields({ jobId }));
    await saveNotification(buildFields({ jobId }));

    expect(await NotificationModel.countDocuments({ jobId })).toBe(2);
  });

  it("allows many notifications without a job", async () => {
    await NotificationModel.init();
    const userId = new Types.ObjectId();

    await saveNotification(buildFields({ userId, jobId: null }));
    await saveNotification(buildFields({ userId, jobId: null }));

    expect(await NotificationModel.countDocuments({ userId, jobId: null })).toBe(2);
  });

  it("saves defaults", async () => {
    const created = await saveNotification(buildFields());

    const saved = await NotificationModel.findById(created._id).lean();
    expect(saved?.title).toBe("Winter sale");
    expect(saved?.readAt).toBeNull();
    expect(saved?.link).toBeNull();
    expect(saved?.jobId).toBeNull();
  });

  it("refuses a title of 1 and of 121 characters and a body of 1 and of 1001 characters", async () => {
    expect(await refusedKeysOf(buildFields({ title: "a" }))).toEqual(["title"]);
    expect(await refusedKeysOf(buildFields({ title: "a".repeat(121) }))).toEqual(["title"]);
    expect(await refusedKeysOf(buildFields({ body: "b" }))).toEqual(["body"]);
    expect(await refusedKeysOf(buildFields({ body: "b".repeat(1001) }))).toEqual(["body"]);
    expect(await NotificationModel.countDocuments()).toBe(0);

    await saveNotification(buildFields({ title: "a".repeat(120), body: "b".repeat(1000) }));
    expect(await NotificationModel.countDocuments()).toBe(1);
  });

  it("refuses a link that is not an internal path", async () => {
    expect(await refusedKeysOf(buildFields({ link: "//evil.com" }))).toEqual(["link"]);
    expect(await refusedKeysOf(buildFields({ link: "account" }))).toEqual(["link"]);
    expect(await refusedKeysOf(buildFields({ link: `/${"a".repeat(300)}` }))).toEqual(["link"]);
    expect(await NotificationModel.countDocuments()).toBe(0);

    const created = await saveNotification(buildFields({ link: "/account/themes" }));
    const saved = await NotificationModel.findById(created._id).lean();
    expect(saved?.link).toBe("/account/themes");
  });

  it("refuses an unknown type", async () => {
    expect(await refusedKeysOf(buildFields({ type: "sms" }))).toEqual(["type"]);
    expect(await NotificationModel.countDocuments()).toBe(0);
  });

  it("deletes rows after one year", async () => {
    await NotificationModel.init();

    const indexes = await NotificationModel.collection.indexes();
    const retentionIndex = indexes.find((index) => index.expireAfterSeconds !== undefined);
    const uniqueIndex = indexes.find((index) => index.unique === true);
    expect(retentionIndex?.key).toEqual({ createdAt: 1 });
    expect(retentionIndex?.expireAfterSeconds).toBe(31536000);
    expect(uniqueIndex?.key).toEqual({ jobId: 1, userId: 1 });
    expect(uniqueIndex?.partialFilterExpression).toEqual({ jobId: { $type: "objectId" } });
  });
});
