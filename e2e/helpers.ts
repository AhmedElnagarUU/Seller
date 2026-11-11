import mongoose from "mongoose";
import { expect, type Page } from "@playwright/test";

// Shared by every e2e file. All files use the one admin account, so they never run at the same time
// (`workers: 1` in playwright.config.ts).
export const ADMIN_EMAIL = "admin@example.com";
export const PASSWORD = "password123";

export function readMongoUri(): string {
  if (!process.env.MONGODB_URI) process.loadEnvFile(".env");
  return process.env.MONGODB_URI ?? "";
}

export async function registerAs(page: Page, email: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Person");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("Country").selectOption("EG");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Confirm your email" })).toBeVisible();
}

// A fresh admin account for every run: the old one (with its login data) is removed first.
// Needs an open mongoose connection.
export async function removeAdminAccount(): Promise<void> {
  const database = mongoose.connection.db;
  if (!database) return;
  const existing = await database.collection("user").findOne({ email: ADMIN_EMAIL });
  if (!existing) return;
  await database.collection("account").deleteMany({ userId: existing._id.toString() });
  await database.collection("session").deleteMany({ userId: existing._id.toString() });
  await database.collection("user").deleteOne({ _id: existing._id });
}

// Logs in a user that already exists.
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("/");
}
