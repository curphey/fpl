import { test, expect } from "@playwright/test";
import { setupApiMocks } from "../fixtures/handlers";
import { navigateTo } from "../helpers/test-utils";

test.describe("Connect Manager ID Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("shows connect prompt on team page when not connected", async ({
    page,
  }) => {
    await navigateTo(page, "/team");

    // Should show connect prompt
    await expect(page.getByText("Connect Your FPL Account")).toBeVisible();
    await expect(page.getByText("Enter your FPL Manager ID")).toBeVisible();
  });

  test("shows connect button in header when not connected", async ({
    page,
  }) => {
    await navigateTo(page, "/");

    // Should show Connect button in header
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  });

  test("opens connect input when clicking Connect button", async ({ page }) => {
    await navigateTo(page, "/");

    // Click Connect button in header
    await page.getByRole("button", { name: "Connect" }).click();

    // Should show input field
    const input = page.locator('input[placeholder="Manager ID"]');
    await expect(input).toBeVisible();

    // Should show Go button
    await expect(page.getByRole("button", { name: "Go" })).toBeVisible();
  });

  test("can enter manager ID in team page connect prompt", async ({ page }) => {
    await navigateTo(page, "/team");

    // Should show connect prompt with input
    const input = page.locator('input[placeholder="e.g. 123456"]');
    await expect(input).toBeVisible();

    // Can enter a manager ID
    await input.fill("12345");
    await expect(input).toHaveValue("12345");

    // Connect button in the form should be visible (use main area to avoid header button)
    await expect(
      page.getByRole("main").getByRole("button", { name: "Connect" }),
    ).toBeVisible();
  });

  test("only accepts numeric input in header connect field", async ({
    page,
  }) => {
    await navigateTo(page, "/");

    // Click Connect button
    await page.getByRole("button", { name: "Connect" }).click();

    const input = page.locator('input[placeholder="Manager ID"]');

    // Type letters and numbers - input should filter to only numbers
    await input.pressSequentially("abc123def");

    // Should only have numbers
    await expect(input).toHaveValue("123");
  });

  test("only accepts numeric input in team page connect field", async ({
    page,
  }) => {
    await navigateTo(page, "/team");

    const input = page.locator('input[placeholder="e.g. 123456"]');

    // Type letters and numbers
    await input.pressSequentially("xyz789abc");

    // Should only have numbers
    await expect(input).toHaveValue("789");
  });

  test("can cancel header connect input", async ({ page }) => {
    await navigateTo(page, "/");

    // Click Connect button
    await page.getByRole("button", { name: "Connect" }).click();

    // Input should be visible
    await expect(page.locator('input[placeholder="Manager ID"]')).toBeVisible();

    // Click cancel button
    await page.getByRole("button", { name: "Cancel" }).click();

    // Connect button should be visible again
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  });

  test("shows instructions in connect prompt", async ({ page }) => {
    await navigateTo(page, "/team");

    // Should show instructions on how to find manager ID
    await expect(page.getByText(/fantasy.premierleague.com/)).toBeVisible();
    await expect(page.getByText(/YOUR_ID/)).toBeVisible();
  });
});
