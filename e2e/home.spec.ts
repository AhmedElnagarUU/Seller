import { expect, test } from "@playwright/test";

test.describe("e2e home", () => {
  test("shows the heading Theme Store", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Theme Store" })).toBeVisible();
  });
});
