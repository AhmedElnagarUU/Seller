import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { CategoryModel } from "@/features/categories/category.model";
import { OrderModel } from "@/features/orders/order.model";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { UserModel } from "@/features/users/user.model";
import { WalletPaymentModel } from "@/features/wallet-payments/wallet-payment.model";
import { createOrder, createOwnership, createTheme, createWalletPayment } from "@/shared/test/factories";
import { ADMIN_EMAIL, readMongoUri, registerAs, removeAdminAccount } from "./helpers";

const RUN_ID = String(Date.now());
const CUSTOMER_EMAIL = `customer-${RUN_ID}@example.com`;
const THEME_NAME = `Wallet Theme ${RUN_ID}`;

let customerId = "";
let themeId = "";
let categoryId = "";
let walletPaymentId = "";

test.describe.configure({ mode: "serial" });

test.describe("e2e admin orders", () => {
  test.beforeAll(async ({ browser }) => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
    const context = await browser.newContext();
    const page = await context.newPage();
    await registerAs(page, CUSTOMER_EMAIL);
    await context.close();

    const customer = await UserModel.findOne({ email: CUSTOMER_EMAIL }).lean();
    customerId = customer?._id.toString() ?? "";
    const theme = await createTheme({ name: THEME_NAME, slug: `wallet-theme-${RUN_ID}`, status: "published" });
    themeId = theme._id.toString();
    categoryId = theme.categoryId.toString();
    const payment = await createWalletPayment({
      userId: customer?._id,
      themeId: theme._id,
      status: "approved",
      amountEgp: 1450,
    });
    walletPaymentId = payment._id.toString();
    const order = await createOrder({
      userId: customer?._id,
      themeId: theme._id,
      method: "wallet",
      currency: "egp",
      status: "paid",
      subtotalAmount: 145000,
      totalAmount: 145000,
      walletPaymentId: payment._id,
      provider: { name: "manual_wallet", orderId: walletPaymentId, checkoutId: null, customerId: null },
    });
    await createOwnership(customerId, themeId, { source: "purchase", orderId: order._id, grantedByUserId: null });
  });

  test.afterAll(async () => {
    await OwnershipModel.deleteMany({ themeId });
    await OrderModel.deleteMany({ themeId });
    await WalletPaymentModel.deleteMany({ _id: walletPaymentId });
    await ThemeModel.deleteMany({ _id: themeId });
    await CategoryModel.deleteMany({ _id: categoryId });
    await ActivityLogModel.deleteMany({ subjectUserId: customerId });
    await mongoose.disconnect();
  });

  test("the admin marks a wallet order as refunded and the customer loses access", async ({ page, browser }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(CUSTOMER_EMAIL);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("/");
    await page.goto("/account/themes");
    await expect(page.getByText(THEME_NAME).first()).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAs(adminPage, ADMIN_EMAIL);
    await adminPage.goto("/admin/orders?method=wallet");
    await adminPage
      .getByRole("row", { name: new RegExp(THEME_NAME) })
      .getByRole("link", { name: "View" })
      .click();
    await adminPage.getByRole("button", { name: "Mark as refunded" }).waitFor();
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "Mark as refunded" }).click();

    await expect(adminPage.locator("span", { hasText: /^Refunded$/ })).toBeVisible();
    await expect(adminPage.getByRole("button", { name: "Mark as refunded" })).toHaveCount(0);
    await adminContext.close();

    await page.goto("/account/themes");
    await expect(page.getByText(THEME_NAME)).toHaveCount(0);
    await expect(page.getByText("You do not own any themes yet.")).toBeVisible();
  });

  test("the order list filters by method", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/login");
    await adminPage.getByLabel("Email").fill(ADMIN_EMAIL);
    await adminPage.getByLabel("Password").fill("password123");
    await adminPage.getByRole("button", { name: "Log in", exact: true }).click();
    await adminPage.waitForURL("/");

    await adminPage.goto("/admin/orders?method=card");
    await expect(adminPage.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();
    await expect(adminPage.getByRole("row", { name: new RegExp(THEME_NAME) })).toHaveCount(0);
    await adminPage.goto("/admin/orders?method=wallet");
    await expect(adminPage.getByRole("row", { name: new RegExp(THEME_NAME) })).toBeVisible();
    await adminContext.close();
  });
});
