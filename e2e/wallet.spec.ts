import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { CategoryModel } from "@/features/categories/category.model";
import { NotificationModel } from "@/features/notifications/notification.model";
import { OrderModel } from "@/features/orders/order.model";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { SettingsModel } from "@/features/settings/settings.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { VersionModel } from "@/features/versions/version.model";
import { WalletPaymentModel } from "@/features/wallet-payments/wallet-payment.model";
import {
  ADMIN_EMAIL,
  createPngFile,
  loginAs,
  markEmailVerified,
  readMongoUri,
  registerAs,
  removeAdminAccount,
  seedPublishedThemeWithZip,
} from "./helpers";

const RUN_ID = String(Date.now());
const BUYER_EMAIL = `wallet-${RUN_ID}@example.com`;
const REJECTED_BUYER_EMAIL = `wallet-rejected-${RUN_ID}@example.com`;
const US_BUYER_EMAIL = `wallet-us-${RUN_ID}@example.com`;
const REFERENCE_PATTERN = /TS-[A-Z0-9]{6}/;
const SUBMITTED_TEXT = "We received your payment details. We'll review them within 24 hours and notify you.";
const WALLET_ACCOUNT = { label: "Vodafone Cash", account: "01012345678", instructions: "" };

let themeId = "";
let slug = "";
let themeName = "";
let zipBody: Buffer = Buffer.alloc(0);

test.describe.configure({ mode: "serial" });

async function enableWallet(): Promise<void> {
  await SettingsModel.findOneAndUpdate(
    { _id: "global" },
    { $set: { walletEnabled: true, usdToEgpRate: 50, walletAccounts: [WALLET_ACCOUNT] } },
    { upsert: true },
  );
}

// The customer starts a wallet payment for the theme, uploads a screenshot and sends the details.
// Returns the reference code.
async function startAndSubmitPayment(page: Page): Promise<string> {
  await page.goto(`/checkout/${slug}`);
  await page.getByRole("button", { name: "Pay with wallet" }).click();
  await expect(page).toHaveURL(/\/account\/wallet-payments\/[a-f0-9]{24}$/);
  await expect(page.getByText(WALLET_ACCOUNT.label)).toBeVisible();
  await expect(page.getByText(WALLET_ACCOUNT.account)).toBeVisible();
  const referenceLine = await page.getByText(/^Reference: TS-/).textContent();
  const reference = REFERENCE_PATTERN.exec(referenceLine ?? "")?.[0] ?? "";
  expect(reference).not.toBe("");

  await page.getByLabel("Screenshot of the transfer").setInputFiles({
    name: "proof.png",
    mimeType: "image/png",
    buffer: createPngFile(8, 8),
  });
  await expect(page.getByText("Screenshot uploaded.")).toBeVisible();
  await page.getByLabel("Phone number you paid from").fill("01012345678");
  await page.getByRole("button", { name: "Send payment details" }).click();
  await expect(page.getByText(SUBMITTED_TEXT)).toBeVisible();
  return reference;
}

// The admin opens the review page of the request with this reference.
async function openReviewPage(adminPage: Page, reference: string): Promise<void> {
  await adminPage.goto("/admin/wallet-payments");
  await adminPage
    .getByRole("row", { name: new RegExp(reference) })
    .getByRole("link", { name: "Review" })
    .click();
  await expect(adminPage.getByRole("heading", { name: `Wallet payment ${reference}` })).toBeVisible();
}

async function newAdminPage(browser: Browser): Promise<Page> {
  const adminPage = await (await browser.newContext()).newPage();
  await loginAs(adminPage, ADMIN_EMAIL);
  return adminPage;
}

test.describe("e2e wallet payments", () => {
  test.beforeAll(async ({ browser }) => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
    const seeded = await seedPublishedThemeWithZip({ runId: RUN_ID, priceCents: 2900 });
    ({ themeId, slug, zipBody } = seeded);
    themeName = seeded.name;
    await enableWallet();
    const page = await browser.newPage();
    await registerAs(page, ADMIN_EMAIL);
    await page.close();
  });

  test.afterAll(async () => {
    const payments = await WalletPaymentModel.find({ themeId }).lean();
    const theme = await ThemeModel.findById(themeId).lean();
    await NotificationModel.deleteMany({ userId: { $in: payments.map((payment) => payment.userId) } });
    await ActivityLogModel.deleteMany({ targetId: { $in: payments.map((payment) => payment._id) } });
    await WalletPaymentModel.deleteMany({ themeId });
    await OrderModel.deleteMany({ themeId });
    await OwnershipModel.deleteMany({ themeId });
    await VersionModel.deleteMany({ themeId });
    await ThemeModel.deleteMany({ _id: themeId });
    if (theme) await CategoryModel.deleteMany({ _id: theme.categoryId });
    await SettingsModel.deleteMany({ _id: "global" });
    await mongoose.disconnect();
  });

  test("an Egyptian customer pays by wallet and the admin approves", async ({ page, browser }) => {
    await registerAs(page, BUYER_EMAIL);
    await markEmailVerified(BUYER_EMAIL);
    await page.goto(`/checkout/${slug}`);
    await expect(page.getByText("1,450 EGP").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay with wallet" })).toBeVisible();

    const reference = await startAndSubmitPayment(page);

    const adminPage = await newAdminPage(browser);
    await openReviewPage(adminPage, reference);
    await expect(adminPage.getByAltText("Transfer screenshot")).toBeAttached();
    await expect(
      adminPage.getByText(
        "Check that the money really arrived in your wallet (amount and reference) before you approve.",
      ),
    ).toBeVisible();
    await adminPage.getByRole("button", { name: "Approve" }).click();
    await expect(adminPage.getByText("Payment approved.")).toBeVisible();

    await page.reload();
    await expect(page.getByText(`Payment approved. ${themeName} is yours.`)).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: /^Download/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${slug}-1.0.0.zip`);
    expect(readFileSync(await download.path()).equals(zipBody)).toBe(true);

    const orders = await OrderModel.find({ themeId }).lean();
    expect(orders).toHaveLength(1);
    expect(orders[0]?.currency).toBe("egp");
    expect(orders[0]?.totalAmount).toBe(145000);
    const ownerships = await OwnershipModel.find({ themeId }).lean();
    expect(ownerships).toHaveLength(1);
    expect(ownerships[0]?.status).toBe("active");
    await adminPage.context().close();
  });

  test("the admin rejects a request", async ({ page, browser }) => {
    await registerAs(page, REJECTED_BUYER_EMAIL);
    await markEmailVerified(REJECTED_BUYER_EMAIL);
    const reference = await startAndSubmitPayment(page);

    const adminPage = await newAdminPage(browser);
    await openReviewPage(adminPage, reference);
    await adminPage.getByLabel("Reason for the customer").fill("Money not received yet");
    await adminPage.getByRole("button", { name: "Reject" }).click();
    await expect(adminPage.getByText("Payment rejected.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Money not received yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Start a new payment" })).toBeVisible();
    expect(await OrderModel.countDocuments({ themeId })).toBe(1);
    await adminPage.context().close();
  });

  test("the admin saves the wallet settings", async ({ page }) => {
    await SettingsModel.updateOne({ _id: "global" }, { $set: { walletEnabled: false, walletAccounts: [] } });
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/admin/settings");

    await page.getByLabel("Accept Egyptian wallet payments").check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Add at least one wallet account first.")).toBeVisible();

    await page.getByRole("button", { name: "Add account" }).click();
    await page.getByLabel("Label", { exact: true }).fill("InstaPay");
    await page.getByLabel("Account", { exact: true }).fill("ann@instapay");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Saved.")).toBeVisible();
    const saved = await SettingsModel.findById("global").lean();
    expect(saved?.walletEnabled).toBe(true);
    expect(saved?.walletAccounts.map((account) => account.label)).toEqual(["InstaPay"]);
    await enableWallet();
  });

  test("a customer from another country does not see the wallet option", async ({ page }) => {
    await registerAs(page, US_BUYER_EMAIL, "US");
    await markEmailVerified(US_BUYER_EMAIL);

    await page.goto(`/checkout/${slug}`);

    await expect(page.getByRole("button", { name: "Continue to payment" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay with wallet" })).toHaveCount(0);
  });
});
