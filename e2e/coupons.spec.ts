import mongoose from "mongoose";
import { expect, test, type Page } from "@playwright/test";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { CouponModel } from "@/features/coupons/coupon.model";
import { ADMIN_EMAIL, loginAs, readMongoUri, registerAs, removeAdminAccount } from "./helpers";

const RUN_ID = String(Date.now());
const CODE = `E2E-${RUN_ID}`;

test.describe.configure({ mode: "serial" });

function couponRow(page: Page) {
  return page.getByRole("row", { name: new RegExp(CODE) });
}

test.describe("e2e coupons", () => {
  test.beforeAll(async ({ browser }) => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
    const page = await browser.newPage();
    await registerAs(page, ADMIN_EMAIL);
    await page.close();
  });

  test.afterAll(async () => {
    await ActivityLogModel.deleteMany({ summary: `Coupon created: ${CODE}` });
    await CouponModel.deleteMany({ code: CODE });
    await mongoose.disconnect();
  });

  test("the admin creates a 20 % coupon for all themes", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/admin/coupons/new");

    await page.getByLabel("Code").fill(CODE);
    await page.getByLabel("Value").fill("20");
    await page.getByRole("button", { name: "Create coupon" }).click();

    await expect(page).toHaveURL("/admin/coupons");
    const row = couponRow(page);
    await expect(row.getByRole("cell", { name: CODE, exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: "20%", exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: "All themes", exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: "0 / Unlimited", exact: true })).toBeVisible();
    await expect(row.getByText("Active", { exact: true })).toBeVisible();
  });

  test("the admin tries to create the same code again", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/admin/coupons/new");

    await page.getByLabel("Code").fill(CODE);
    await page.getByLabel("Value").fill("20");
    await page.getByRole("button", { name: "Create coupon" }).click();

    await expect(page.getByText("This coupon code is already used.")).toBeVisible();
    expect(await CouponModel.countDocuments({ code: CODE })).toBe(1);
  });

  test("the admin changes the value to 30 and unticks Active", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/admin/coupons");
    await couponRow(page).getByRole("link", { name: "Edit" }).click();

    await page.getByLabel("Value").fill("30");
    await page.getByLabel("Active").uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    await page.goto("/admin/coupons");
    const row = couponRow(page);
    await expect(row.getByRole("cell", { name: "30%", exact: true })).toBeVisible();
    await expect(row.getByText("Inactive", { exact: true })).toBeVisible();
  });

  test("the admin deletes the coupon", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/admin/coupons");
    await couponRow(page).getByRole("link", { name: "Edit" }).click();

    await page.getByRole("button", { name: "Delete coupon" }).click();

    await expect(page).toHaveURL("/admin/coupons");
    await expect(page.getByText(CODE)).toHaveCount(0);
    expect(await CouponModel.countDocuments({ code: CODE })).toBe(0);
  });
});
