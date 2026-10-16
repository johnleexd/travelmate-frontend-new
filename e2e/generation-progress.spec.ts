import { expect, test, type Page } from '@playwright/test';
import { setup } from './fixtures/planner-fixture';

async function enterTrip(page: Page) {
  await page.goto('/dashboard?tab=planner');
  await page.locator('#destination-search').fill('Tokyo');
  await page.locator('#destination-suggestions').getByRole('button').filter({ hasText: 'Japan' }).first().click();
  await page.locator('#trip-budget').fill('300000');
  await page.locator('#trip-end-date').fill(await page.locator('#trip-start-date').inputValue());
}

test('long generation shows elapsed time and an honest delay message without repeating the request', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.clock.install();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/itinerary', async route => { await pending; await route.fallback(); });
  await enterTrip(page);
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Building your trip...', exact: true })).toBeDisabled();
  await expect(page.locator('[data-generation-elapsed]')).toContainText('elapsed');
  await page.clock.fastForward(31_000);
  await expect(page.getByRole('status').filter({ hasText: 'taking longer than usual' })).toBeVisible();
  await expect(page.locator('[data-generation-elapsed]')).toContainText('0:31');
  release();
  await expect(page.getByRole('heading', { name: 'Your trip itinerary', exact: true })).toBeVisible();
  expect(state.generations).toHaveLength(1);
  await expect(page.locator('[data-generation-elapsed]')).toHaveCount(0);
});

test('a ready generated plan appears while the separate optional weather request is still pending', async ({ page, context }) => {
  const state = await setup(page, context);
  let release!: () => void;
  let weatherRequested = false;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/weather**', async route => { weatherRequested = true; await pending; await route.fulfill({ status: 503, json: { error: 'Weather unavailable' } }).catch(() => {}); });
  try {
    await enterTrip(page);
    await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your trip itinerary', exact: true })).toBeVisible({ timeout: 5000 });
    expect(weatherRequested).toBe(true);
    expect(state.generations).toHaveLength(1);
  } finally { release(); }
});
