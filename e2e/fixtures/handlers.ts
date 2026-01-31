import type { Page } from "@playwright/test";
import {
  mockBootstrapStatic,
  mockEntry,
  mockEntryHistory,
  mockPicks,
  mockFixtures,
  mockLiveData,
  mockLeagueStandings,
  mockOptimizeResponse,
  mockRivalPicks,
  mockRivalHistory,
} from "./mock-data";

// mockEntry now has leagues built in

/**
 * Set up route handlers to intercept FPL API requests
 */
export async function setupApiMocks(page: Page) {
  // Bootstrap static endpoint
  await page.route("**/api/fpl/bootstrap-static**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockBootstrapStatic),
    });
  });

  // Fixtures endpoint
  await page.route("**/api/fpl/fixtures**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockFixtures),
    });
  });

  // All entry-related endpoints - use a single handler that parses the URL
  await page.route("**/api/fpl/entry/**", async (route) => {
    const url = route.request().url();

    // Extract entry ID from URL
    const entryMatch = url.match(/\/entry\/(\d+)/);
    const entryId = entryMatch ? parseInt(entryMatch[1], 10) : null;
    const isMainUser = entryId === 12345;

    if (url.includes("/history")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(isMainUser ? mockEntryHistory : mockRivalHistory),
      });
      return;
    }

    if (url.includes("/picks")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(isMainUser ? mockPicks : mockRivalPicks),
      });
      return;
    }

    // Base entry endpoint
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockEntry),
    });
  });

  // Live gameweek data
  await page.route("**/api/fpl/event/*/live**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockLiveData),
    });
  });

  // League standings
  await page.route(
    "**/api/fpl/leagues-classic/*/standings**",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockLeagueStandings),
      });
    },
  );

  // Optimize endpoint
  await page.route("**/api/optimize**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockOptimizeResponse),
    });
  });

  // Player summary endpoint
  await page.route("**/api/fpl/element-summary/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ fixtures: [], history: [], history_past: [] }),
    });
  });
}

/**
 * Set up route handler for an invalid manager ID
 */
export async function setupInvalidManagerMock(page: Page) {
  await page.route("**/api/fpl/entry/**", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Entry not found" }),
    });
  });
}

/**
 * Wait for API requests to complete
 */
export async function waitForApiLoad(page: Page) {
  await page.waitForResponse("**/api/fpl/bootstrap-static");
}
