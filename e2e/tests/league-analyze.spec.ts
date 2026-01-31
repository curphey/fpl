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

// Tests that require a connected manager
test.describe("Leagues Page - Connected State", () => {
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
  });

  test("league list displays user's classic leagues", async ({ page }) => {
    // Navigate to leagues page via sidebar
    await page
      .getByRole("complementary")
      .getByRole("link", { name: "Leagues" })
      .click();
    await page.waitForLoadState("networkidle");

    // Should show "Your Leagues" section
    await expect(page.getByText("Your Leagues")).toBeVisible({
      timeout: 10000,
    });

    // Should show Test League in the league list (button)
    await expect(
      page.getByRole("button", { name: /Test League/ }),
    ).toBeVisible();
  });

  test("clicking league shows standings table", async ({ page }) => {
    // Navigate to leagues page
    await page
      .getByRole("complementary")
      .getByRole("link", { name: "Leagues" })
      .click();
    await page.waitForLoadState("networkidle");

    // Wait for league list to load
    await expect(page.getByText("Your Leagues")).toBeVisible({
      timeout: 10000,
    });

    // Click on Test League
    await page.getByRole("button", { name: /Test League/ }).click();

    // Wait for standings to load
    await page.waitForLoadState("networkidle");

    // Should show standings table with entries from mock data
    const table = page.getByRole("table");
    await expect(table.getByText("Test FC")).toBeVisible({ timeout: 10000 });
    await expect(table.getByText("Rival FC")).toBeVisible();
    await expect(table.getByText("Third Place")).toBeVisible();
  });

  test("standings table shows 10+ entries", async ({ page }) => {
    // Navigate to leagues page
    await page
      .getByRole("complementary")
      .getByRole("link", { name: "Leagues" })
      .click();
    await page.waitForLoadState("networkidle");

    // Wait for league list and standings to load
    await expect(page.getByText("Your Leagues")).toBeVisible({
      timeout: 10000,
    });

    // Should show entries from expanded mock data
    await expect(page.getByText("Eleventh Hour")).toBeVisible({
      timeout: 10000,
    });
  });

  test("analyze button navigates to analyzer page", async ({ page }) => {
    // Navigate to leagues page
    await page
      .getByRole("complementary")
      .getByRole("link", { name: "Leagues" })
      .click();
    await page.waitForLoadState("networkidle");

    // Wait for standings to load
    await expect(page.getByText("Your Leagues")).toBeVisible({
      timeout: 10000,
    });

    // Click Analyze button
    await page.getByRole("link", { name: "Analyze" }).click();
    await page.waitForLoadState("networkidle");

    // Should be on analyze page with league param
    await expect(page).toHaveURL(/\/leagues\/analyze\?league=54321/);
  });
});

// Tests for the League Analyzer page with connected manager
test.describe("League Analyzer - Connected State", () => {
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

    // Navigate to analyzer via leagues page
    await page
      .getByRole("complementary")
      .getByRole("link", { name: "Leagues" })
      .click();
    await page.waitForLoadState("networkidle");

    // Wait for standings then click Analyze
    await expect(page.getByText("Your Leagues")).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("link", { name: "Analyze" }).click();
    await page.waitForLoadState("networkidle");
  });

  test("shows league analyzer header", async ({ page }) => {
    // Should show League Analyzer heading
    await expect(
      page.getByRole("heading", { name: "League Analyzer" }),
    ).toBeVisible({ timeout: 10000 });

    // Should show league name
    await expect(page.getByText("Test League")).toBeVisible();
  });

  test("all 5 analyzer tabs are present", async ({ page }) => {
    // Wait for analyzer to load
    await expect(
      page.getByRole("heading", { name: "League Analyzer" }),
    ).toBeVisible({ timeout: 10000 });

    // Should show all 5 tabs
    await expect(
      page.getByRole("button", { name: "Effective Ownership" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "Differentials" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Rival Comparison" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Swing Scenarios" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Rival Chips" }),
    ).toBeVisible();
  });

  test("can switch between analyzer tabs", async ({ page }) => {
    // Wait for analyzer to load
    await expect(
      page.getByRole("heading", { name: "League Analyzer" }),
    ).toBeVisible({ timeout: 10000 });

    // Click Differentials tab
    await page.getByRole("button", { name: "Differentials" }).click();
    // Differentials tab should have active styling (green text)
    await expect(
      page.getByRole("button", { name: "Differentials" }),
    ).toHaveClass(/text-fpl-green/);

    // Click Rival Comparison tab
    await page.getByRole("button", { name: "Rival Comparison" }).click();
    await expect(
      page.getByRole("button", { name: "Rival Comparison" }),
    ).toHaveClass(/text-fpl-green/);

    // Click Swing Scenarios tab
    await page.getByRole("button", { name: "Swing Scenarios" }).click();
    await expect(
      page.getByRole("button", { name: "Swing Scenarios" }),
    ).toHaveClass(/text-fpl-green/);

    // Click Rival Chips tab
    await page.getByRole("button", { name: "Rival Chips" }).click();
    await expect(page.getByRole("button", { name: "Rival Chips" })).toHaveClass(
      /text-fpl-green/,
    );

    // Click back to Effective Ownership
    await page.getByRole("button", { name: "Effective Ownership" }).click();
    await expect(
      page.getByRole("button", { name: "Effective Ownership" }),
    ).toHaveClass(/text-fpl-green/);
  });

  test("rival count selector shows 5/10/20 options", async ({ page }) => {
    // Wait for analyzer to load
    await expect(
      page.getByRole("heading", { name: "League Analyzer" }),
    ).toBeVisible({ timeout: 10000 });

    // Should show Rivals label and count buttons
    await expect(page.getByText("Rivals:")).toBeVisible();
    await expect(page.getByRole("button", { name: "5" })).toBeVisible();
    await expect(page.getByRole("button", { name: "10" })).toBeVisible();
    await expect(page.getByRole("button", { name: "20" })).toBeVisible();
  });

  test("rival count selector can be changed", async ({ page }) => {
    // Wait for analyzer to load
    await expect(
      page.getByRole("heading", { name: "League Analyzer" }),
    ).toBeVisible({ timeout: 10000 });

    // Default should be 10 (active)
    await expect(page.getByRole("button", { name: "10" })).toHaveClass(
      /text-fpl-green/,
    );

    // Click 5 rivals
    await page.getByRole("button", { name: "5" }).click();
    await expect(page.getByRole("button", { name: "5" })).toHaveClass(
      /text-fpl-green/,
    );

    // Click 20 rivals
    await page.getByRole("button", { name: "20" }).click();
    await expect(page.getByRole("button", { name: "20" })).toHaveClass(
      /text-fpl-green/,
    );
  });
});
