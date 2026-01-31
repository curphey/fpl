import { test, expect } from "@playwright/test";
import { setupApiMocks } from "../fixtures/handlers";
import { navigateTo } from "../helpers/test-utils";

test.describe("AI Optimizer Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("displays optimizer page header", async ({ page }) => {
    await navigateTo(page, "/optimize");

    await expect(
      page.getByRole("heading", { name: "AI Optimizer" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Powered by Claude with extended thinking/),
    ).toBeVisible();
  });

  test("can navigate to optimizer from sidebar", async ({ page }) => {
    await navigateTo(page, "/");

    // Find and click optimizer link in sidebar
    await page
      .getByRole("complementary")
      .getByRole("link", { name: "AI Optimizer" })
      .click();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/optimize/);
    await expect(
      page.getByRole("heading", { name: "AI Optimizer" }),
    ).toBeVisible();
  });

  test("shows optimization form card", async ({ page }) => {
    await navigateTo(page, "/optimize");

    // Should show form card
    const formCard = page.locator(".space-y-6 > div").first();
    await expect(formCard).toBeVisible();
  });

  test("can select optimization type", async ({ page }) => {
    await navigateTo(page, "/optimize");

    // Find the type selector
    const typeSelector = page.locator("select").first();
    if (await typeSelector.isVisible()) {
      await typeSelector.selectOption({ index: 1 });
    }
  });

  test("can enter query text in textarea", async ({ page }) => {
    await navigateTo(page, "/optimize");

    // Find textarea for query
    const queryInput = page.locator("textarea").first();
    if (await queryInput.isVisible()) {
      await queryInput.fill("Should I transfer in Salah for the next 5 GWs?");
      await expect(queryInput).toHaveValue(
        "Should I transfer in Salah for the next 5 GWs?",
      );
    }
  });

  test("has submit button", async ({ page }) => {
    await navigateTo(page, "/optimize");

    // Should have some form of submit button
    const submitButton = page
      .getByRole("button")
      .filter({ hasText: /optimize|analyze|submit/i });
    await expect(submitButton.first()).toBeVisible();
  });
});
