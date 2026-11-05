import { expect, test } from "@playwright/test";

test.describe("e2e home", () => {
  test("shows the hero heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Premium WordPress themes" })).toBeVisible();
  });
});
