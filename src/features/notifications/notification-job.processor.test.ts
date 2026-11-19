import { Types } from "mongoose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { EmailRateLimitError } from "@/features/emails/email.types";
import { NotificationModel } from "@/features/notifications/notification.model";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import { processNotificationJobs } from "@/features/notifications/notification-job.processor";
import { setTestNow } from "@/shared/lib/clock";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";
import {
  createAdmin,
  createCategory,
  createFavorite,
  createNotificationJob,
  createOwnersForTheme,
  createOwnership,
  createTheme,
  createUser,
  createVersion,
} from "@/shared/test/factories";

const NOW = new Date("2026-11-01T10:00:00Z");

beforeAll(async () => {
  // The unique { jobId, userId } index must exist before the tests rely on it.
  await NotificationModel.init();
});

// The common setup: the theme "Aurora Blog" with version 1.1.0 and a pending "version released" job.
async function setupVersionJob() {
  setTestNow(NOW);
  const theme = await createTheme({ name: "Aurora Blog", slug: "aurora-blog", status: "published" });
  const themeId = theme._id.toString();
  const version = await createVersion(themeId, {
    version: "1.1.0",
    changes: [{ type: "fixed", text: "Fixed the footer" }],
  });
  const job = await createNotificationJob({ themeId: theme._id, versionId: version._id });
  return { theme, themeId, version, job, jobId: job._id.toString() };
}

async function savedJob(jobId: string) {
  const job = await NotificationJobModel.findById(jobId).lean();
  if (!job) throw new Error("The job is missing.");
  return job;
}

async function notificationsOf(userId: Types.ObjectId) {
  return NotificationModel.find({ userId }).lean();
}

describe("processNotificationJobs", () => {
  it("notifies active owners, then favoriters; a user who is both gets one notification (owned_theme_updated) and one email", async () => {
    const { themeId, jobId } = await setupVersionJob();
    const ownerA = await createUser({ email: "a@example.com" });
    const ownerB = await createUser({ email: "b@example.com" });
    const favoriterC = await createUser({ email: "c@example.com" });
    await createOwnership(ownerA._id.toString(), themeId);
    await createOwnership(ownerB._id.toString(), themeId);
    await createFavorite(ownerA._id.toString(), "theme", themeId);
    await createFavorite(favoriterC._id.toString(), "theme", themeId);

    const result = await processNotificationJobs();

    expect(result).toEqual({ processedBatches: 4, finishedJobs: 1 });
    const notificationA = await notificationsOf(ownerA._id);
    const notificationB = await notificationsOf(ownerB._id);
    const notificationC = await notificationsOf(favoriterC._id);
    expect(notificationA).toHaveLength(1);
    expect(notificationB).toHaveLength(1);
    expect(notificationC).toHaveLength(1);
    expect(notificationA[0]?.type).toBe("owned_theme_updated");
    expect(notificationB[0]?.type).toBe("owned_theme_updated");
    expect(notificationC[0]?.type).toBe("favorite_theme_updated");
    expect(notificationA[0]?.title).toBe("Aurora Blog 1.1.0 is available");
    expect(notificationC[0]?.title).toBe("Aurora Blog 1.1.0 is out");
    expect(notificationA[0]?.body).toBe("Fixed the footer");
    expect(notificationA[0]?.link).toBe("/account/themes");
    expect(notificationC[0]?.link).toBe("/themes/aurora-blog");
    expect(notificationA[0]?.jobId?.toString()).toBe(jobId);
    expect(notificationC[0]?.jobId?.toString()).toBe(jobId);
    expect(notificationA[0]?.readAt).toBeNull();
    expect(await NotificationModel.countDocuments()).toBe(3);
    expect(fakeEmailSender.sent.map((email) => email.to).sort()).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ]);
    expect(fakeEmailSender.sent.find((email) => email.to === "a@example.com")?.subject).toBe(
      "Aurora Blog 1.1.0 is available",
    );
    expect(fakeEmailSender.sent.find((email) => email.to === "c@example.com")?.subject).toBe(
      "Aurora Blog 1.1.0 is out",
    );
    const job = await savedJob(jobId);
    expect(job.status).toBe("done");
    expect(job.finishedAt).toEqual(NOW);
    expect(job.notifiedCount).toBe(3);
    expect(job.emailedCount).toBe(3);
    expect(job.lockedUntil).toBeNull();
  });

  it("skips revoked owners, disabled users and admins", async () => {
    const { themeId, jobId } = await setupVersionJob();
    const normal = await createUser({ email: "normal@example.com" });
    const revoked = await createUser({ email: "revoked@example.com" });
    const disabled = await createUser({ email: "disabled@example.com", disabled: true });
    const admin = await createAdmin();
    await createOwnership(normal._id.toString(), themeId);
    await createOwnership(revoked._id.toString(), themeId, {
      status: "revoked",
      revokedAt: NOW,
      revokedReason: "admin",
      revokedByUserId: new Types.ObjectId(),
      revokeNote: "Chargeback",
    });
    await createOwnership(disabled._id.toString(), themeId);
    await createOwnership(admin._id.toString(), themeId);

    await processNotificationJobs();

    const saved = await NotificationModel.find().lean();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.userId.toString()).toBe(normal._id.toString());
    expect(fakeEmailSender.sent.map((email) => email.to)).toEqual(["normal@example.com"]);
    const job = await savedJob(jobId);
    expect(job.notifiedCount).toBe(1);
    expect(job.emailedCount).toBe(1);
  });

  it("sends emails only to users with the matching switch on and still creates in-app notifications for the others", async () => {
    const { themeId } = await setupVersionJob();
    const wantsEmail = await createUser({ email: "wants@example.com" });
    const noEmail = await createUser({ email: "no@example.com", emailOwnedThemeUpdates: false });
    await createOwnership(wantsEmail._id.toString(), themeId);
    await createOwnership(noEmail._id.toString(), themeId);

    await processNotificationJobs();

    expect(await NotificationModel.countDocuments()).toBe(2);
    expect((await notificationsOf(noEmail._id))[0]?.type).toBe("owned_theme_updated");
    expect(fakeEmailSender.sent.map((email) => email.to)).toEqual(["wants@example.com"]);
  });

  it("a favoriter with emailFavoriteThemeUpdates: false gets the notification but no email", async () => {
    const { themeId, jobId } = await setupVersionJob();
    const favoriter = await createUser({ emailFavoriteThemeUpdates: false });
    await createFavorite(favoriter._id.toString(), "theme", themeId);

    await processNotificationJobs();

    const saved = await notificationsOf(favoriter._id);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.type).toBe("favorite_theme_updated");
    expect(fakeEmailSender.sent).toHaveLength(0);
    const job = await savedJob(jobId);
    expect(job.notifiedCount).toBe(1);
    expect(job.emailedCount).toBe(0);
  });

  it("theme published: category followers get category_new_theme with title 'New in <Category>: Aurora Blog' and an email with the same subject; the switch emailFollowedCategoryThemes: false removes only the email", async () => {
    setTestNow(NOW);
    const category = await createCategory({ name: "Blog" });
    const theme = await createTheme({
      name: "Aurora Blog",
      slug: "aurora-blog",
      status: "published",
      categoryId: category._id,
    });
    await createNotificationJob({ kind: "theme_published", themeId: theme._id });
    const follower = await createUser({ email: "follower@example.com" });
    const quietFollower = await createUser({ email: "quiet@example.com", emailFollowedCategoryThemes: false });
    await createFavorite(follower._id.toString(), "category", category._id.toString());
    await createFavorite(quietFollower._id.toString(), "category", category._id.toString());

    const result = await processNotificationJobs();

    expect(result).toEqual({ processedBatches: 2, finishedJobs: 1 });
    const saved = await NotificationModel.find().lean();
    expect(saved).toHaveLength(2);
    for (const notification of saved) {
      expect(notification.type).toBe("category_new_theme");
      expect(notification.title).toBe("New in Blog: Aurora Blog");
      expect(notification.link).toBe("/themes/aurora-blog");
    }
    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.to).toBe("follower@example.com");
    expect(fakeEmailSender.sent[0]?.subject).toBe("New in Blog: Aurora Blog");
  });

  it("announcement with sendEmail: false creates the notifications and sends 0 emails; with sendEmail: true only users with emailAnnouncements get an email", async () => {
    setTestNow(NOW);
    const admin = await createAdmin();
    const first = await createUser({ email: "first@example.com" });
    const second = await createUser({ email: "second@example.com", emailAnnouncements: false });
    const announcement = { link: "/themes" };
    const quietJob = await createNotificationJob({
      kind: "announcement",
      createdByUserId: admin._id,
      announcement: { ...announcement, sendEmail: false },
    });

    await processNotificationJobs();

    const quietSaved = await NotificationModel.find({ jobId: quietJob._id }).lean();
    expect(quietSaved).toHaveLength(2);
    for (const notification of quietSaved) {
      expect(notification.type).toBe("announcement");
      expect(notification.title).toBe("Big sale");
      expect(notification.body).toBe("Everything is cheaper this week.");
      expect(notification.link).toBe("/themes");
    }
    expect(fakeEmailSender.sent).toHaveLength(0);

    const loudJob = await createNotificationJob({
      kind: "announcement",
      createdByUserId: admin._id,
      announcement: { ...announcement, sendEmail: true },
    });

    await processNotificationJobs();

    expect(await NotificationModel.countDocuments({ jobId: loudJob._id })).toBe(2);
    expect(await notificationsOf(second._id)).toHaveLength(2);
    expect(await notificationsOf(first._id)).toHaveLength(2);
    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.to).toBe("first@example.com");
    expect(fakeEmailSender.sent[0]?.subject).toBe("Big sale");
  });

  it("announcement for theme_owners reaches only the active owners of that theme (not other users, not favoriters, not revoked owners)", async () => {
    setTestNow(NOW);
    const admin = await createAdmin();
    const theme = await createTheme({ status: "published" });
    const otherTheme = await createTheme({ status: "published" });
    const owner = await createUser();
    const revoked = await createUser();
    const favoriter = await createUser();
    const stranger = await createUser();
    const ownerOfOtherTheme = await createUser();
    await createOwnership(owner._id.toString(), theme._id.toString());
    await createOwnership(revoked._id.toString(), theme._id.toString(), {
      status: "revoked",
      revokedAt: NOW,
      revokedReason: "admin",
      revokedByUserId: new Types.ObjectId(),
      revokeNote: "Chargeback",
    });
    await createOwnership(ownerOfOtherTheme._id.toString(), otherTheme._id.toString());
    await createFavorite(favoriter._id.toString(), "theme", theme._id.toString());
    const job = await createNotificationJob({
      kind: "announcement",
      createdByUserId: admin._id,
      announcement: { audience: "theme_owners", audienceThemeId: theme._id },
    });

    const result = await processNotificationJobs();

    expect(result).toEqual({ processedBatches: 2, finishedJobs: 1 });
    const saved = await NotificationModel.find().lean();
    expect(saved.map((notification) => notification.userId.toString())).toEqual([owner._id.toString()]);
    expect(await notificationsOf(stranger._id)).toHaveLength(0);
    expect((await savedJob(job._id.toString())).notifiedCount).toBe(1);
  });

  it("announcement for all_customers reaches every enabled non-admin user; for one_customer only that user", async () => {
    setTestNow(NOW);
    const admin = await createAdmin();
    const first = await createUser();
    const second = await createUser();
    await createUser({ disabled: true });
    await createNotificationJob({ kind: "announcement", createdByUserId: admin._id });

    await processNotificationJobs();

    const saved = await NotificationModel.find().lean();
    expect(saved.map((notification) => notification.userId.toString()).sort()).toEqual(
      [first._id.toString(), second._id.toString()].sort(),
    );

    await NotificationModel.deleteMany({});
    await createNotificationJob({
      kind: "announcement",
      createdByUserId: admin._id,
      announcement: { audience: "one_customer", audienceUserId: second._id },
    });

    const result = await processNotificationJobs();

    expect(result).toEqual({ processedBatches: 2, finishedJobs: 1 });
    const savedForOne = await NotificationModel.find().lean();
    expect(savedForOne.map((notification) => notification.userId.toString())).toEqual([second._id.toString()]);
  });

  it("processes 250 owners in 3 data batches", async () => {
    const { themeId, jobId } = await setupVersionJob();
    await createOwnersForTheme(themeId, 250);

    const result = await processNotificationJobs();

    expect(result).toEqual({ processedBatches: 5, finishedJobs: 1 });
    const job = await savedJob(jobId);
    expect(job.status).toBe("done");
    expect(job.finishedAt).toEqual(NOW);
    expect(job.notifiedCount).toBe(250);
    expect(job.emailedCount).toBe(250);
    expect(await NotificationModel.countDocuments({ jobId: job._id })).toBe(250);
    expect(fakeEmailSender.sent).toHaveLength(250);
    expect(new Set(fakeEmailSender.sent.map((email) => email.idempotencyKey)).size).toBe(3);
  });

  it("does not notify a user twice for one job: a user who already has a notification for the job gets neither a second notification nor an email", async () => {
    const { themeId, job, jobId } = await setupVersionJob();
    const alreadyNotified = await createUser({ email: "done@example.com" });
    const fresh = await createUser({ email: "fresh@example.com" });
    await createOwnership(alreadyNotified._id.toString(), themeId);
    await createOwnership(fresh._id.toString(), themeId);
    await NotificationModel.create({
      userId: alreadyNotified._id,
      type: "owned_theme_updated",
      title: "Aurora Blog 1.1.0 is available",
      body: "Fixed the footer",
      link: "/account/themes",
      jobId: job._id,
    });

    await processNotificationJobs();

    expect(await notificationsOf(alreadyNotified._id)).toHaveLength(1);
    expect(await notificationsOf(fresh._id)).toHaveLength(1);
    expect(fakeEmailSender.sent.map((email) => email.to)).toEqual(["fresh@example.com"]);
    const saved = await savedJob(jobId);
    expect(saved.notifiedCount).toBe(1);
    expect(saved.emailedCount).toBe(1);
  });

  it("a job locked by another run is not picked; after the lock expires it is picked and finished", async () => {
    setTestNow(NOW);
    const theme = await createTheme({ status: "published" });
    const owner = await createUser();
    await createOwnership(owner._id.toString(), theme._id.toString());
    const lockedUntil = new Date(NOW.getTime() + 60_000);
    const job = await createNotificationJob({ themeId: theme._id, lockedUntil });

    const lockedResult = await processNotificationJobs();

    expect(lockedResult).toEqual({ processedBatches: 0, finishedJobs: 0 });
    const untouched = await savedJob(job._id.toString());
    expect(untouched.status).toBe("pending");
    expect(untouched.lockedUntil).toEqual(lockedUntil);
    expect(await NotificationModel.countDocuments()).toBe(0);

    setTestNow(new Date(lockedUntil.getTime() + 1000));
    const freeResult = await processNotificationJobs();

    expect(freeResult).toEqual({ processedBatches: 3, finishedJobs: 1 });
    expect((await savedJob(job._id.toString())).status).toBe("done");
    expect(await NotificationModel.countDocuments()).toBe(1);
  });

  it("an email failure leaves the cursor unchanged, adds 1 to attempts, stores the message in error, releases the lock and writes 0 notifications; the run stops after that batch", async () => {
    const { themeId, jobId } = await setupVersionJob();
    const owner = await createUser();
    await createOwnership(owner._id.toString(), themeId);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakeEmailSender.failNext(new Error("EMAIL_SEND_FAILED"));

    const result = await processNotificationJobs();

    expect(result).toEqual({ processedBatches: 1, finishedJobs: 0 });
    const job = await savedJob(jobId);
    expect(job.cursor).toBeNull();
    expect(job.attempts).toBe(1);
    expect(job.error).toBe("EMAIL_SEND_FAILED");
    expect(job.lockedUntil).toBeNull();
    expect(job.status).toBe("running");
    expect(job.stage).toBe("theme_owners");
    expect(job.notifiedCount).toBe(0);
    expect(await NotificationModel.countDocuments()).toBe(0);
    expect(fakeEmailSender.sent).toHaveLength(0);
    expect(consoleError).toHaveBeenCalledWith("notification batch failed", jobId);
    consoleError.mockRestore();
  });

  it("after 5 failed runs the job is failed with finishedAt now and attempts 5; a 6th run picks nothing", async () => {
    const { themeId, jobId } = await setupVersionJob();
    const owner = await createUser();
    await createOwnership(owner._id.toString(), themeId);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    for (let run = 1; run <= 5; run += 1) {
      fakeEmailSender.failNext(new Error("EMAIL_SEND_FAILED"));
      expect(await processNotificationJobs()).toEqual({ processedBatches: 1, finishedJobs: 0 });
    }

    const job = await savedJob(jobId);
    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(5);
    expect(job.finishedAt).toEqual(NOW);
    expect(job.error).toBe("EMAIL_SEND_FAILED");
    expect(await processNotificationJobs()).toEqual({ processedBatches: 0, finishedJobs: 0 });
    expect(await NotificationModel.countDocuments()).toBe(0);
    consoleError.mockRestore();
  });

  it("EmailRateLimitError stops the run without adding to attempts; the lock is released, no notification is written, and the next run finishes the job", async () => {
    const { themeId, jobId } = await setupVersionJob();
    const owner = await createUser();
    await createOwnership(owner._id.toString(), themeId);
    fakeEmailSender.failNext(new EmailRateLimitError("EMAIL_RATE_LIMITED"));

    const limited = await processNotificationJobs();

    expect(limited).toEqual({ processedBatches: 1, finishedJobs: 0 });
    const afterLimit = await savedJob(jobId);
    expect(afterLimit.attempts).toBe(0);
    expect(afterLimit.error).toBeNull();
    expect(afterLimit.lockedUntil).toBeNull();
    expect(afterLimit.cursor).toBeNull();
    expect(await NotificationModel.countDocuments()).toBe(0);

    const next = await processNotificationJobs();

    expect(next).toEqual({ processedBatches: 3, finishedJobs: 1 });
    expect((await savedJob(jobId)).status).toBe("done");
    expect(await NotificationModel.countDocuments()).toBe(1);
    expect(fakeEmailSender.sent).toHaveLength(1);
  });

  it("the retry of a failed batch uses the same idempotency key", async () => {
    const { themeId, jobId } = await setupVersionJob();
    const owner = await createUser();
    const ownership = await createOwnership(owner._id.toString(), themeId);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakeEmailSender.failNext(new Error("EMAIL_SEND_FAILED"));

    await processNotificationJobs();
    await processNotificationJobs();

    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.idempotencyKey).toBe(`job-${jobId}-theme_owners-${ownership._id.toString()}`);
    consoleError.mockRestore();
  });

  it("claims the oldest open job first", async () => {
    setTestNow(NOW);
    const newerTheme = await createTheme({ status: "published" });
    const olderTheme = await createTheme({ status: "published" });
    const newerOwner = await createUser({ email: "newer@example.com" });
    const olderOwner = await createUser({ email: "older@example.com" });
    await createOwnership(newerOwner._id.toString(), newerTheme._id.toString());
    await createOwnership(olderOwner._id.toString(), olderTheme._id.toString());
    const newerJob = await createNotificationJob({
      themeId: newerTheme._id,
      createdAt: new Date("2026-10-31T12:00:00Z"),
    });
    const olderJob = await createNotificationJob({
      themeId: olderTheme._id,
      createdAt: new Date("2026-10-30T12:00:00Z"),
    });

    const result = await processNotificationJobs();

    expect(result).toEqual({ processedBatches: 6, finishedJobs: 2 });
    expect(fakeEmailSender.sent.map((email) => email.to)).toEqual(["older@example.com", "newer@example.com"]);
    expect((await savedJob(olderJob._id.toString())).status).toBe("done");
    expect((await savedJob(newerJob._id.toString())).status).toBe("done");
  });
});
