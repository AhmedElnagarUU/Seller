import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { CategoryModel } from "@/features/categories/category.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { readMongoUri } from "./helpers";

const RUN_ID = String(Date.now());
const FIRST_NAME = `Storefront Aurora ${RUN_ID}`;
const SECOND_NAME = `Storefront Basalt ${RUN_ID}`;
const FIRST_SLUG = `storefront-aurora-${RUN_ID}`;
const SECOND_SLUG = `storefront-basalt-${RUN_ID}`;
const FIRST_CATEGORY = `Storefront Blogs ${RUN_ID}`;
const SECOND_CATEGORY = `Storefront Shops ${RUN_ID}`;

function themeFields(input: {
  name: string;
  slug: string;
  categoryId: mongoose.Types.ObjectId;
  demoUrl: string | null;
}) {
  return {
    name: input.name,
    slug: input.slug,
    status: "published" as const,
    tagline: "A calm theme for writers and bloggers",
    description: "A longer description of this theme. It has more than fifty characters in it.",
    categoryId: input.categoryId,
    priceCents: 2900,
    demoUrl: input.demoUrl,
    requirements: { wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" },
    publishedAt: new Date(),
  };
}

test.describe("e2e storefront", () => {
  test.beforeAll(async () => {
    await mongoose.connect(readMongoUri());
    const first = await CategoryModel.create({ name: FIRST_CATEGORY, slug: `storefront-blogs-${RUN_ID}` });
    const second = await CategoryModel.create({ name: SECOND_CATEGORY, slug: `storefront-shops-${RUN_ID}` });
    await ThemeModel.create(
      themeFields({ name: FIRST_NAME, slug: FIRST_SLUG, categoryId: first._id, demoUrl: "https://example.com/demo" }),
    );
    await ThemeModel.create(
      themeFields({ name: SECOND_NAME, slug: SECOND_SLUG, categoryId: second._id, demoUrl: null }),
    );
  });

  test.afterAll(async () => {
    await ThemeModel.deleteMany({ slug: { $regex: RUN_ID } });
    await CategoryModel.deleteMany({ slug: { $regex: RUN_ID } });
    await mongoose.disconnect();
  });

  test("a visitor filters by category, opens a theme and its live demo", async ({ page }) => {
    await page.goto("/themes");
    await page.getByLabel("Category").selectOption({ label: FIRST_CATEGORY });
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("link", { name: new RegExp(FIRST_NAME) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(SECOND_NAME) })).toHaveCount(0);

    await page.getByRole("link", { name: new RegExp(FIRST_NAME) }).click();
    await page.getByRole("link", { name: "Live demo" }).click();

    await expect(page).toHaveURL(/\/preview$/);
    await expect(page.getByRole("link", { name: `← ${FIRST_NAME}` })).toBeVisible();
    await expect(page.getByText("$29.00")).toBeVisible();
    await expect(page.getByRole("link", { name: "Buy now" })).toBeVisible();
    const frame = page.getByTitle(`${FIRST_NAME} live demo`);
    await expect(frame).toBeVisible();

    await page.getByRole("button", { name: "Mobile" }).click();
    await expect.poll(async () => (await frame.boundingBox())?.width).toBe(375);
    await page.getByRole("button", { name: "Tablet" }).click();
    await expect.poll(async () => (await frame.boundingBox())?.width).toBe(768);
  });

  test("a theme without a demo URL has no preview", async ({ page }) => {
    await page.goto(`/themes/${SECOND_SLUG}/preview`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

    await page.goto(`/themes/${SECOND_SLUG}`);
    await expect(page.getByRole("heading", { name: SECOND_NAME })).toBeVisible();
    await expect(page.getByRole("link", { name: "Live demo" })).toHaveCount(0);
  });

  test("the info pages, contact, robots and sitemap work", async ({ page, request }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About", exact: true })).toBeVisible();
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();

    await page.goto("/contact");
    const mailLink = page.getByRole("link", { name: "support@example.com" });
    await expect(mailLink).toBeVisible();
    await expect(mailLink).toHaveAttribute("href", "mailto:support@example.com");

    const robots = await request.get("/robots.txt");
    const robotsText = await robots.text();
    expect(robotsText).toContain("Disallow: /admin");
    expect(robotsText).toContain("Sitemap:");

    const sitemap = await request.get("/sitemap.xml");
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain(`/themes/${FIRST_SLUG}`);
    expect(sitemapText).toContain("/about");
  });
});
