import mongoose from "mongoose";
import { expect, test } from "@playwright/test";
import { FeedbackModel } from "@/features/feedback/feedback.model";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { NotificationModel } from "@/features/notifications/notification.model";
import { ADMIN_EMAIL, readMongoUri, registerAs, removeAdminAccount } from "./helpers";

const RUN_ID = String(Date.now());
const CUSTOMER_EMAIL = `feedback-${RUN_ID}@example.com`;
const SUBJECT = `Question ${RUN_ID}`;
const MESSAGE = "Do you plan more themes for photographers?";
const REPLY = `Yes, a photography theme is coming ${RUN_ID}.`;

test.describe("e2e feedback", () => {
  test.beforeAll(async () => {
    await mongoose.connect(readMongoUri());
    await removeAdminAccount();
  });

  test.afterAll(async () => {
    const rows = await FeedbackModel.find({ subject: { $regex: RUN_ID } }).lean();
    const ids = rows.map((row) => row._id);
    await NotificationModel.deleteMany({ userId: { $in: rows.map((row) => row.userId) } });
    await ActivityLogModel.deleteMany({ targetId: { $in: ids } });
    await FeedbackModel.deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
  });

  test("a customer sends feedback, the admin replies, the customer sees the reply", async ({ page, browser }) => {
    await registerAs(page, CUSTOMER_EMAIL);
    await page.goto("/account/feedback");
    await page.getByLabel("Subject").fill(SUBJECT);
    await page.getByLabel("Message").fill(MESSAGE);
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByText("Thank you! We read every message.")).toBeVisible();
    await expect(page.getByRole("heading", { name: SUBJECT })).toBeVisible();
    await expect(page.getByText("Sent", { exact: true })).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAs(adminPage, ADMIN_EMAIL);
    await adminPage.goto("/admin/feedback");
    await adminPage
      .getByRole("row", { name: new RegExp(SUBJECT) })
      .getByRole("link", { name: "Open" })
      .click();
    await expect(adminPage.getByRole("heading", { name: SUBJECT })).toBeVisible();
    await adminPage.getByLabel("Reply", { exact: true }).fill(REPLY);
    await adminPage.getByRole("button", { name: "Send reply" }).click();
    await expect(adminPage.getByText("Reply sent.")).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: "Your reply" })).toBeVisible();
    await adminContext.close();

    await page.goto("/account/feedback");
    await expect(page.getByRole("heading", { name: "Our reply" })).toBeVisible();
    await expect(page.getByText(REPLY)).toBeVisible();
    await expect(page.getByText("Read", { exact: true })).toBeVisible();
    await page.goto("/account/notifications");
    await expect(page.getByText("Reply to your feedback")).toBeVisible();
  });
});
