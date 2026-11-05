import { expect, test } from "@playwright/test";

test.describe("e2e auth", () => {
  test("registers, logs out, fails a wrong login and logs in again", async ({ page }) => {
    const name = "Test Customer";
    const email = `customer-${Date.now()}@example.com`;
    const password = "password123";

    await page.goto("/register");
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByLabel("Country").selectOption("EG");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("heading", { name: "Confirm your email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByText("Wrong email or password.")).toBeVisible();

    // React resets the form after a server action, so fill both fields again.
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("/");

    await page.goto("/account");
    await expect(page.getByText(`Hi ${name}`)).toBeVisible();
  });

  test("redirects /account without a session to the login page", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL("/login?next=%2Faccount");
  });
});
