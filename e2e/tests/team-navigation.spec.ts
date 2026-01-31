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

// Tests that require a connected manager
test.describe("Team Page - Connected State", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);

    // Connect manager first
    await page.goto("/");
    await page.getByRole("button", { name: "Connect" }).click();
    const input = page.locator('input[placeholder="Manager ID"]');
    await input.fill("12345");

    const responsePromise = page.waitForResponse("**/api/fpl/entry/**");
    await page.getByRole("button", { name: "Go" }).click();
    await responsePromise;

    // Wait for connected state
    await expect(page.getByText("Test FC")).toBeVisible({ timeout: 10000 });

    // Navigate to team page via sidebar (preserves React state)
    await page
      .getByRole("complementary")
      .getByRole("link", { name: "My Team" })
      .click();
    await page.waitForLoadState("networkidle");

    // Wait for team page to load
    await expect(page).toHaveURL(/\/team/);
  });

  test("shows pitch view when connected", async ({ page }) => {
    // Should show team name in heading (main content area)
    await expect(page.getByRole("heading", { name: "Test FC" })).toBeVisible({
      timeout: 10000,
    });

    // Should show Pitch View and Squad Value toggle buttons
    await expect(
      page.getByRole("button", { name: "Pitch View" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Squad Value" }),
    ).toBeVisible();
  });

  test("displays current gameweek name in navigation", async ({ page }) => {
    // Should show gameweek name (from mock data: Gameweek 15)
    await expect(page.getByText(/Gameweek \d+/)).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows player names on pitch", async ({ page }) => {
    // Should show player names from mock picks
    // Mock data has Salah, Haaland, Raya, Saliba
    await expect(page.getByText("Salah")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Haaland")).toBeVisible({ timeout: 10000 });
  });

  test("gameweek navigation buttons are visible", async ({ page }) => {
    // Should have prev/next navigation buttons
    const navButtons = page.locator("button svg polyline");
    await expect(navButtons.first()).toBeVisible({ timeout: 10000 });
  });

  test("next button is disabled at current gameweek", async ({ page }) => {
    // Find the navigation area with gameweek name
    const gameweekNav = page.locator("text=/Gameweek \\d+/").locator("..");

    // The next button (second button in nav) should be disabled at current GW
    const nextButton = gameweekNav.locator("button").last();
    await expect(nextButton).toBeDisabled();
  });

  test("previous button is enabled at current gameweek", async ({ page }) => {
    // Find the navigation area with gameweek name
    const gameweekNav = page.locator("text=/Gameweek \\d+/").locator("..");

    // The prev button (first button in nav) should be enabled
    const prevButton = gameweekNav.locator("button").first();
    await expect(prevButton).toBeEnabled();
  });

  test("can toggle between Pitch View and Squad Value", async ({ page }) => {
    const pitchButton = page.getByRole("button", { name: "Pitch View" });
    const valueButton = page.getByRole("button", { name: "Squad Value" });

    // Pitch View should be active by default (has green styling)
    await expect(pitchButton).toHaveClass(/bg-fpl-green/);

    // Click Squad Value
    await valueButton.click();

    // Squad Value should now be active
    await expect(valueButton).toHaveClass(/bg-fpl-green/);

    // Click back to Pitch View
    await pitchButton.click();

    // Pitch View should be active again
    await expect(pitchButton).toHaveClass(/bg-fpl-green/);
  });

  test("shows team header with manager info", async ({ page }) => {
    // Should show team name in heading
    await expect(page.getByRole("heading", { name: "Test FC" })).toBeVisible({
      timeout: 10000,
    });

    // Should show points (from mock: 850 total, 65 GW points)
    await expect(page.getByText("850")).toBeVisible({ timeout: 10000 });
  });

  test("shows gameweek summary", async ({ page }) => {
    // Should show gameweek points from mock data
    await expect(page.getByText("65")).toBeVisible({ timeout: 10000 });
  });
});
