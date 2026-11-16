import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { CategoryModel } from "@/features/categories/category.model";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { ADMIN_EMAIL, loginAs, readMongoUri, registerAs, removeAdminAccount } from "./helpers";

const RUN_ID = String(Date.now());
const THEME_NAME = `Publishable Aurora ${RUN_ID}`;
const THEME_SLUG = `publishable-aurora-${RUN_ID}`;
const NOT_SYNCED_TEXT = "Not synced with payment provider";

let themeId = "";

test.describe.configure({ mode: "serial" });

test.describe("e2e publish", () => {
  test.beforeAll(async ({ browser }) => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
    const category = await CategoryModel.create({
      name: `Publishable Blog ${RUN_ID}`,
      slug: `publishable-blog-${RUN_ID}`,
    });
    const theme = await ThemeModel.create({
      name: THEME_NAME,
      slug: THEME_SLUG,
      status: "draft",
      tagline: "A calm theme for writers and bloggers",
      description: "A longer description of this theme. It has more than fifty characters in it.",
      categoryId: category._id,
      priceCents: 2900,
      requirements: { wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" },
      images: [{ key: `theme-images/${RUN_ID}/cover.png`, alt: "Cover", width: 1200, height: 800 }],
      latestVersion: { versionId: new mongoose.Types.ObjectId(), version: "1.0.0", releasedAt: new Date() },
      provider: { productId: null, syncedAt: null },
    });
    themeId = theme._id.toString();
    const page = await browser.newPage();
    await registerAs(page, ADMIN_EMAIL);
    await page.close();
  });

  test.afterAll(async () => {
    await NotificationJobModel.deleteMany({ themeId });
    await ActivityLogModel.deleteMany({ targetId: themeId });
    await ThemeModel.deleteMany({ slug: THEME_SLUG });
    await CategoryModel.deleteMany({ slug: `publishable-blog-${RUN_ID}` });
    await mongoose.disconnect();
  });

  test("the admin sees an unsynced theme and a disabled Publish button", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/themes/${themeId}`);

    await expect(page.getByText(NOT_SYNCED_TEXT)).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
  });

  test("the admin syncs the theme and Publish becomes enabled", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/themes/${themeId}`);

    await page.getByRole("button", { name: "Sync now" }).click();

    await expect(page.getByText(NOT_SYNCED_TEXT)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeEnabled();
    const saved = await ThemeModel.findById(themeId).lean();
    expect(saved?.provider.productId).toBe(`fake_prod_${themeId}`);
  });

  test("the admin publishes the theme and it appears in the store", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/themes/${themeId}`);

    await page.getByRole("button", { name: "Publish", exact: true }).click();

    await expect(page.getByText("Theme published.")).toBeVisible();
    await page.goto(`/themes?q=${encodeURIComponent(THEME_NAME)}`);
    await expect(page.getByText(THEME_NAME)).toBeVisible();
    const saved = await ThemeModel.findById(themeId).lean();
    expect(saved?.status).toBe("published");
  });
});
