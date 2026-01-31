import { test, expect } from "@playwright/test";
import { setupApiMocks, setupOptimizerErrorMock } from "../fixtures/handlers";
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

  test("form displays three optimization types", async ({ page }) => {
    await navigateTo(page, "/optimize");

    // Should show all three type buttons (use exact match to avoid example query chips)
    await expect(
      page.getByRole("button", { name: "Transfers", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Chip Timing", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Wildcard", exact: true }),
    ).toBeVisible();
  });

  test("Transfers type is selected by default", async ({ page }) => {
    await navigateTo(page, "/optimize");

    // Transfers button should have active styling
    await expect(
      page.getByRole("button", { name: "Transfers", exact: true }),
    ).toHaveClass(/text-fpl-green/);
  });

  test("selecting type updates example queries", async ({ page }) => {
    await navigateTo(page, "/optimize");

    // Default (Transfers) should show transfer example queries
    await expect(
      page.getByRole("button", { name: /Find the best 2 transfers/ }),
    ).toBeVisible();

    // Click Chip Timing
    await page.getByRole("button", { name: "Chip Timing" }).click();

    // Should show chip example queries
    await expect(
      page.getByRole("button", { name: /When should I use my Bench Boost/ }),
    ).toBeVisible();

    // Click Wildcard
    await page.getByRole("button", { name: "Wildcard" }).click();

    // Should show wildcard example queries
    await expect(
      page.getByRole("button", { name: /Build me a team for the next/ }),
    ).toBeVisible();
  });

  test("can enter query text in textarea", async ({ page }) => {
    await navigateTo(page, "/optimize");

    const queryInput = page.locator("textarea").first();
    await queryInput.fill("Should I transfer in Salah for the next 5 GWs?");
    await expect(queryInput).toHaveValue(
      "Should I transfer in Salah for the next 5 GWs?",
    );
  });

  test("example query chips populate textarea on click", async ({ page }) => {
    await navigateTo(page, "/optimize");

    const queryInput = page.locator("textarea").first();

    // Click an example query chip
    await page
      .getByRole("button", { name: /Find the best 2 transfers/ })
      .click();

    // Textarea should be populated with the example
    await expect(queryInput).toHaveValue(/Find the best 2 transfers/);
  });

  test("has submit button with correct text", async ({ page }) => {
    await navigateTo(page, "/optimize");

    await expect(
      page.getByRole("button", { name: "Optimize with Claude" }),
    ).toBeVisible();
  });

  test("submit button is disabled when textarea is empty", async ({ page }) => {
    await navigateTo(page, "/optimize");

    const submitButton = page.getByRole("button", {
      name: "Optimize with Claude",
    });

    // Button should be disabled initially (empty textarea)
    await expect(submitButton).toBeDisabled();
  });

  test("submit button is enabled when textarea has text", async ({ page }) => {
    await navigateTo(page, "/optimize");

    const queryInput = page.locator("textarea").first();
    const submitButton = page.getByRole("button", {
      name: "Optimize with Claude",
    });

    // Fill textarea
    await queryInput.fill("Best transfers for GW16");

    // Button should be enabled
    await expect(submitButton).toBeEnabled();
  });

  test("submit shows loading state", async ({ page }) => {
    // Set up a delayed response to catch loading state
    await page.route("**/api/optimize**", async (route) => {
      // Delay for 2 seconds to allow checking loading state
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "transfer",
          thinking: "Analyzing...",
          recommendations: [],
          summary: "Test summary",
          warnings: [],
          processingTime: 1000,
        }),
      });
    });

    await navigateTo(page, "/optimize");

    const queryInput = page.locator("textarea").first();
    await queryInput.fill("Best transfers for GW16");

    // Click submit
    await page.getByRole("button", { name: "Optimize with Claude" }).click();

    // Should show "Thinking..." on button (appears immediately)
    await expect(
      page.getByRole("button", { name: "Thinking..." }),
    ).toBeVisible();

    // Should show loading card with message
    await expect(
      page.getByText("Claude is analyzing your request..."),
    ).toBeVisible();
  });

  test("results display after mock response", async ({ page }) => {
    await navigateTo(page, "/optimize");

    const queryInput = page.locator("textarea").first();
    await queryInput.fill("Best transfers for GW16");

    // Submit and wait for response
    const responsePromise = page.waitForResponse("**/api/optimize**");
    await page.getByRole("button", { name: "Optimize with Claude" }).click();
    await responsePromise;

    // Wait for loading to finish and results to appear
    await expect(
      page.getByText(/transfer recommended to strengthen defense/),
    ).toBeVisible({ timeout: 10000 });

    // Should show processing time
    await expect(page.getByText(/Processed in/)).toBeVisible();
  });

  test("recommendations display shows transfer details", async ({ page }) => {
    await navigateTo(page, "/optimize");

    const queryInput = page.locator("textarea").first();
    await queryInput.fill("Best transfers for GW16");

    // Submit and wait for response
    const responsePromise = page.waitForResponse("**/api/optimize**");
    await page.getByRole("button", { name: "Optimize with Claude" }).click();
    await responsePromise;

    // Wait for results
    await expect(page.getByText(/transfer recommended/)).toBeVisible({
      timeout: 10000,
    });

    // Should show transfer card with Sell/Buy sections
    await expect(page.getByText("Sell")).toBeVisible();
    await expect(page.getByText("Buy")).toBeVisible();

    // Should show player names from mock data
    await expect(page.getByText("Player A")).toBeVisible();
    await expect(page.getByText("Saliba")).toBeVisible();
  });

  test("warnings display when present in response", async ({ page }) => {
    await navigateTo(page, "/optimize");

    const queryInput = page.locator("textarea").first();
    await queryInput.fill("Best transfers for GW16");

    // Submit and wait for response
    const responsePromise = page.waitForResponse("**/api/optimize**");
    await page.getByRole("button", { name: "Optimize with Claude" }).click();
    await responsePromise;

    // Wait for results
    await expect(page.getByText(/transfer recommended/)).toBeVisible({
      timeout: 10000,
    });

    // Should show warnings section
    await expect(page.getByText("Warnings")).toBeVisible();
    await expect(
      page.getByText(/Consider waiting until after the midweek games/),
    ).toBeVisible();
  });

  test("shows how it works info when no results", async ({ page }) => {
    await navigateTo(page, "/optimize");

    // Should show "How it works" section
    await expect(page.getByText("How it works")).toBeVisible();

    // Should show the 4 steps
    await expect(page.getByText(/Choose optimization type/)).toBeVisible();
    await expect(page.getByText(/Describe what you want/)).toBeVisible();
    await expect(page.getByText(/Claude analyzes live FPL data/)).toBeVisible();
    await expect(
      page.getByText(/Get data-driven recommendations/),
    ).toBeVisible();
  });

  test("shows squad context section", async ({ page }) => {
    await navigateTo(page, "/optimize");

    // Should show Squad Context section
    await expect(page.getByText("Squad Context")).toBeVisible();
    await expect(
      page.getByText(/Connect your FPL ID on the Team page/),
    ).toBeVisible();
  });
});

// Tests for error states
test.describe("AI Optimizer - Error Handling", () => {
  test("error state displays on API failure", async ({ page }) => {
    await setupApiMocks(page);
    // Override with error mock
    await setupOptimizerErrorMock(page);

    await navigateTo(page, "/optimize");

    const queryInput = page.locator("textarea").first();
    await queryInput.fill("Best transfers for GW16");

    // Submit and wait for error response
    const responsePromise = page.waitForResponse("**/api/optimize**");
    await page.getByRole("button", { name: "Optimize with Claude" }).click();
    await responsePromise;

    // Should show error state
    await expect(page.getByText("Error")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/API rate limit exceeded/)).toBeVisible();
  });
});
