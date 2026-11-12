import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import {
  createAnnouncementJob,
  createThemePublishedJob,
  createVersionReleasedJob,
} from "@/features/notifications/notification-job.service";
import type { AnnouncementJobInput } from "@/features/notifications/notification.types";
import { withTransaction } from "@/shared/db/transaction";
import { createAdmin, createCategory, createTheme, createUser } from "@/shared/test/factories";

async function buildAnnouncementInput(overrides: Partial<AnnouncementJobInput> = {}): Promise<AnnouncementJobInput> {
  const admin = await createAdmin();
  return {
    title: "Winter sale",
    body: "All themes are 20% off.",
    link: null,
    sendEmail: true,
    audience: "all_customers",
    audienceThemeId: null,
    audienceUserId: null,
    createdByUserId: admin._id.toString(),
    ...overrides,
  };
}

async function buildVersionInput() {
  const admin = await createAdmin();
  const theme = await createTheme();
  return {
    themeId: theme._id.toString(),
    versionId: new Types.ObjectId().toString(),
    createdByUserId: admin._id.toString(),
  };
}

// The only saved job.
async function onlyJob() {
  const jobs = await NotificationJobModel.find().lean();
  expect(jobs).toHaveLength(1);
  return jobs[0];
}

describe("createVersionReleasedJob", () => {
  it("saves a pending job at stage theme_owners", async () => {
    const input = await buildVersionInput();

    await createVersionReleasedJob(input);

    const job = await onlyJob();
    expect(job?.kind).toBe("version_released");
    expect(job?.stage).toBe("theme_owners");
    expect(job?.status).toBe("pending");
    expect(job?.themeId?.toString()).toBe(input.themeId);
    expect(job?.versionId?.toString()).toBe(input.versionId);
    expect(job?.categoryId).toBeNull();
    expect(job?.cursor).toBeNull();
    expect(job?.notifiedCount).toBe(0);
    expect(job?.emailedCount).toBe(0);
    expect(job?.attempts).toBe(0);
    expect(job?.error).toBeNull();
    expect(job?.startedAt).toBeNull();
    expect(job?.finishedAt).toBeNull();
    expect(job?.lockedUntil).toBeNull();
    expect(job?.createdByUserId.toString()).toBe(input.createdByUserId);
    expect(job?.announcement).toEqual({
      title: null,
      body: null,
      link: null,
      sendEmail: null,
      audience: null,
      audienceThemeId: null,
      audienceUserId: null,
    });
  });

  it("returns the id of the saved job", async () => {
    const result = await createVersionReleasedJob(await buildVersionInput());

    const job = await onlyJob();
    expect(result).toEqual({ id: job?._id.toString() });
  });
});

describe("createThemePublishedJob", () => {
  it("saves a pending job at stage category_followers", async () => {
    const admin = await createAdmin();
    const category = await createCategory();
    const theme = await createTheme({ categoryId: category._id });

    await createThemePublishedJob({
      themeId: theme._id.toString(),
      categoryId: category._id.toString(),
      createdByUserId: admin._id.toString(),
    });

    const job = await onlyJob();
    expect(job?.kind).toBe("theme_published");
    expect(job?.stage).toBe("category_followers");
    expect(job?.status).toBe("pending");
    expect(job?.themeId?.toString()).toBe(theme._id.toString());
    expect(job?.categoryId?.toString()).toBe(category._id.toString());
    expect(job?.versionId).toBeNull();
    expect(job?.announcement.title).toBeNull();
  });
});

describe("createAnnouncementJob", () => {
  it("for all customers starts at stage all_customers", async () => {
    await createAnnouncementJob(await buildAnnouncementInput());

    const job = await onlyJob();
    expect(job?.kind).toBe("announcement");
    expect(job?.stage).toBe("all_customers");
    expect(job?.status).toBe("pending");
    expect(job?.announcement.title).toBe("Winter sale");
    expect(job?.announcement.body).toBe("All themes are 20% off.");
    expect(job?.announcement.link).toBeNull();
    expect(job?.announcement.sendEmail).toBe(true);
    expect(job?.announcement.audience).toBe("all_customers");
    expect(job?.themeId).toBeNull();
    expect(job?.versionId).toBeNull();
    expect(job?.categoryId).toBeNull();
  });

  it("for theme owners starts at stage theme_owners", async () => {
    const theme = await createTheme();
    const input = await buildAnnouncementInput({
      audience: "theme_owners",
      audienceThemeId: theme._id.toString(),
      sendEmail: false,
    });

    await createAnnouncementJob(input);

    const job = await onlyJob();
    expect(job?.stage).toBe("theme_owners");
    expect(job?.announcement.audience).toBe("theme_owners");
    expect(job?.announcement.audienceThemeId?.toString()).toBe(theme._id.toString());
    expect(job?.announcement.audienceUserId).toBeNull();
    expect(job?.announcement.sendEmail).toBe(false);
  });

  it("for one customer starts at stage one_customer", async () => {
    const customer = await createUser();
    const input = await buildAnnouncementInput({
      audience: "one_customer",
      audienceUserId: customer._id.toString(),
      link: "/account/themes",
    });

    await createAnnouncementJob(input);

    const job = await onlyJob();
    expect(job?.stage).toBe("one_customer");
    expect(job?.announcement.audienceUserId?.toString()).toBe(customer._id.toString());
    expect(job?.announcement.audienceThemeId).toBeNull();
    expect(job?.announcement.link).toBe("/account/themes");
  });

  it("refuses theme owners without a theme", async () => {
    const input = await buildAnnouncementInput({ audience: "theme_owners", audienceThemeId: null });

    const error: unknown = await createAnnouncementJob(input).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toMatchObject({ name: "ValidationError" });
    const errors = typeof error === "object" && error !== null && "errors" in error ? error.errors : {};
    expect(Object.keys(errors ?? {})).toEqual(["announcement.audienceThemeId"]);
    expect(await NotificationJobModel.countDocuments()).toBe(0);
  });
});

describe("job functions", () => {
  it("are rolled back with the caller's transaction", async () => {
    const input = await buildVersionInput();

    const attempt = withTransaction(async (session) => {
      await createVersionReleasedJob(input, session);
      throw new Error("boom");
    });

    await expect(attempt).rejects.toThrow(new Error("boom"));
    expect(await NotificationJobModel.countDocuments()).toBe(0);
  });
});
