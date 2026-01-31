import { test, expect } from "@playwright/test";
import { setupApiMocks } from "../fixtures/handlers";
import { navigateTo } from "../helpers/test-utils";

test.describe("Team & Gameweek Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("shows connect prompt when not connected", async ({ page }) => {
    await navigateTo(page, "/team");

    // Should show connect prompt
    await expect(page.getByText("Connect Your FPL Account")).toBeVisible();
    await expect(page.getByText("Enter your FPL Manager ID")).toBeVisible();
  });

  test("has navigation links in sidebar", async ({ page }) => {
    await navigateTo(page, "/");

    // Should show sidebar navigation
    const sidebar = page.getByRole("complementary");
    await expect(
      sidebar.getByRole("link", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "My Team" })).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Transfers" }),
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Live" })).toBeVisible();
  });

  test("navigates to team page from sidebar", async ({ page }) => {
    await navigateTo(page, "/");

    // Click on My Team in sidebar
    await page
      .getByRole("complementary")
      .getByRole("link", { name: "My Team" })
      .click();
    await page.waitForLoadState("networkidle");

    // Should be on team page
    await expect(page).toHaveURL(/\/team/);
  });

  test("has header navigation", async ({ page }) => {
    await navigateTo(page, "/");

    // Should show header navigation
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(header.getByRole("link", { name: "My Team" })).toBeVisible();
  });

  test("shows connect button in header when not connected", async ({
    page,
  }) => {
    await navigateTo(page, "/");

    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  });

  test("can open connect input from header", async ({ page }) => {
    await navigateTo(page, "/");

    // Click Connect button
    await page.getByRole("button", { name: "Connect" }).click();

    // Should show input field
    const input = page.locator('input[placeholder="Manager ID"]');
    await expect(input).toBeVisible();

    // Should show Go button
    await expect(page.getByRole("button", { name: "Go" })).toBeVisible();
  });

  test("can cancel connect input", async ({ page }) => {
    await navigateTo(page, "/");

    // Click Connect button
    await page.getByRole("button", { name: "Connect" }).click();

    // Input should be visible
    const input = page.locator('input[placeholder="Manager ID"]');
    await expect(input).toBeVisible();

    // Click cancel button
    await page.getByRole("button", { name: "Cancel" }).click();

    // Should show Connect button again
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  });

  test("only accepts numeric input in manager ID field", async ({ page }) => {
    await navigateTo(page, "/");

    // Click Connect button
    await page.getByRole("button", { name: "Connect" }).click();

    const input = page.locator('input[placeholder="Manager ID"]');

    // Type mixed characters
    await input.pressSequentially("abc123def456");

    // Should only have numbers
    await expect(input).toHaveValue("123456");
  });
});
