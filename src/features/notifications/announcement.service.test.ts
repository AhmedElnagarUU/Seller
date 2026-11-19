import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { listAnnouncementJobs, sendAnnouncement } from "@/features/notifications/announcement.service";
import type { AnnouncementInput } from "@/features/notifications/announcement.types";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import { retryNotificationJob } from "@/features/notifications/notification-job.service";
import { NotificationModel } from "@/features/notifications/notification.model";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";
import { createAdmin, createNotificationJob, createTheme, createUser } from "@/shared/test/factories";

function buildInput(overrides: Partial<AnnouncementInput> = {}): AnnouncementInput {
  return {
    title: "Winter sale",
    body: "All themes are 20% off.",
    link: "/themes",
    audience: "all_customers",
    themeId: null,
    customerEmail: null,
    sendEmail: true,
    ...overrides,
  };
}

describe("sendAnnouncement", () => {
  it("queues one pending job and logs it, and sends nothing", async () => {
    const admin = await createAdmin();
    const adminId = admin._id.toString();
    await createUser();

    const result = await sendAnnouncement(buildInput(), adminId);

    const jobs = await NotificationJobModel.find().lean();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?._id.toString()).toBe(result.id);
    expect(jobs[0]?.kind).toBe("announcement");
    expect(jobs[0]?.status).toBe("pending");
    expect(jobs[0]?.announcement).toEqual({
      title: "Winter sale",
      body: "All themes are 20% off.",
      link: "/themes",
      sendEmail: true,
      audience: "all_customers",
      audienceThemeId: null,
      audienceUserId: null,
    });
    expect(jobs[0]?.createdByUserId.toString()).toBe(adminId);
    const logs = await ActivityLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("announcement_sent");
    expect(logs[0]?.actorRole).toBe("admin");
    expect(logs[0]?.actorUserId?.toString()).toBe(adminId);
    expect(logs[0]?.subjectUserId).toBeNull();
    expect(logs[0]?.targetType).toBe("notification_job");
    expect(logs[0]?.targetId?.toString()).toBe(result.id);
    expect(logs[0]?.summary).toBe("Announcement sent: Winter sale");
    expect(await NotificationModel.countDocuments()).toBe(0);
    expect(fakeEmailSender.sent).toEqual([]);
  });

  it("stores the theme of an owners announcement", async () => {
    const admin = await createAdmin();
    const theme = await createTheme({ status: "draft" });

    await sendAnnouncement(
      buildInput({ audience: "theme_owners", themeId: theme._id.toString() }),
      admin._id.toString(),
    );

    const job = await NotificationJobModel.findOne().lean();
    expect(job?.announcement.audience).toBe("theme_owners");
    expect(job?.announcement.audienceThemeId?.toString()).toBe(theme._id.toString());
    expect(job?.stage).toBe("theme_owners");
  });

  it("refuses an unknown theme and an unknown customer email", async () => {
    const admin = await createAdmin();
    const adminId = admin._id.toString();

    await expect(
      sendAnnouncement(buildInput({ audience: "theme_owners", themeId: new Types.ObjectId().toString() }), adminId),
    ).rejects.toMatchObject({ code: "INVALID", message: "Choose a theme." });
    await expect(
      sendAnnouncement(buildInput({ audience: "one_customer", customerEmail: "nobody@example.com" }), adminId),
    ).rejects.toMatchObject({ code: "INVALID", message: "No customer with this email." });

    expect(await NotificationJobModel.countDocuments()).toBe(0);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("finds the customer by email ignoring case and spaces", async () => {
    const admin = await createAdmin();
    const customer = await createUser({ email: "ann@example.com" });

    await sendAnnouncement(
      buildInput({ audience: "one_customer", customerEmail: "  ANN@Example.com " }),
      admin._id.toString(),
    );

    const job = await NotificationJobModel.findOne().lean();
    expect(job?.announcement.audience).toBe("one_customer");
    expect(job?.announcement.audienceUserId?.toString()).toBe(customer._id.toString());
    const log = await ActivityLogModel.findOne().lean();
    expect(log?.subjectUserId?.toString()).toBe(customer._id.toString());
  });
});

describe("listAnnouncementJobs", () => {
  it("lists only announcement jobs, newest first, with audience labels and the error of failed jobs", async () => {
    const theme = await createTheme({ name: "Aurora Blog" });
    const customer = await createUser({ email: "ann@example.com" });
    const first = await createNotificationJob({
      kind: "announcement",
      createdAt: new Date("2026-10-01T10:00:00Z"),
      announcement: { title: "First", audience: "all_customers" },
    });
    const second = await createNotificationJob({
      kind: "announcement",
      status: "failed",
      attempts: 5,
      error: "Email service is down",
      notifiedCount: 40,
      emailedCount: 12,
      createdAt: new Date("2026-10-02T10:00:00Z"),
      announcement: { title: "Second", audience: "theme_owners", audienceThemeId: theme._id },
    });
    const third = await createNotificationJob({
      kind: "announcement",
      status: "done",
      error: "Old error",
      createdAt: new Date("2026-10-03T10:00:00Z"),
      announcement: { title: "Third", audience: "one_customer", audienceUserId: customer._id },
    });
    await createNotificationJob({ kind: "version_released", createdAt: new Date("2026-10-04T10:00:00Z") });

    const page = await listAnnouncementJobs(1);

    expect(page.total).toBe(3);
    expect(page.totalPages).toBe(1);
    expect(page.page).toBe(1);
    expect(page.items).toEqual([
      {
        id: third._id.toString(),
        createdAt: new Date("2026-10-03T10:00:00Z"),
        title: "Third",
        audienceLabel: "ann@example.com",
        status: "done",
        notifiedCount: 0,
        emailedCount: 0,
        error: null,
      },
      {
        id: second._id.toString(),
        createdAt: new Date("2026-10-02T10:00:00Z"),
        title: "Second",
        audienceLabel: "Owners of Aurora Blog",
        status: "failed",
        notifiedCount: 40,
        emailedCount: 12,
        error: "Email service is down",
      },
      {
        id: first._id.toString(),
        createdAt: new Date("2026-10-01T10:00:00Z"),
        title: "First",
        audienceLabel: "All customers",
        status: "pending",
        notifiedCount: 0,
        emailedCount: 0,
        error: null,
      },
    ]);
  });

  it("shows 20 jobs per page", async () => {
    for (let index = 0; index < 21; index += 1) {
      await createNotificationJob({ kind: "announcement", announcement: { title: `Announcement ${index}` } });
    }

    const pageOne = await listAnnouncementJobs(1);
    const pageTwo = await listAnnouncementJobs(2);

    expect(pageOne.items).toHaveLength(20);
    expect(pageTwo.items).toHaveLength(1);
    expect(pageOne.totalPages).toBe(2);
  });
});

describe("retryNotificationJob", () => {
  it("resets a failed job and keeps its cursor", async () => {
    const cursor = new Types.ObjectId();
    const job = await createNotificationJob({
      kind: "announcement",
      status: "failed",
      attempts: 5,
      error: "Email service is down",
      cursor,
      notifiedCount: 40,
      emailedCount: 12,
    });

    await retryNotificationJob(job._id.toString());

    const saved = await NotificationJobModel.findById(job._id).lean();
    expect(saved?.status).toBe("pending");
    expect(saved?.attempts).toBe(0);
    expect(saved?.error).toBeNull();
    expect(saved?.cursor?.toString()).toBe(cursor.toString());
    expect(saved?.notifiedCount).toBe(40);
    expect(saved?.emailedCount).toBe(12);
  });

  it("refuses a job that is not failed and an unknown id", async () => {
    const job = await createNotificationJob({ kind: "announcement", status: "running", attempts: 2, error: "Slow" });

    await expect(retryNotificationJob(job._id.toString())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Only failed jobs can be retried.",
    });
    await expect(retryNotificationJob(new Types.ObjectId().toString())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Notification job not found.",
    });
    await expect(retryNotificationJob("not-an-id")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Notification job not found.",
    });

    const saved = await NotificationJobModel.findById(job._id).lean();
    expect(saved?.status).toBe("running");
    expect(saved?.attempts).toBe(2);
    expect(saved?.error).toBe("Slow");
  });
});
