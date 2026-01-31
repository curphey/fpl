import { test, expect } from "@playwright/test";
import { setupApiMocks, setupInvalidManagerMock } from "../fixtures/handlers";
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

  test("can enter manager ID and submit", async ({ page }) => {
    await navigateTo(page, "/");

    // Click Connect button
    await page.getByRole("button", { name: "Connect" }).click();

    const input = page.locator('input[placeholder="Manager ID"]');
    await input.fill("12345");

    // Go button should be enabled
    const goButton = page.getByRole("button", { name: "Go" });
    await expect(goButton).toBeEnabled();

    // Click Go to submit
    await goButton.click();

    // Should either show loading state or connected state
    // (loading may be too fast to catch reliably)
    await expect(
      page.getByText("Test FC").or(page.getByText("Connecting...")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("manager name appears on successful connection", async ({ page }) => {
    await navigateTo(page, "/");

    // Click Connect button
    await page.getByRole("button", { name: "Connect" }).click();

    const input = page.locator('input[placeholder="Manager ID"]');
    await input.fill("12345");

    // Click Go and wait for API response
    const responsePromise = page.waitForResponse("**/api/fpl/entry/**");
    await page.getByRole("button", { name: "Go" }).click();
    await responsePromise;

    // Wait for the manager name to appear (from mock data: "Test FC")
    await expect(page.getByText("Test FC")).toBeVisible({ timeout: 10000 });
  });

  test("can disconnect manager", async ({ page }) => {
    await navigateTo(page, "/");

    // First connect
    await page.getByRole("button", { name: "Connect" }).click();
    const input = page.locator('input[placeholder="Manager ID"]');
    await input.fill("12345");

    const responsePromise = page.waitForResponse("**/api/fpl/entry/**");
    await page.getByRole("button", { name: "Go" }).click();
    await responsePromise;

    // Wait for connected state
    await expect(page.getByText("Test FC")).toBeVisible({ timeout: 10000 });

    // Click disconnect button
    await page.getByRole("button", { name: "Disconnect manager" }).click();

    // Should show Connect button again
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  });

  test("disconnect button is available when connected", async ({ page }) => {
    await navigateTo(page, "/");

    // Connect first
    await page.getByRole("button", { name: "Connect" }).click();
    const input = page.locator('input[placeholder="Manager ID"]');
    await input.fill("12345");

    const responsePromise = page.waitForResponse("**/api/fpl/entry/**");
    await page.getByRole("button", { name: "Go" }).click();
    await responsePromise;

    // Manager name should appear
    await expect(page.getByText("Test FC")).toBeVisible({ timeout: 10000 });

    // Disconnect button should be available
    await expect(
      page.getByRole("button", { name: "Disconnect manager" }),
    ).toBeVisible();
  });

  test("stores manager ID in localStorage on connection", async ({ page }) => {
    await navigateTo(page, "/");

    // Connect
    await page.getByRole("button", { name: "Connect" }).click();
    const input = page.locator('input[placeholder="Manager ID"]');
    await input.fill("12345");

    const responsePromise = page.waitForResponse("**/api/fpl/entry/**");
    await page.getByRole("button", { name: "Go" }).click();
    await responsePromise;

    // Wait for connected state
    await expect(page.getByText("Test FC")).toBeVisible({ timeout: 10000 });

    // Verify localStorage has the manager ID
    const storedId = await page.evaluate(() =>
      localStorage.getItem("fpl-manager-id"),
    );
    expect(storedId).toBe("12345");
  });

  test("clears localStorage on disconnect", async ({ page }) => {
    await navigateTo(page, "/");

    // Connect
    await page.getByRole("button", { name: "Connect" }).click();
    const input = page.locator('input[placeholder="Manager ID"]');
    await input.fill("12345");

    const responsePromise = page.waitForResponse("**/api/fpl/entry/**");
    await page.getByRole("button", { name: "Go" }).click();
    await responsePromise;

    await expect(page.getByText("Test FC")).toBeVisible({ timeout: 10000 });

    // Verify localStorage has the ID
    let storedId = await page.evaluate(() =>
      localStorage.getItem("fpl-manager-id"),
    );
    expect(storedId).toBe("12345");

    // Disconnect
    await page.getByRole("button", { name: "Disconnect manager" }).click();

    // localStorage should be cleared
    storedId = await page.evaluate(() =>
      localStorage.getItem("fpl-manager-id"),
    );
    expect(storedId).toBeNull();
  });

  test("shows error state for invalid manager ID", async ({ page }) => {
    // Override with invalid manager mock
    await setupInvalidManagerMock(page);

    await navigateTo(page, "/team");

    // Enter invalid manager ID
    const input = page.locator('input[placeholder="e.g. 123456"]');
    await input.fill("99999999");

    // Submit and wait for response
    const responsePromise = page.waitForResponse("**/api/fpl/entry/**");
    await page
      .getByRole("main")
      .getByRole("button", { name: "Connect" })
      .click();
    await responsePromise;

    // Should show error message
    await expect(page.getByText(/Manager not found|not found/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("can enter manager ID in team page connect prompt", async ({ page }) => {
    await navigateTo(page, "/team");

    // Should show connect prompt with input
    const input = page.locator('input[placeholder="e.g. 123456"]');
    await expect(input).toBeVisible();

    // Can enter a manager ID
    await input.fill("12345");
    await expect(input).toHaveValue("12345");

    // Connect button in the form should be visible
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
