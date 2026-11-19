import { Types } from "mongoose";
import { beforeAll, describe, expect, it } from "vitest";
import { withTransaction } from "@/shared/db/transaction";
import { setTestNow } from "@/shared/lib/clock";
import { createUser } from "@/shared/test/factories";
import { NotificationModel } from "@/features/notifications/notification.model";
import {
  countUnreadNotifications,
  createNotification,
  findNotifiedUserIds,
  insertNotificationsForJob,
  listNotifications,
  markAllNotificationsRead,
  openNotification,
} from "@/features/notifications/notification.service";
import type { NewNotification } from "@/features/notifications/notification-message.service";
import type { NotificationType } from "@/features/notifications/notification.constants";

const NOW = new Date("2026-11-01T10:00:00Z");

beforeAll(async () => {
  // The unique { jobId, userId } index must exist before the tests rely on it.
  await NotificationModel.init();
});

type SavedFields = {
  type?: NotificationType;
  title?: string;
  link?: string | null;
  readAt?: Date | null;
  createdAt?: Date;
};

async function saveNotification(userId: Types.ObjectId, fields: SavedFields = {}) {
  const notification = await NotificationModel.create({
    userId,
    type: "announcement",
    title: "Big sale",
    body: "Everything is cheaper this week.",
    link: "/themes",
    readAt: null,
    ...fields,
  });
  return notification.toObject();
}

describe("createNotification", () => {
  it("saves the notification with readAt null, jobId null and createdAt = now", async () => {
    setTestNow(NOW);
    const user = await createUser();

    await createNotification({
      userId: user._id.toString(),
      type: "wallet_payment_approved",
      title: "Payment approved: Aurora",
      body: "Your payment was confirmed.",
      link: "/account/themes",
    });

    const saved = await NotificationModel.find().lean();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.userId.toString()).toBe(user._id.toString());
    expect(saved[0]?.type).toBe("wallet_payment_approved");
    expect(saved[0]?.title).toBe("Payment approved: Aurora");
    expect(saved[0]?.body).toBe("Your payment was confirmed.");
    expect(saved[0]?.link).toBe("/account/themes");
    expect(saved[0]?.readAt).toBeNull();
    expect(saved[0]?.jobId).toBeNull();
    expect(saved[0]?.createdAt).toEqual(NOW);
  });

  it("saves nothing when the surrounding transaction throws", async () => {
    const user = await createUser();
    await NotificationModel.createCollection();

    await expect(
      withTransaction(async (session) => {
        await createNotification(
          { userId: user._id.toString(), type: "announcement", title: "Hello", body: "A message.", link: null },
          session,
        );
        throw new Error("boom");
      }),
    ).rejects.toThrowError("boom");

    expect(await NotificationModel.countDocuments()).toBe(0);
  });
});

describe("listNotifications", () => {
  it("returns only the user's notifications, newest first, with isRead and unreadCount", async () => {
    const user = await createUser();
    const other = await createUser();
    await saveNotification(user._id, { title: "Oldest", createdAt: new Date("2026-10-01T10:00:00Z") });
    await saveNotification(user._id, {
      title: "Middle",
      createdAt: new Date("2026-10-02T10:00:00Z"),
      readAt: new Date("2026-10-03T10:00:00Z"),
    });
    await saveNotification(user._id, { title: "Newest", createdAt: new Date("2026-10-04T10:00:00Z") });
    await saveNotification(other._id, { title: "Someone else's" });

    const page = await listNotifications(user._id.toString(), 1);

    expect(page.items.map((item) => item.title)).toEqual(["Newest", "Middle", "Oldest"]);
    expect(page.items.map((item) => item.isRead)).toEqual([false, true, false]);
    expect(page.items[0]?.createdAt).toEqual(new Date("2026-10-04T10:00:00Z"));
    expect(page.unreadCount).toBe(2);
    expect(page.total).toBe(3);
    expect(page.page).toBe(1);
    expect(page.totalPages).toBe(1);
  });

  it("with 25 notifications page 1 has 20, page 2 has 5 and totalPages is 2", async () => {
    const user = await createUser();
    const times = Array.from({ length: 25 }, (_, index) => new Date(NOW.getTime() + index * 60_000));
    await NotificationModel.insertMany(
      times.map((createdAt, index) => ({
        userId: user._id,
        type: "announcement",
        title: `Message ${index}`,
        body: "A message.",
        link: null,
        readAt: null,
        createdAt,
      })),
    );

    const first = await listNotifications(user._id.toString(), 1);
    const second = await listNotifications(user._id.toString(), 2);

    expect(first.items).toHaveLength(20);
    expect(first.items[0]?.title).toBe("Message 24");
    expect(second.items).toHaveLength(5);
    expect(second.items[4]?.title).toBe("Message 0");
    expect(first.totalPages).toBe(2);
    expect(second.totalPages).toBe(2);
    expect(second.page).toBe(2);
    expect(second.total).toBe(25);
    expect(second.unreadCount).toBe(25);
  });
});

describe("countUnreadNotifications", () => {
  it("counts only this user's unread ones", async () => {
    const user = await createUser();
    const other = await createUser();
    await saveNotification(user._id);
    await saveNotification(user._id);
    await saveNotification(user._id, { readAt: NOW });
    await saveNotification(other._id);

    expect(await countUnreadNotifications(user._id.toString())).toBe(2);
    expect(await countUnreadNotifications(other._id.toString())).toBe(1);
  });
});

describe("openNotification", () => {
  it("sets readAt to now and returns the link; a second call keeps the first readAt; a notification without link returns { link: null }", async () => {
    const user = await createUser();
    const withLink = await saveNotification(user._id, { link: "/account/themes" });
    const withoutLink = await saveNotification(user._id, { link: null });
    setTestNow(NOW);

    const first = await openNotification(user._id.toString(), withLink._id.toString());
    setTestNow(new Date("2026-11-02T10:00:00Z"));
    const second = await openNotification(user._id.toString(), withLink._id.toString());
    const noLink = await openNotification(user._id.toString(), withoutLink._id.toString());

    expect(first).toEqual({ link: "/account/themes" });
    expect(second).toEqual({ link: "/account/themes" });
    expect(noLink).toEqual({ link: null });
    const saved = await NotificationModel.findById(withLink._id).lean();
    expect(saved?.readAt).toEqual(NOW);
    const savedWithoutLink = await NotificationModel.findById(withoutLink._id).lean();
    expect(savedWithoutLink?.readAt).toEqual(new Date("2026-11-02T10:00:00Z"));
  });

  it("another user's notification and an invalid id return null and change nothing", async () => {
    const user = await createUser();
    const other = await createUser();
    const foreign = await saveNotification(other._id);
    setTestNow(NOW);

    const foreignResult = await openNotification(user._id.toString(), foreign._id.toString());
    const invalidResult = await openNotification(user._id.toString(), "not-an-id");
    const unknownResult = await openNotification(user._id.toString(), new Types.ObjectId().toString());

    expect(foreignResult).toBeNull();
    expect(invalidResult).toBeNull();
    expect(unknownResult).toBeNull();
    const saved = await NotificationModel.findById(foreign._id).lean();
    expect(saved?.readAt).toBeNull();
  });
});

describe("markAllNotificationsRead", () => {
  it("marks only the user's unread notifications and returns the count; other users' stay unread", async () => {
    const user = await createUser();
    const other = await createUser();
    const alreadyRead = new Date("2026-10-01T10:00:00Z");
    await saveNotification(user._id);
    await saveNotification(user._id);
    await saveNotification(user._id, { readAt: alreadyRead });
    await saveNotification(other._id);
    setTestNow(NOW);

    const count = await markAllNotificationsRead(user._id.toString());

    expect(count).toBe(2);
    const own = await NotificationModel.find({ userId: user._id }).lean();
    expect(own.map((notification) => notification.readAt?.getTime()).sort()).toEqual(
      [alreadyRead.getTime(), NOW.getTime(), NOW.getTime()].sort(),
    );
    const foreign = await NotificationModel.find({ userId: other._id }).lean();
    expect(foreign[0]?.readAt).toBeNull();
    expect(await markAllNotificationsRead(user._id.toString())).toBe(0);
  });
});

function buildJobNotification(userId: Types.ObjectId, jobId: Types.ObjectId): NewNotification {
  return {
    userId: userId.toString(),
    type: "owned_theme_updated",
    title: "Aurora Blog 1.1.0 is available",
    body: "Fixed the footer",
    link: "/account/themes",
    jobId: jobId.toString(),
  };
}

describe("insertNotificationsForJob", () => {
  it("returns the number inserted; a repeated insert of the same users inserts nothing new and does not throw", async () => {
    setTestNow(NOW);
    const first = await createUser();
    const second = await createUser();
    const jobId = new Types.ObjectId();
    const notifications = [buildJobNotification(first._id, jobId), buildJobNotification(second._id, jobId)];

    const inserted = await insertNotificationsForJob(notifications);
    const repeated = await insertNotificationsForJob(notifications);

    expect(inserted).toBe(2);
    expect(repeated).toBe(2);
    const saved = await NotificationModel.find({ jobId }).lean();
    expect(saved).toHaveLength(2);
    expect(saved[0]?.title).toBe("Aurora Blog 1.1.0 is available");
    expect(saved[0]?.readAt).toBeNull();
    expect(saved[0]?.createdAt).toEqual(NOW);
  });

  it("inserts the new users and skips the one that already has a notification of the job", async () => {
    const existing = await createUser();
    const fresh = await createUser();
    const jobId = new Types.ObjectId();
    await insertNotificationsForJob([buildJobNotification(existing._id, jobId)]);

    const count = await insertNotificationsForJob([
      buildJobNotification(existing._id, jobId),
      buildJobNotification(fresh._id, jobId),
    ]);

    expect(count).toBe(2);
    expect(await NotificationModel.countDocuments({ jobId })).toBe(2);
  });

  it("returns 0 for an empty list", async () => {
    expect(await insertNotificationsForJob([])).toBe(0);
    expect(await NotificationModel.countDocuments()).toBe(0);
  });
});

describe("findNotifiedUserIds", () => {
  it("returns the users that have a notification of this job, and only those", async () => {
    const notified = await createUser();
    const notNotified = await createUser();
    const notifiedForOtherJob = await createUser();
    const jobId = new Types.ObjectId();
    await insertNotificationsForJob([buildJobNotification(notified._id, jobId)]);
    await insertNotificationsForJob([buildJobNotification(notifiedForOtherJob._id, new Types.ObjectId())]);

    const found = await findNotifiedUserIds(jobId.toString(), [
      notified._id.toString(),
      notNotified._id.toString(),
      notifiedForOtherJob._id.toString(),
      "not-an-id",
    ]);

    expect([...found]).toEqual([notified._id.toString()]);
  });
});
