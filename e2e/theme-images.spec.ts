import mongoose from "mongoose";
import { expect, test, type Page } from "@playwright/test";
import { CategoryModel } from "@/features/categories/category.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { ADMIN_EMAIL, createPngFile, loginAs, readMongoUri, registerAs, removeAdminAccount } from "./helpers";

const RUN_ID = String(Date.now());

let imagedThemeId = "";
let smallThemeId = "";

async function createDraftTheme(name: string, slug: string, categoryId: mongoose.Types.ObjectId): Promise<string> {
  const theme = await ThemeModel.create({
    name,
    slug,
    status: "draft",
    tagline: "A calm theme for writers and bloggers",
    description: "A longer description of this theme. It has more than fifty characters in it.",
    categoryId,
    priceCents: 2900,
    requirements: { wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" },
  });
  return theme._id.toString();
}

// The saved images of a theme, read straight from the database.
async function imagesOf(themeId: string) {
  const theme = await ThemeModel.findById(themeId).lean();
  return theme?.images ?? [];
}

async function uploadPng(page: Page, name: string, width: number, height: number): Promise<void> {
  await page
    .getByLabel("Add an image")
    .setInputFiles({ name, mimeType: "image/png", buffer: createPngFile(width, height) });
}

test.describe("e2e theme images", () => {
  test.beforeAll(async ({ browser }) => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
    const category = await CategoryModel.create({ name: `Imaged Blog ${RUN_ID}`, slug: `imaged-blog-${RUN_ID}` });
    imagedThemeId = await createDraftTheme(`Imaged Aurora ${RUN_ID}`, `imaged-aurora-${RUN_ID}`, category._id);
    smallThemeId = await createDraftTheme(`Small Aurora ${RUN_ID}`, `small-aurora-${RUN_ID}`, category._id);
    const page = await browser.newPage();
    await registerAs(page, ADMIN_EMAIL);
    await page.close();
  });

  test.afterAll(async () => {
    await ThemeModel.deleteMany({ slug: { $regex: RUN_ID } });
    await CategoryModel.deleteMany({ slug: { $regex: RUN_ID } });
    await mongoose.disconnect();
  });

  test("admin uploads two images, reorders them and removes one", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/themes/${imagedThemeId}`);

    await uploadPng(page, "first.png", 800, 600);
    await expect(page.getByLabel("Alt text for image 1")).toBeVisible();
    await expect(page.getByText("Cover", { exact: true })).toHaveCount(1);
    const afterFirst = await imagesOf(imagedThemeId);
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0]?.width).toBe(800);
    expect(afterFirst[0]?.height).toBe(600);
    expect(afterFirst[0]?.key.startsWith(`theme-images/${imagedThemeId}/`)).toBe(true);

    await uploadPng(page, "second.png", 640, 480);
    await expect(page.getByLabel("Alt text for image 2")).toBeVisible();

    await page.getByRole("button", { name: "Move image 2 up" }).click();
    await expect.poll(async () => (await imagesOf(imagedThemeId)).map((image) => image.width)).toEqual([640, 800]);

    await expect(page.getByRole("button", { name: "Remove image 1" })).toBeEnabled();
    await page.getByRole("button", { name: "Remove image 1" }).click();
    await expect.poll(async () => (await imagesOf(imagedThemeId)).map((image) => image.width)).toEqual([800]);
  });

  test("admin saves an alt text", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/themes/${imagedThemeId}`);

    await page.getByLabel("Alt text for image 1").fill("Aurora cover");
    await page.getByRole("button", { name: "Save alt text for image 1" }).click();
    await expect.poll(async () => (await imagesOf(imagedThemeId))[0]?.alt).toBe("Aurora cover");

    await page.reload();
    await expect(page.getByLabel("Alt text for image 1")).toHaveValue("Aurora cover");
  });

  test("a too small image is refused with a message", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/themes/${smallThemeId}`);

    await uploadPng(page, "small.png", 100, 100);

    await expect(page.getByText("Images must be 400 to 6000 pixels wide and high.")).toBeVisible();
    expect(await imagesOf(smallThemeId)).toHaveLength(0);
  });

  test("a file that is not an image is refused", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/themes/${smallThemeId}`);

    await page
      .getByLabel("Add an image")
      .setInputFiles({ name: "x.gif", mimeType: "image/gif", buffer: Buffer.from("not an image") });

    await expect(page.getByText("Please upload a JPG, PNG or WebP image up to 3 MB.")).toBeVisible();
    expect(await imagesOf(smallThemeId)).toHaveLength(0);
  });
});
