import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { CategoryModel } from "@/features/categories/category.model";
import { FavoriteModel } from "@/features/favorites/favorite.model";
import { FAVORITE_LABELS } from "@/features/favorites/favorite.constants";
import { NotificationModel } from "@/features/notifications/notification.model";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { VersionModel } from "@/features/versions/version.model";
import { ADMIN_EMAIL, loginAs, readMongoUri, registerAs, removeAdminAccount } from "./helpers";

const RUN_ID = String(Date.now());
const CUSTOMER_EMAIL = `favorites-${RUN_ID}@example.com`;
const CATEGORY_NAME = `Favorites Blog ${RUN_ID}`;
const CATEGORY_SLUG = `favorites-blog-${RUN_ID}`;
const THEME_A_NAME = `Favorites Aurora ${RUN_ID}`;
const THEME_A_SLUG = `favorites-aurora-${RUN_ID}`;
const THEME_B_NAME = `Favorites Borealis ${RUN_ID}`;
const THEME_B_SLUG = `favorites-borealis-${RUN_ID}`;
const POLL_TIMEOUT_MS = 30_000;

let categoryId = "";
let themeAId = "";
let themeBId = "";

function readCronSecret(): string {
  if (!process.env.CRON_SECRET) process.loadEnvFile(".env");
  return process.env.CRON_SECRET ?? "";
}

const THEME_FIELDS = {
  tagline: "A calm theme for writers and bloggers",
  description: "A longer description of this theme. It has more than fifty characters in it.",
  priceCents: 2900,
  requirements: { wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" },
};

test.describe.configure({ mode: "serial" });

test.describe("e2e favorites", () => {
  test.beforeAll(async ({ browser }) => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
    const category = await CategoryModel.create({ name: CATEGORY_NAME, slug: CATEGORY_SLUG });
    categoryId = category._id.toString();
    const themeA = await ThemeModel.create({
      ...THEME_FIELDS,
      name: THEME_A_NAME,
      slug: THEME_A_SLUG,
      status: "published",
      publishedAt: new Date(),
      categoryId: category._id,
    });
    themeAId = themeA._id.toString();
    const themeB = await ThemeModel.create({
      ...THEME_FIELDS,
      name: THEME_B_NAME,
      slug: THEME_B_SLUG,
      status: "draft",
      categoryId: category._id,
      images: [{ key: `theme-images/${RUN_ID}/seed.jpg`, alt: "", width: 800, height: 600 }],
      provider: { productId: "fake_prod_seed", syncedAt: new Date() },
    });
    themeBId = themeB._id.toString();
    const releasedAt = new Date();
    const version = await VersionModel.create({
      themeId: themeBId,
      version: "1.0.0",
      changes: [{ type: "new", text: "First release" }],
      file: {
        key: `theme-zips/${themeBId}/seed.zip`,
        sizeBytes: 1000,
        sha256: "a".repeat(64),
        originalName: "seed.zip",
      },
      releasedAt,
      notifyRequested: false,
      notificationJobId: null,
    });
    await ThemeModel.updateOne(
      { _id: themeBId },
      { $set: { latestVersion: { versionId: version._id, version: "1.0.0", releasedAt } } },
    );
    const customerPage = await browser.newPage();
    await registerAs(customerPage, CUSTOMER_EMAIL);
    await customerPage.close();
    const adminPage = await browser.newPage();
    await registerAs(adminPage, ADMIN_EMAIL);
    await adminPage.close();
  });

  test.afterAll(async () => {
    const jobs = await NotificationJobModel.find({ themeId: themeBId }).lean();
    await NotificationModel.deleteMany({ jobId: { $in: jobs.map((job) => job._id) } });
    await NotificationJobModel.deleteMany({ themeId: themeBId });
    await ActivityLogModel.deleteMany({ targetId: themeBId });
    await FavoriteModel.deleteMany({ targetId: { $in: [themeAId, categoryId] } });
    await VersionModel.deleteMany({ themeId: themeBId });
    await ThemeModel.deleteMany({ _id: { $in: [themeAId, themeBId] } });
    await CategoryModel.deleteMany({ _id: categoryId });
    await mongoose.disconnect();
  });

  test("a customer favorites a theme and follows a category, the admin publishes a new theme in that category, the cron route runs", async ({
    page,
    browser,
    request,
  }) => {
    await loginAs(page, CUSTOMER_EMAIL);
    await page.goto(`/themes/${THEME_A_SLUG}`);
    await page.getByRole("button", { name: FAVORITE_LABELS.favorite }).click();
    await expect(page.getByRole("button", { name: FAVORITE_LABELS.unfavorite })).toBeVisible();

    await page.goto(`/categories/${CATEGORY_SLUG}`);
    await page.getByRole("button", { name: FAVORITE_LABELS.follow }).click();
    await expect(page.getByRole("button", { name: FAVORITE_LABELS.unfollow })).toBeVisible();

    await page.goto("/account/favorites");
    await expect(page.getByRole("heading", { name: "Favorite themes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: THEME_A_NAME })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Followed categories" })).toBeVisible();
    await expect(page.getByRole("link", { name: CATEGORY_NAME, exact: true })).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    await adminPage.goto(`/admin/themes/${themeBId}`);
    await adminPage.getByRole("button", { name: "Publish", exact: true }).click();
    await expect.poll(async () => (await ThemeModel.findById(themeBId).lean())?.status).toBe("published");
    await adminContext.close();

    // Jobs of other specs may be processed first, so the cron is called until the customer has the notification.
    const title = `New in ${CATEGORY_NAME}: ${THEME_B_NAME}`;
    await expect
      .poll(
        async () => {
          const response = await request.post("/api/cron/process-notifications", {
            headers: { Authorization: `Bearer ${readCronSecret()}` },
          });
          expect(response.status()).toBe(200);
          return NotificationModel.countDocuments({ title });
        },
        { timeout: POLL_TIMEOUT_MS },
      )
      .toBe(1);

    await page.goto("/account/notifications");
    await expect(page.getByText(title)).toBeVisible();
  });

  test("a logged-out visitor pressing the favorite button is sent to the login page", async ({ page }) => {
    await page.goto(`/themes/${THEME_A_SLUG}`);

    await page.getByRole("link", { name: FAVORITE_LABELS.favorite }).click();

    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(`/themes/${THEME_A_SLUG}`)}`);
  });
});
