import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { CategoryModel } from "@/features/categories/category.model";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { VersionModel } from "@/features/versions/version.model";
import { ADMIN_EMAIL, createZipFile, loginAs, readMongoUri, registerAs, removeAdminAccount } from "./helpers";

const RUN_ID = String(Date.now());
const THEME_SLUG = `versioned-aurora-${RUN_ID}`;
const SHA256_PREVIEW_LENGTH = 12;
const FIRST_CHANGE = "First release of the theme";
const EDITED_CHANGE = "Rewrote the release notes";
const zip = createZipFile("aurora/style.css", "/* Theme Name: Aurora */");
const zipSha256 = createHash("sha256").update(zip).digest("hex");

let categoryId = "";
let themeId = "";

async function versionsOfTheme() {
  return VersionModel.find({ themeId }).lean();
}

test.describe.configure({ mode: "serial" });

test.describe("e2e versions", () => {
  test.beforeAll(async ({ browser }) => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
    const category = await CategoryModel.create({ name: `Versioned Blog ${RUN_ID}`, slug: `versioned-blog-${RUN_ID}` });
    categoryId = category._id.toString();
    const theme = await ThemeModel.create({
      name: `Versioned Aurora ${RUN_ID}`,
      slug: THEME_SLUG,
      status: "published",
      publishedAt: new Date(),
      tagline: "A calm theme for writers and bloggers",
      description: "A longer description of this theme. It has more than fifty characters in it.",
      categoryId: category._id,
      priceCents: 2900,
      requirements: { wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" },
    });
    themeId = theme._id.toString();
    const page = await browser.newPage();
    await registerAs(page, ADMIN_EMAIL);
    await page.close();
  });

  test.afterAll(async () => {
    await VersionModel.deleteMany({ themeId });
    await ThemeModel.deleteMany({ slug: THEME_SLUG });
    await CategoryModel.deleteMany({ _id: categoryId });
    await NotificationJobModel.deleteMany({ themeId });
    await ActivityLogModel.deleteMany({ targetId: themeId });
    await mongoose.disconnect();
  });

  test("admin releases a version with a real zip", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/themes/${themeId}/versions/new`);
    await expect(page.getByLabel("Version", { exact: true })).toHaveAttribute("placeholder", "1.0.0");

    await page.getByLabel("Version", { exact: true }).fill("1.0.0");
    await page.getByLabel("Type of change 1").selectOption({ label: "New" });
    await page.getByLabel("Text of change 1").fill(FIRST_CHANGE);
    await page.getByLabel("Zip file").setInputFiles({ name: "aurora.zip", mimeType: "application/zip", buffer: zip });
    await page.getByRole("button", { name: "Upload and release" }).click();

    await page.waitForURL(`/admin/themes/${themeId}/versions?released=1.0.0&notified=1`);
    await expect(page.getByText("Version 1.0.0 released. Notifications are being sent.")).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "1.0.0" });
    await expect(row).toContainText("0.0 MB");
    await expect(row).toContainText(zipSha256.slice(0, SHA256_PREVIEW_LENGTH));

    const versions = await versionsOfTheme();
    expect(versions).toHaveLength(1);
    expect(versions[0]?.file.sha256).toBe(zipSha256);
    const theme = await ThemeModel.findById(themeId).lean();
    expect(theme?.latestVersion?.version).toBe("1.0.0");
    const jobs = await NotificationJobModel.find({ themeId }).lean();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("pending");
    expect(await ActivityLogModel.countDocuments({ targetId: themeId, action: "version_released" })).toBe(1);
  });

  test("admin cannot release a version that is not higher", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/themes/${themeId}/versions/new`);

    await page.getByLabel("Version", { exact: true }).fill("1.0.0");
    await page.getByLabel("Text of change 1").fill(FIRST_CHANGE);
    await page.getByLabel("Zip file").setInputFiles({ name: "aurora.zip", mimeType: "application/zip", buffer: zip });
    await page.getByRole("button", { name: "Upload and release" }).click();

    await expect(page.getByText("The version must be higher than 1.0.0.")).toBeVisible();
    expect(await versionsOfTheme()).toHaveLength(1);
  });

  test("a file that is not a zip is refused before uploading", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/themes/${themeId}/versions/new`);

    await page.getByLabel("Version", { exact: true }).fill("1.0.1");
    await page.getByLabel("Text of change 1").fill(FIRST_CHANGE);
    await page
      .getByLabel("Zip file")
      .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await page.getByRole("button", { name: "Upload and release" }).click();

    await expect(page.getByText("Please choose a .zip file of at most 200 MB.")).toBeVisible();
    expect(await versionsOfTheme()).toHaveLength(1);
  });

  test("visitors see the changelog on the theme page", async ({ page }) => {
    await page.goto(`/themes/${THEME_SLUG}`);

    await expect(page.getByRole("heading", { name: "Changelog" })).toBeVisible();
    await expect(page.getByText("1.0.0 — ")).toBeVisible();
    await expect(page.getByText(FIRST_CHANGE)).toBeVisible();
    await expect(page.getByText("New", { exact: true })).toBeVisible();
  });

  test("admin edits a changelog without notifying again", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/themes/${themeId}/versions`);
    await page.getByRole("link", { name: "Edit changelog" }).click();

    await page.getByLabel("Text of change 1").fill(EDITED_CHANGE);
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Saved.")).toBeVisible();
    const versions = await versionsOfTheme();
    expect(versions[0]?.changes[0]?.text).toBe(EDITED_CHANGE);
    expect(await NotificationJobModel.countDocuments({ themeId })).toBe(1);
    await page.goto(`/themes/${THEME_SLUG}`);
    await expect(page.getByText(EDITED_CHANGE)).toBeVisible();
  });
});
