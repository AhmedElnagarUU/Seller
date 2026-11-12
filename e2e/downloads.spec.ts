import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import mongoose, { Types } from "mongoose";
import { expect, test } from "@playwright/test";
import { CategoryModel } from "@/features/categories/category.model";
import { DownloadLogModel } from "@/features/downloads/download-log.model";
import { DOWNLOAD_ERROR_MESSAGES } from "@/features/downloads/download.constants";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { VersionModel } from "@/features/versions/version.model";
import { createZipFile, loginAs, putStoredFile, readMongoUri, registerAs } from "./helpers";

const RUN_ID = String(Date.now());
const BUYER_EMAIL = `buyer-${RUN_ID}@example.com`;
const OWNED_NAME = `Owned Aurora ${RUN_ID}`;
const OWNED_SLUG = `owned-aurora-${RUN_ID}`;
const RETIRED_NAME = `Retired Aurora ${RUN_ID}`;
const COMING_NAME = `Coming Aurora ${RUN_ID}`;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const latestZip = createZipFile("a/style.css", `1.1.0 ${RUN_ID}`);
const olderZip = createZipFile("a/style.css", `1.0.0 ${RUN_ID}`);

let categoryId = "";
let buyerId = "";
let themeAId = "";
let themeBId = "";
let themeCId = "";
let latestVersionId = "";

function newZipKey(themeId: string): string {
  return `theme-zips/${themeId}/${randomBytes(8).toString("hex")}.zip`;
}

function sha256Of(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

async function createThemeRow(name: string, slug: string, status: "published" | "unpublished") {
  return ThemeModel.create({
    name,
    slug,
    status,
    publishedAt: new Date(),
    tagline: "A calm theme for writers and bloggers",
    description: "A longer description of this theme. It has more than fifty characters in it.",
    categoryId,
    priceCents: 2900,
    requirements: { wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" },
  });
}

async function createVersionRow(themeId: string, version: string, releasedAt: Date, zip: Buffer | null) {
  const key = newZipKey(themeId);
  if (zip) await putStoredFile({ bucket: "private", key, contentType: "application/zip", body: zip });
  const body = zip ?? Buffer.from("not uploaded");
  return VersionModel.create({
    themeId,
    version,
    changes: [{ type: "new", text: "First release" }],
    file: { key, sizeBytes: body.length, sha256: sha256Of(body), originalName: "theme.zip" },
    releasedAt,
    notifyRequested: false,
  });
}

test.describe.configure({ mode: "serial" });

test.describe("e2e downloads", () => {
  test.beforeAll(async ({ browser }) => {
    await mongoose.connect(readMongoUri());
    const category = await CategoryModel.create({ name: `Owned Blog ${RUN_ID}`, slug: `owned-blog-${RUN_ID}` });
    categoryId = category._id.toString();
    const themeA = await createThemeRow(OWNED_NAME, OWNED_SLUG, "published");
    themeAId = themeA._id.toString();
    await createVersionRow(themeAId, "1.0.0", new Date(Date.now() - TWO_DAYS_MS), olderZip);
    const latest = await createVersionRow(themeAId, "1.1.0", new Date(), latestZip);
    latestVersionId = latest._id.toString();
    const themeB = await createThemeRow(RETIRED_NAME, `retired-aurora-${RUN_ID}`, "unpublished");
    themeBId = themeB._id.toString();
    await createVersionRow(themeBId, "1.0.0", new Date(), null);
    const themeC = await createThemeRow(COMING_NAME, `coming-aurora-${RUN_ID}`, "published");
    themeCId = themeC._id.toString();

    const page = await browser.newPage();
    await registerAs(page, BUYER_EMAIL);
    await page.close();
    const buyer = await mongoose.connection.db?.collection("user").findOne({ email: BUYER_EMAIL });
    buyerId = buyer?._id.toString() ?? "";
  });

  test.afterAll(async () => {
    const themeIds = [themeAId, themeBId, themeCId];
    await OwnershipModel.deleteMany({ themeId: { $in: themeIds } });
    await VersionModel.deleteMany({ themeId: { $in: themeIds } });
    await DownloadLogModel.deleteMany({ themeId: { $in: themeIds } });
    await ThemeModel.deleteMany({ _id: { $in: themeIds } });
    await CategoryModel.deleteMany({ _id: categoryId });
    await mongoose.disconnect();
  });

  test("a customer without themes sees the empty state and the account menu", async ({ page }) => {
    await loginAs(page, BUYER_EMAIL);
    await page.goto("/account/themes");

    await expect(page.getByText("You do not own any themes yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse themes" })).toHaveAttribute("href", "/themes");
    const menu = page.getByRole("navigation", { name: "Account" });
    await expect(menu.getByRole("link", { name: "My themes" })).toHaveAttribute("aria-current", "page");
    for (const name of ["Overview", "Orders", "Favorites", "Notifications", "Feedback", "Settings"]) {
      await expect(menu.getByRole("link", { name })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Admin panel" })).toHaveCount(0);
  });

  test("owned themes show the latest and older versions", async ({ page }) => {
    for (const themeId of [themeAId, themeBId, themeCId]) {
      await OwnershipModel.create({
        userId: new Types.ObjectId(buyerId),
        themeId: new Types.ObjectId(themeId),
        status: "active",
        source: "admin_grant",
        grantedByUserId: new Types.ObjectId(),
      });
    }
    await loginAs(page, BUYER_EMAIL);
    await page.goto("/account/themes");

    await expect(page.getByRole("link", { name: OWNED_NAME })).toBeVisible();
    await expect(page.getByText("Version 1.1.0 · Updated")).toBeVisible();
    await expect(page.getByRole("link", { name: "Download 1.1.0" })).toBeVisible();
    await page.getByText("Older versions").click();
    await expect(page.locator("details").getByRole("link", { name: "Download 1.0.0" })).toBeVisible();
    await expect(page.getByRole("heading", { name: RETIRED_NAME })).toBeVisible();
    await expect(page.getByText("No longer sold")).toBeVisible();
    await expect(page.getByRole("link", { name: RETIRED_NAME })).toHaveCount(0);
    await expect(page.getByText("The first version is coming soon.")).toBeVisible();
  });

  test("the customer downloads the latest zip", async ({ page }) => {
    await loginAs(page, BUYER_EMAIL);
    await page.goto("/account/themes");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download 1.1.0" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`${OWNED_SLUG}-1.1.0.zip`);
    expect(readFileSync(await download.path()).equals(latestZip)).toBe(true);
    const logs = await DownloadLogModel.find({ themeId: themeAId }).lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.userId.toString()).toBe(buyerId);
    expect(logs[0]?.versionId.toString()).toBe(latestVersionId);
    const theme = await ThemeModel.findById(themeAId).lean();
    expect(theme?.stats.downloadCount).toBe(1);
  });

  test("a revoked ownership is refused with a message", async ({ page }) => {
    await OwnershipModel.updateOne(
      { userId: buyerId, themeId: themeAId },
      { $set: { status: "revoked", revokedAt: new Date(), revokedReason: "refund" } },
    );
    await loginAs(page, BUYER_EMAIL);

    await page.goto(`/api/downloads/${latestVersionId}`);

    await page.waitForURL("/account/themes?downloadError=not_owned");
    await expect(page.getByText(DOWNLOAD_ERROR_MESSAGES.not_owned)).toBeVisible();
    expect(await DownloadLogModel.countDocuments({ themeId: themeAId })).toBe(1);
  });

  test("a visitor is sent to the login page", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/api/downloads/${latestVersionId}`);

    await page.waitForURL("/login?next=%2Faccount%2Fthemes");
    await context.close();
  });

  test("an unknown downloadError value shows no message", async ({ page }) => {
    await loginAs(page, BUYER_EMAIL);

    await page.goto("/account/themes?downloadError=constructor");

    await expect(page.getByRole("heading", { name: "My themes" })).toBeVisible();
    for (const message of Object.values(DOWNLOAD_ERROR_MESSAGES)) {
      await expect(page.getByText(message)).toHaveCount(0);
    }
  });
});
