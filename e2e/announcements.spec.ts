import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { CategoryModel } from "@/features/categories/category.model";
import { NotificationModel } from "@/features/notifications/notification.model";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { ADMIN_EMAIL, readMongoUri, registerAs, removeAdminAccount } from "./helpers";

const RUN_ID = String(Date.now());
const OWNER_EMAIL = `owner-${RUN_ID}@example.com`;
const OTHER_EMAIL = `other-${RUN_ID}@example.com`;
const THEME_NAME = `Announce Aurora ${RUN_ID}`;
const TITLE = `Update ${RUN_ID}`;
const CRON_URL = "/api/cron/process-notifications";
const POLL_TIMEOUT_MS = 30_000;

let categoryId = "";
let themeId = "";

function readCronSecret(): string {
  if (!process.env.CRON_SECRET) process.loadEnvFile(".env");
  return process.env.CRON_SECRET ?? "";
}

async function findUserId(email: string): Promise<string> {
  const user = await mongoose.connection.db?.collection("user").findOne({ email });
  return user?._id.toString() ?? "";
}

test.describe.configure({ mode: "serial" });

test.describe("e2e announcements", () => {
  test.beforeAll(async () => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
    const category = await CategoryModel.create({
      name: `Announce Blog ${RUN_ID}`,
      slug: `announce-blog-${RUN_ID}`,
    });
    categoryId = category._id.toString();
    const theme = await ThemeModel.create({
      name: THEME_NAME,
      slug: `announce-aurora-${RUN_ID}`,
      status: "published",
      publishedAt: new Date(),
      tagline: "A calm theme for writers and bloggers",
      description: "A longer description of this theme. It has more than fifty characters in it.",
      categoryId: category._id,
      priceCents: 2900,
      requirements: { wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" },
    });
    themeId = theme._id.toString();
  });

  test.afterAll(async () => {
    const jobs = await NotificationJobModel.find({ "announcement.title": TITLE }).lean();
    const jobIds = jobs.map((job) => job._id);
    await NotificationModel.deleteMany({ jobId: { $in: jobIds } });
    await ActivityLogModel.deleteMany({ targetId: { $in: [...jobIds, new mongoose.Types.ObjectId(themeId)] } });
    await NotificationJobModel.deleteMany({ _id: { $in: jobIds } });
    await OwnershipModel.deleteMany({ themeId });
    await ThemeModel.deleteMany({ _id: themeId });
    await CategoryModel.deleteMany({ _id: categoryId });
    await mongoose.disconnect();
  });

  test("an announcement to the owners of a theme reaches only the owners", async ({ page, browser, request }) => {
    await registerAs(page, OWNER_EMAIL);
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await registerAs(otherPage, OTHER_EMAIL);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAs(adminPage, ADMIN_EMAIL);
    await adminPage.goto(`/admin/customers?q=${encodeURIComponent(OWNER_EMAIL)}`);
    await adminPage
      .getByRole("row", { name: new RegExp(OWNER_EMAIL) })
      .getByRole("link", { name: "E2E Person" })
      .click();
    await adminPage.getByLabel("Theme", { exact: true }).selectOption({ label: `${THEME_NAME} (Published)` });
    await adminPage.getByRole("button", { name: "Give a theme" }).click();
    await expect(adminPage.getByRole("heading", { name: "Owned themes" })).toBeVisible();
    await expect(adminPage.getByRole("button", { name: "Remove access" })).toBeVisible();

    await adminPage.goto("/admin/notifications/new");
    await adminPage.getByLabel("Title").fill(TITLE);
    await adminPage.getByLabel("Message").fill("A new feature is ready for you.");
    await adminPage.getByLabel("Audience").selectOption({ label: "Owners of a theme" });
    await adminPage.getByLabel("Theme", { exact: true }).selectOption({ label: `${THEME_NAME} (Published)` });
    await adminPage.getByRole("button", { name: "Send announcement" }).click();
    await expect(adminPage.getByText("Announcement queued.")).toBeVisible();
    const row = adminPage.getByRole("row", { name: new RegExp(TITLE) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Pending", { exact: true })).toBeVisible();
    await adminContext.close();

    // Jobs of other specs may be processed first, so the cron is called until the owner has the notification.
    const ownerId = await findUserId(OWNER_EMAIL);
    await expect
      .poll(
        async () => {
          const response = await request.post(CRON_URL, { headers: { Authorization: `Bearer ${readCronSecret()}` } });
          expect(response.status()).toBe(200);
          return NotificationModel.countDocuments({ userId: ownerId });
        },
        { timeout: POLL_TIMEOUT_MS },
      )
      .toBe(1);

    await page.goto("/account/notifications");
    await expect(page.getByText(TITLE)).toBeVisible();
    await otherPage.goto("/account/notifications");
    await expect(otherPage.getByText(TITLE)).toHaveCount(0);
    await otherContext.close();
  });
});
