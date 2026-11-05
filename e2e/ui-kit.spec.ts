import { expect, test } from "@playwright/test";

test.describe("e2e ui kit", () => {
  test("ui kit page renders every component", async ({ page }) => {
    await page.goto("/dev/ui");
    await expect(page.getByRole("button", { name: "Primary" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Secondary" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ghost" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Danger" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Country" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Remember me" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toBeVisible();
  });

  test("primary button uses the primary token color", async ({ page }) => {
    await page.goto("/dev/ui");
    const button = page.getByRole("button", { name: "Primary" });
    await expect(button).toHaveCSS("background-color", "rgb(79, 70, 229)");
  });

  test("text field shows its error", async ({ page }) => {
    await page.goto("/dev/ui");
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Enter a valid email.")).toBeVisible();
  });
});
