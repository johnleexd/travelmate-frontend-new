import { expect, test, type Page } from '@playwright/test';

const DEMO_EMAIL = 'traveler@travelmate.test';
const DEMO_PASSWORD = 'Travel123!';

async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Email address').fill(DEMO_EMAIL);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
}

test('protected traveler routes redirect unauthenticated visitors', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/?auth_error=unauthenticated$/);
  await expect(page.getByRole('heading', { name: /AI Travel Planning Made Real/i })).toBeVisible();
});

test('authentication dialog supports keyboard dismissal and demo login', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await login(page);
});

test('traveler workspace tabs stay inside a 390px mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  const tabs = [
    ['Dashboard', 'Dashboard'],
    ['Plan', 'Build your trip plan'],
    ['Budget', 'Budget'],
    ['Compare', 'Compare travel options'],
    ['Stays', 'Stay booking'],
    ['Trips', 'Trips'],
    ['Verification', 'Profile'],
  ] as const;

  for (const [tabName, heading] of tabs) {
    await page.getByRole('button', { name: tabName, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
    const overflow = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('main *')]
      .filter((element) => !element.closest('nav[aria-label="Traveler workspace"]'))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0
          && (rect.left < -1 || rect.right > window.innerWidth + 1);
      })
      .slice(0, 5)
      .map((element) => ({ tag: element.tagName, text: element.textContent?.trim().slice(0, 80), rect: element.getBoundingClientRect().toJSON() })));
    expect(overflow, `${tabName} contains content outside the mobile viewport`).toEqual([]);
  }
});

test('a saved trip can be duplicated and survives reload', async ({ page }) => {
  await login(page);
  const destination = `E2E Persistence ${Date.now()}`;
  const date = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const created = await page.request.post('/api/platform', {
    data: {
      action: 'save-trip',
      destination,
      budget: 10_000,
      travelers: 1,
      startDate: date,
      endDate: date,
      interests: ['automation'],
      itinerary: { destination, days: [{ day: 1, date, activities: [] }] },
      weather: { source: 'unavailable', forecast: [] },
    },
  });
  expect(created.ok(), await created.text()).toBe(true);

  try {
    await page.reload();
    await page.getByRole('button', { name: 'Trips', exact: true }).click();
    const tripCards = page.locator('article').filter({ hasText: destination });
    await expect(tripCards).toHaveCount(1);

    await tripCards.first().getByRole('button', { name: 'Duplicate', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Trip duplicated.');
    await expect(tripCards).toHaveCount(2);

    await page.reload();
    await page.getByRole('button', { name: 'Trips', exact: true }).click();
    await expect(tripCards).toHaveCount(2);
  } finally {
    const platform = await page.request.get('/api/platform?scope=traveler').then((response) => response.json()) as { trips?: Array<{ id: string; destination: string }> };
    for (const trip of platform.trips?.filter((item) => item.destination === destination) || []) {
      await page.request.post('/api/platform', { data: { action: 'delete-trip', id: trip.id } });
    }
  }
});
