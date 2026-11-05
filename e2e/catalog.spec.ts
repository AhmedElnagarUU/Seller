import mongoose from "mongoose";
import { expect, test, type Page } from "@playwright/test";
import { CategoryModel } from "@/features/categories/category.model";
import { ThemeModel } from "@/features/themes/theme.model";

const ADMIN_EMAIL = "admin@example.com";
const PASSWORD = "password123";
const RUN_ID = String(Date.now());
const SEEDED_THEME_NAME = `Seeded Aurora ${RUN_ID}`;
const SEEDED_SEARCH_TEXT = `Aurora ${RUN_ID}`;

function readMongoUri(): string {
  if (!process.env.MONGODB_URI) process.loadEnvFile(".env");
  return process.env.MONGODB_URI ?? "";
}

async function registerAs(page: Page, email: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Person");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("Country").selectOption("EG");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Confirm your email" })).toBeVisible();
}

// A fresh admin account for every run: the old one (with its login data) is removed first.
async function removeAdminAccount(): Promise<void> {
  const database = mongoose.connection.db;
  if (!database) return;
  const existing = await database.collection("user").findOne({ email: ADMIN_EMAIL });
  if (!existing) return;
  await database.collection("account").deleteMany({ userId: existing._id.toString() });
  await database.collection("session").deleteMany({ userId: existing._id.toString() });
  await database.collection("user").deleteOne({ _id: existing._id });
}

test.describe("e2e catalog", () => {
  test.beforeAll(async () => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
    const category = await CategoryModel.create({ name: `Seeded Blog ${RUN_ID}`, slug: `seeded-blog-${RUN_ID}` });
    await ThemeModel.create({
      name: SEEDED_THEME_NAME,
      slug: `seeded-aurora-${RUN_ID}`,
      status: "published",
      tagline: "A calm theme for writers and bloggers",
      description: "A longer description of this theme. It has more than fifty characters in it.",
      categoryId: category._id,
      priceCents: 2900,
      requirements: { wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" },
      publishedAt: new Date(),
    });
  });

  test.afterAll(async () => {
    await ThemeModel.deleteMany({ slug: { $regex: RUN_ID } });
    await CategoryModel.deleteMany({ slug: { $regex: RUN_ID } });
    await mongoose.disconnect();
  });

  test("admin creates a category and a draft theme, and the draft is not visible on /themes", async ({ page }) => {
    const categoryName = `Created Shop ${RUN_ID}`;
    const draftName = `Draft Zephyr ${RUN_ID}`;
    await registerAs(page, ADMIN_EMAIL);

    await page.goto("/admin/categories/new");
    await page.getByLabel("Name").fill(categoryName);
    await expect(page.getByLabel("Slug")).toHaveValue(`created-shop-${RUN_ID}`);
    await page.getByRole("button", { name: "Create category" }).click();
    await expect(page.getByRole("cell", { name: categoryName })).toBeVisible();

    await page.goto("/admin/themes/new");
    await page.getByLabel("Name").fill(draftName);
    await page.getByLabel("Slug").fill(`draft-zephyr-${RUN_ID}`);
    await page.getByLabel("Tagline").fill("A draft theme that nobody can see yet");
    await page.getByLabel("Category").selectOption({ label: categoryName });
    await page.getByLabel("Price (USD)").fill("49.50");
    await page
      .getByLabel("Description")
      .fill("A longer description of this theme. It has more than fifty characters in it.");
    await page.getByLabel("WordPress minimum").fill("6.4");
    await page.getByLabel("PHP minimum").fill("8.1");
    await page.getByLabel("Tested up to").fill("6.8");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByText("Draft created.")).toBeVisible();
    await expect(page.getByRole("heading", { name: draftName })).toBeVisible();

    await page.goto(`/themes?q=Zephyr ${RUN_ID}`);
    await expect(page.getByText("No themes match your search.")).toBeVisible();
    await expect(page.getByRole("link", { name: draftName })).toHaveCount(0);
  });

  test("visitor searches, finds the published theme and opens it", async ({ page }) => {
    await page.goto(`/themes?q=${SEEDED_SEARCH_TEXT}`);
    await page.getByRole("link", { name: new RegExp(SEEDED_THEME_NAME) }).click();

    await expect(page.getByRole("heading", { name: SEEDED_THEME_NAME })).toBeVisible();
    await expect(page.getByText("$29.00")).toBeVisible();
    await expect(page.getByRole("link", { name: "Buy now" })).toBeVisible();
  });

  test("a non-admin opening /admin gets Page not found", async ({ page }) => {
    await registerAs(page, `customer-${RUN_ID}@example.com`);

    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});
