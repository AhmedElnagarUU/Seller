import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { CouponModel } from "@/features/coupons/coupon.model";
import { CategoryModel } from "@/features/categories/category.model";
import { OrderModel } from "@/features/orders/order.model";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { VersionModel } from "@/features/versions/version.model";
import { loginAs, markEmailVerified, readMongoUri, registerAs, seedPublishedThemeWithZip } from "./helpers";

const RUN_ID = String(Date.now());
const BUYER_EMAIL = `checkout-${RUN_ID}@example.com`;
const COUPON_CODE = `E2E-${RUN_ID}`;

let themeId = "";
let slug = "";
let themeName = "";
let zipBody: Buffer = Buffer.alloc(0);

test.describe.configure({ mode: "serial" });

test.describe("e2e checkout", () => {
  test.beforeAll(async () => {
    await mongoose.connect(readMongoUri());
    const seeded = await seedPublishedThemeWithZip({ runId: RUN_ID, priceCents: 2900 });
    ({ themeId, slug, zipBody } = seeded);
    themeName = seeded.name;
    await CouponModel.create({
      code: COUPON_CODE,
      type: "percent",
      percentOff: 20,
      appliesTo: "all",
      provider: { discountId: "fake_disc_e2e", syncedAt: new Date() },
    });
  });

  test.afterAll(async () => {
    const theme = await ThemeModel.findById(themeId).lean();
    await OrderModel.deleteMany({ themeId });
    await OwnershipModel.deleteMany({ themeId });
    await VersionModel.deleteMany({ themeId });
    await ThemeModel.deleteMany({ _id: themeId });
    if (theme) await CategoryModel.deleteMany({ _id: theme.categoryId });
    await CouponModel.deleteMany({ code: COUPON_CODE });
    await mongoose.disconnect();
  });

  test("a verified customer buys with the coupon", async ({ page }) => {
    await registerAs(page, BUYER_EMAIL);
    await markEmailVerified(BUYER_EMAIL);

    await page.goto(`/themes/${slug}`);
    await page.getByRole("link", { name: "Buy now" }).click();
    await expect(page).toHaveURL(`/checkout/${slug}`);
    await expect(page.getByText("$29.00").first()).toBeVisible();

    await page.getByLabel("Coupon code").fill(COUPON_CODE);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Coupon applied.")).toBeVisible();
    await expect(page.getByText("−$5.80")).toBeVisible();
    await expect(page.getByText("$23.20")).toBeVisible();

    await page.getByRole("button", { name: "Continue to payment" }).click();
    await expect(page).toHaveURL(/\/checkout\/fake\//);
    await page.getByRole("button", { name: "Simulate successful payment" }).click();

    await expect(page).toHaveURL(/\/checkout\/success\?checkout_id=fake_chk_/);
    await expect(page.getByRole("heading", { name: `Thank you! ${themeName} is yours.` })).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: /^Download/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${slug}-1.0.0.zip`);
    expect(readFileSync(await download.path()).equals(zipBody)).toBe(true);

    const orders = await OrderModel.find({ themeId }).lean();
    expect(orders).toHaveLength(1);
    expect(orders[0]?.totalAmount).toBe(2320);
    expect(orders[0]?.provider.name).toBe("fake");
    expect((await CouponModel.findOne({ code: COUPON_CODE }).lean())?.redemptionsCount).toBe(1);
    const ownerships = await OwnershipModel.find({ themeId }).lean();
    expect(ownerships).toHaveLength(1);
    expect(ownerships[0]?.status).toBe("active");

    await page.goto("/account/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(themeName) });
    await expect(row.getByRole("link", { name: themeName })).toHaveAttribute("href", `/themes/${slug}`);
    await expect(row.getByRole("cell", { name: "Card", exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: "$23.20", exact: true })).toBeVisible();
    await expect(row.getByText("Paid", { exact: true })).toBeVisible();
  });

  test("an invalid coupon shows its message and keeps the price", async ({ page }) => {
    await registerAs(page, `invalid-${BUYER_EMAIL}`);
    await markEmailVerified(`invalid-${BUYER_EMAIL}`);
    await page.goto(`/checkout/${slug}`);

    await page.getByLabel("Coupon code").fill("NOPE");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByText("This coupon code is not valid.")).toBeVisible();
    await expect(page.getByText("$29.00").first()).toBeVisible();
    await expect(page.getByText("$23.20")).toHaveCount(0);
  });

  test("an owner who opens the checkout again is sent to /account/themes", async ({ page }) => {
    await loginAs(page, BUYER_EMAIL);

    await page.goto(`/checkout/${slug}`);

    await expect(page).toHaveURL("/account/themes");
  });

  test("the fake checkout needs a login and the webhook route only answers POST", async ({ browser, request }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/checkout/fake/anything");

    await expect(page).toHaveURL(/\/login\?next=/);
    await context.close();
    const response = await request.get("/api/webhooks/polar");
    expect(response.status()).toBe(405);
  });
});
