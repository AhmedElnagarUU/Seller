import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { ADMIN_EMAIL, PASSWORD, readMongoUri, registerAs, removeAdminAccount } from "./helpers";

const RUN_ID = String(Date.now());
const CUSTOMER_EMAIL = `customer-${RUN_ID}@example.com`;
const DISABLED_MESSAGE = "This account has been disabled. Contact support if you think this is a mistake.";

test.describe("e2e admin customers", () => {
  test.beforeAll(async () => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
  });

  test.afterAll(async () => {
    const customer = await mongoose.connection.db?.collection("user").findOne({ email: CUSTOMER_EMAIL });
    if (customer) await ActivityLogModel.deleteMany({ subjectUserId: customer._id });
    await mongoose.disconnect();
  });

  test("an admin disables a customer and that customer can no longer log in", async ({ page, browser }) => {
    await registerAs(page, CUSTOMER_EMAIL);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAs(adminPage, ADMIN_EMAIL);
    await adminPage.goto(`/admin/customers?q=${encodeURIComponent(CUSTOMER_EMAIL)}`);
    await adminPage
      .getByRole("row", { name: new RegExp(CUSTOMER_EMAIL) })
      .getByRole("link", { name: "E2E Person" })
      .click();
    await expect(adminPage.getByRole("heading", { name: "E2E Person", level: 1 })).toBeVisible();
    await adminPage.getByLabel("Reason").fill("Spam");
    await adminPage.getByRole("button", { name: "Disable account" }).click();
    await expect(adminPage.getByRole("button", { name: "Enable account" })).toBeVisible();

    await page.goto("/account");
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/login/);
    await page.goto("/login");
    await page.getByLabel("Email").fill(CUSTOMER_EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByText(DISABLED_MESSAGE)).toBeVisible();

    await adminPage.getByRole("button", { name: "Enable account" }).click();
    await expect(adminPage.getByRole("button", { name: "Disable account" })).toBeVisible();
    await adminContext.close();

    await page.getByLabel("Email").fill(CUSTOMER_EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("/");
    await page.goto("/account");
    await expect(page.getByText("Hi E2E Person")).toBeVisible();
  });
});
