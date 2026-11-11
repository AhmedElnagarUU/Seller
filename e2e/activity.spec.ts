import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { UserModel } from "@/features/users/user.model";
import { ADMIN_EMAIL, loginAs, readMongoUri, registerAs, removeAdminAccount } from "./helpers";

const RUN_ID = String(Date.now());
const CUSTOMER_NAME = `Activity Customer ${RUN_ID}`;
const CUSTOMER_EMAIL = `activity-${RUN_ID}@example.com`;
const MINUTE_MS = 60_000;

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * MINUTE_MS);
}

test.describe("e2e activity", () => {
  test.beforeAll(async ({ browser }) => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
    const customer = await UserModel.create({ name: CUSTOMER_NAME, email: CUSTOMER_EMAIL, emailVerified: true });
    await ActivityLogModel.create({
      action: "order_paid",
      actorRole: "system",
      subjectUserId: customer._id,
      summary: `Order paid: Aurora ${RUN_ID} ($29.00)`,
      createdAt: minutesAgo(3),
    });
    await ActivityLogModel.create({
      action: "version_released",
      actorRole: "admin",
      summary: `Version released: Aurora ${RUN_ID} 1.0.0`,
      createdAt: minutesAgo(2),
    });
    await ActivityLogModel.create({
      action: "feedback_sent",
      actorRole: "customer",
      actorUserId: customer._id,
      subjectUserId: customer._id,
      summary: `Feedback sent: Hello ${RUN_ID}`,
      createdAt: minutesAgo(1),
    });
    const page = await browser.newPage();
    await registerAs(page, ADMIN_EMAIL);
    await page.close();
  });

  test.afterAll(async () => {
    await ActivityLogModel.deleteMany({ summary: { $regex: RUN_ID } });
    await UserModel.deleteMany({ email: CUSTOMER_EMAIL });
    await mongoose.disconnect();
  });

  test("admin sees the rows newest first with actor names", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);

    await page.goto("/admin/activity");

    const rows = page.getByRole("row").filter({ hasText: RUN_ID });
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Feedback sent");
    await expect(rows.nth(0)).toContainText(CUSTOMER_NAME);
    await expect(rows.nth(1)).toContainText("Admin");
    await expect(rows.nth(2)).toContainText("System");
  });

  test("filtering by action shows only that action", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/admin/activity");

    await page.getByLabel("Action").selectOption({ label: "Order paid" });
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL(/action=order_paid/);
    const rows = page.getByRole("row").filter({ hasText: RUN_ID });
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText("Order paid");
  });

  test("filtering by customer email shows only that customer's rows", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/admin/activity");

    await page.getByLabel("Customer email").fill(CUSTOMER_EMAIL);
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL(/customer=/);
    const rows = page.getByRole("row").filter({ hasText: RUN_ID });
    await expect(rows).toHaveCount(2);
    await expect(page.getByRole("row").filter({ hasText: "Version released" })).toHaveCount(0);
  });

  test("a non-admin opening /admin/activity gets Page not found", async ({ page }) => {
    await registerAs(page, `activity-viewer-${RUN_ID}@example.com`);

    await page.goto("/admin/activity");

    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});
