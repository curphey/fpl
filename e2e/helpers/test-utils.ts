import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Set a manager ID in localStorage
 */
export async function setManagerId(page: Page, managerId: string) {
  await page.evaluate((id) => {
    localStorage.setItem("fpl-manager-id", id);
  }, managerId);
}

/**
 * Clear manager ID from localStorage
 */
export async function clearManagerId(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem("fpl-manager-id");
  });
}

/**
 * Navigate to a page and wait for load
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/**
 * Wait for element to be visible
 */
export async function waitForElement(
  page: Page,
  selector: string,
): Promise<Locator> {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
  return element;
}

/**
 * Fill an input field
 */
export async function fillInput(page: Page, selector: string, value: string) {
  const input = page.locator(selector);
  await input.fill(value);
}

/**
 * Click a button by text content
 */
export async function clickButton(page: Page, text: string) {
  await page.getByRole("button", { name: text }).click();
}

/**
 * Assert page title
 */
export async function expectPageTitle(page: Page, title: string) {
  await expect(page).toHaveTitle(new RegExp(title, "i"));
}

/**
 * Assert URL contains path
 */
export async function expectPath(page: Page, path: string) {
  await expect(page).toHaveURL(new RegExp(path));
}

/**
 * Assert text is visible on page
 */
export async function expectTextVisible(page: Page, text: string) {
  await expect(page.getByText(text)).toBeVisible();
}

/**
 * Assert element count
 */
export async function expectElementCount(
  page: Page,
  selector: string,
  count: number,
) {
  await expect(page.locator(selector)).toHaveCount(count);
}

/**
 * Take a named screenshot
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png` });
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(page: Page) {
  await page.waitForLoadState("networkidle");
}

/**
 * Check if mobile viewport
 */
export function isMobileViewport(page: Page): boolean {
  const viewport = page.viewportSize();
  return viewport ? viewport.width < 768 : false;
}
