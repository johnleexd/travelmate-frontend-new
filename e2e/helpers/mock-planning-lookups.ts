import type { Page } from '@playwright/test';

/** Mocked UI sessions are not real backend credentials. Keep incidental provider
 * lookups inside the browser test; tests can register specific overrides later. */
export async function mockPlanningLookups(page: Page) {
  for (const route of ['**/api/destination-context**', '**/api/accommodations**']) {
    await page.route(route, request => request.fulfill({
      status: 503,
      json: { error: 'Provider lookup is unavailable in this isolated UI test.' },
    }));
  }
}
