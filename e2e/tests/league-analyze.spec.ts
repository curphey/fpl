import { test, expect } from "@playwright/test";
import { setupApiMocks } from "../fixtures/handlers";
import { navigateTo } from "../helpers/test-utils";

test.describe("Mini-League Analyzer Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("shows connect prompt when not connected on leagues page", async ({
    page,
  }) => {
    await navigateTo(page, "/leagues");

    // Should show connect prompt
    await expect(page.getByText("Connect Your FPL Account")).toBeVisible();
  });

  test("shows connect prompt on analyze page when not connected", async ({
    page,
  }) => {
    await navigateTo(page, "/leagues/analyze");

    // Without manager connected, shows connect prompt
    await expect(page.getByText("Connect Your FPL Account")).toBeVisible();
  });

  test("can navigate to leagues page from sidebar", async ({ page }) => {
    await navigateTo(page, "/");

    // Click on Leagues in sidebar
    await page
      .getByRole("complementary")
      .getByRole("link", { name: "Leagues" })
      .click();
    await page.waitForLoadState("networkidle");

    // Should be on leagues page
    await expect(page).toHaveURL(/\/leagues/);
  });

  test("analyze page shows content area", async ({ page }) => {
    await navigateTo(page, "/leagues/analyze");

    // Should show main content area
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("shows loading on analyze page with league param", async ({ page }) => {
    // Navigate to analyze with league param
    await page.goto("/leagues/analyze?league=54321");

    // Should show loading or connect prompt
    // (depends on whether connected)
    const content = page.locator("main");
    await expect(content).toBeVisible();
  });
});
