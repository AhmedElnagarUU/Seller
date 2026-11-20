import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { readMongoUri, registerAs } from "./helpers";

const RUN_ID = String(Date.now());
const CUSTOMER_EMAIL = `account-${RUN_ID}@example.com`;
const OLD_PASSWORD = "password123";
const NEW_PASSWORD = `new-password-${RUN_ID}`;
const NEW_NAME = `Renamed ${RUN_ID}`;

test.describe("e2e account", () => {
  test.beforeAll(async () => {
    await mongoose.connect(readMongoUri());
  });

  test.afterAll(async () => {
    await mongoose.disconnect();
  });

  test("the overview shows the stats and the Egypt card", async ({ page }) => {
    await registerAs(page, CUSTOMER_EMAIL, "EG");

    await page.goto("/account");

    await expect(page.getByRole("heading", { name: "Hi E2E Person" })).toBeVisible();
    await expect(page.getByText("Themes owned")).toBeVisible();
    await expect(page.getByText("Unread notifications", { exact: true })).toBeVisible();
    await expect(page.getByText("Wallet payments waiting")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pay with Vodafone Cash or InstaPay" })).toBeVisible();
    await expect(page.getByText("Please confirm your email address.")).toBeVisible();
  });

  test("the customer changes name, e-mail switches and password in the settings", async ({ page }) => {
    const email = `settings-${RUN_ID}@example.com`;
    await registerAs(page, email, "EG");
    await page.goto("/account/settings");

    await page.getByLabel("Name").fill(NEW_NAME);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue(NEW_NAME);

    await page.getByLabel("Announcements from the store").uncheck();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Announcements from the store")).not.toBeChecked();

    await page.getByLabel("Current password").fill("wrong-password-1");
    await page.getByLabel("New password").fill(NEW_PASSWORD);
    await page.getByLabel("Confirm password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Your current password is wrong.")).toBeVisible();

    await page.getByLabel("Current password").fill(OLD_PASSWORD);
    await page.getByLabel("New password").fill(NEW_PASSWORD);
    await page.getByLabel("Confirm password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Your password was changed.")).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("/");
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: `Hi ${NEW_NAME}` })).toBeVisible();
  });
});
