import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { CategoryModel } from "@/features/categories/category.model";
import { NotificationModel } from "@/features/notifications/notification.model";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { VersionModel } from "@/features/versions/version.model";
import { loginAs, readMongoUri, registerAs } from "./helpers";

const RUN_ID = String(Date.now());
const OWNER_EMAIL = `notify-owner-${RUN_ID}@example.com`;
const OTHER_EMAIL = `notify-other-${RUN_ID}@example.com`;
const THEME_NAME = `Notify Aurora ${RUN_ID}`;
const CRON_URL = "/api/cron/process-notifications";
const POLL_TIMEOUT_MS = 30_000;

let categoryId = "";
let themeId = "";
let versionId = "";
let ownerId = "";

async function findUserId(email: string): Promise<string> {
  const user = await mongoose.connection.db?.collection("user").findOne({ email });
  return user?._id.toString() ?? "";
}

test.describe.configure({ mode: "serial" });

test.describe("e2e notifications", () => {
  test.beforeAll(async ({ browser }) => {
    await mongoose.connect(readMongoUri());
    const category = await CategoryModel.create({
      name: `Notify Blog ${RUN_ID}`,
      slug: `notify-blog-${RUN_ID}`,
    });
    categoryId = category._id.toString();
    const theme = await ThemeModel.create({
      name: THEME_NAME,
      slug: `notify-aurora-${RUN_ID}`,
      status: "published",
      publishedAt: new Date(),
      tagline: "A calm theme for writers and bloggers",
      description: "A longer description of this theme. It has more than fifty characters in it.",
      categoryId: category._id,
      priceCents: 2900,
      requirements: { wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" },
    });
    themeId = theme._id.toString();
    const version = await VersionModel.create({
      themeId,
      version: "1.1.0",
      changes: [{ type: "fixed", text: "Fixed the footer" }],
      file: {
        key: `theme-zips/e2e-${RUN_ID}/dummy.zip`,
        sizeBytes: 1,
        sha256: "0".repeat(64),
        originalName: "theme.zip",
      },
      releasedAt: new Date(),
      notifyRequested: true,
      notificationJobId: null,
    });
    versionId = version._id.toString();
    const ownerPage = await browser.newPage();
    await registerAs(ownerPage, OWNER_EMAIL);
    await ownerPage.close();
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await registerAs(otherPage, OTHER_EMAIL);
    await otherContext.close();
    ownerId = await findUserId(OWNER_EMAIL);
  });

  test.afterAll(async () => {
    const jobs = await NotificationJobModel.find({ themeId }).lean();
    await NotificationModel.deleteMany({ jobId: { $in: jobs.map((job) => job._id) } });
    await NotificationJobModel.deleteMany({ themeId });
    await OwnershipModel.deleteMany({ themeId });
    await VersionModel.deleteMany({ themeId });
    await ThemeModel.deleteMany({ _id: themeId });
    await CategoryModel.deleteMany({ _id: categoryId });
    await mongoose.disconnect();
  });

  test("the owner is notified after the cron runs", async ({ page, request }) => {
    await OwnershipModel.create({
      userId: ownerId,
      themeId,
      status: "active",
      source: "admin_grant",
      orderId: null,
      grantedByUserId: ownerId,
      grantNote: null,
      licenseType: "standard",
    });
    await NotificationJobModel.create({
      kind: "version_released",
      themeId,
      versionId,
      stage: "theme_owners",
      createdByUserId: ownerId,
    });

    // Jobs of other specs may be processed first, so the cron is called until the owner has the notification.
    await expect
      .poll(
        async () => {
          await request.post(CRON_URL, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
          return NotificationModel.countDocuments({ userId: ownerId });
        },
        { timeout: POLL_TIMEOUT_MS },
      )
      .toBe(1);

    await loginAs(page, OWNER_EMAIL);
    await page.goto("/account/notifications");
    const title = `${THEME_NAME} 1.1.0 is available`;
    await expect(page.getByRole("button", { name: title })).toBeVisible();
    await expect(page.getByText("New", { exact: true })).toBeVisible();
    await expect(page.getByRole("banner").getByText("1", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: title }).click();
    await page.waitForURL("/account/themes");

    await page.goto("/account/notifications");
    await expect(page.getByRole("button", { name: title })).toBeVisible();
    await expect(page.getByText("New", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("banner").getByText("1", { exact: true })).toHaveCount(0);
  });

  test("customer B (not an owner) sees No notifications yet.", async ({ page }) => {
    await loginAs(page, OTHER_EMAIL);
    await page.goto("/account/notifications");

    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText("No notifications yet.")).toBeVisible();
  });

  test("the cron route refuses a wrong secret", async ({ request }) => {
    const response = await request.post(CRON_URL, { headers: { Authorization: "Bearer wrong" } });

    expect(response.status()).toBe(401);
  });
});
