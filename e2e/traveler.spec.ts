import { expect, test, type Page } from '@playwright/test';

const DEMO_EMAIL = 'traveler@travelmate.test';
const DEMO_PASSWORD = 'Travel123!';

async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Email address').fill(DEMO_EMAIL);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  const submit = page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await submit.click();
    const navigated = await page.waitForURL(/\/dashboard$/, { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (navigated) break;
  }
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
}

async function expectNamedControls(page: Page, context: string) {
  const unnamed = await page.locator('button:visible, input:visible, select:visible, textarea:visible').evaluateAll((elements) => elements
    .filter((element) => {
      const control = element as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const labelledBy = (control.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent?.trim() || '').join(' ');
      const labels = 'labels' in control ? Array.from(control.labels || []).map((label) => label.textContent?.trim() || '').join(' ') : '';
      return ![control.getAttribute('aria-label'), labelledBy, labels, control.textContent, control.title, control.getAttribute('placeholder')]
        .some((value) => value?.trim());
    })
    .map((element) => element.outerHTML.slice(0, 180)));
  expect(unnamed, `${context} contains visible controls without accessible names`).toEqual([]);
}

test('protected traveler routes redirect unauthenticated visitors', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/?auth_error=unauthenticated$/);
  await expect(page.getByRole('heading', { name: /AI Travel Planning Made Real/i })).toBeVisible();
});

test('authentication dialog supports keyboard dismissal and demo login', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Sign in', exact: true }).first();
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close account dialog' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Forgot password?' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close account dialog' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await login(page);
});

test('registration requires a strong password and matching confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  const password = dialog.getByLabel('Password', { exact: true });
  const confirmation = dialog.getByLabel('Confirm password', { exact: true });

  await dialog.getByLabel('Full name').fill('Password Test');
  await dialog.getByLabel('Email address').fill('password-test@example.com');
  await password.fill('weakpass1!');
  await confirmation.fill('weakpass1!');
  await expect(dialog.getByLabel('Password strength: Getting stronger')).toBeVisible();
  await dialog.getByRole('button', { name: 'Create account' }).click();
  expect(await password.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);

  await password.fill('StrongPass1!');
  await expect(dialog.getByLabel('Password strength: Strong')).toBeVisible();
  await confirmation.fill('DifferentPass1!');
  await dialog.getByRole('button', { name: 'Create account' }).click();
  await expect(dialog.getByText('Passwords do not match. Re-enter the same password in both fields.')).toBeVisible();

  await confirmation.fill('StrongPass1!');
  await expect(confirmation).toHaveAttribute('aria-invalid', 'false');
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
    await expectNamedControls(page, `Traveler ${tabName}`);
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

test('provider failures preserve local comparison data and allow itinerary retry without weather claims', async ({ page }) => {
  await login(page);
  await page.route('**/api/travel-options?**', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Flight and activity provider unavailable.' }),
  }));
  await page.route('**/api/accommodations?**', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Hotel provider unavailable.' }),
  }));

  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByRole('button', { name: 'Compare prices', exact: true }).click();

  const status = page.getByRole('status');
  await expect(status).toContainText('Flight and activity provider unavailable.');
  await expect(status).toContainText('Hotel provider unavailable.');
  await expect(page.getByText('Run a comparison to retrieve flight offers.')).toBeVisible();
  await expect(page.getByText('Run a comparison to retrieve activity options.')).toBeVisible();
  await expect(page.getByText('TravelMate database · not live').first()).toBeVisible();
  await expect(page.getByText('Harbor View Guesthouse')).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);

  let itineraryShouldFail = true;
  let weatherShouldBeMalformed = false;
  await page.route('**/api/weather?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(weatherShouldBeMalformed ? { source: 'open-meteo', city: 'Cordova' } : {
      source: 'unavailable',
      city: 'Cordova, Cebu, Philippines',
      country: '',
      temperature: 0,
      feelsLike: 0,
      humidity: 0,
      windSpeed: 0,
      description: 'Unavailable',
      icon: '',
      iconUrl: '',
      alerts: [],
      forecast: [],
      forecastAvailable: false,
      forecastMessage: 'Forecast unavailable for the selected travel dates.',
    }),
  }));
  await page.route('**/api/itinerary', async (route) => {
    if (itineraryShouldFail) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI itinerary generation is temporarily unavailable.' }),
      });
      return;
    }
    const request = route.request().postDataJSON() as { destination: string; budget: number; startDate: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        destination: request.destination,
        totalBudget: request.budget,
        currency: 'PHP',
        source: 'mock',
        partyType: 'solo',
        travelers: 1,
        preferences: {
          travelStyle: 'balanced',
          accommodation: 'budget-friendly',
          transportation: 'public transport and walking',
          activities: ['local food', 'sightseeing'],
        },
        days: [{
          day: 1,
          date: request.startDate,
          theme: 'Provider recovery test',
          imageUrl: '/travel-illustration.png',
          totalCost: 0,
          activities: [],
          crowdLevel: 'low',
          crowdSource: 'estimated',
          crowdConfidence: 'low',
          crowdNote: 'Calendar-based estimate.',
        }],
        budgetSummary: {
          accommodation: 0,
          food: 0,
          activities: 0,
          transport: 0,
          reserve: request.budget,
          dailyAverage: request.budget,
          plannedSpend: 0,
          remainingBudget: request.budget,
          shortfall: 0,
          total: request.budget,
        },
      }),
    });
  });

  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('AI itinerary generation is temporarily unavailable.');
  await expect(page.getByRole('heading', { name: 'Trip essentials', exact: true })).toBeVisible();

  itineraryShouldFail = false;
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Demo fallback plan ready. Its recommendations and prices are estimates.');
  await expect(page.getByText('Weather unavailable for Cordova, Cebu, Philippines')).toBeVisible();
  await expect(page.getByText('No current conditions or alerts are being claimed.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Provider recovery test', exact: true })).toBeVisible();

  const fullDetailsButton = page.getByRole('button', { name: 'Full details', exact: true });
  await fullDetailsButton.click();
  const dayDialog = page.getByRole('dialog', { name: 'Day 1: Provider recovery test' });
  await expect(dayDialog).toBeVisible();
  await expect(dayDialog.getByRole('button', { name: 'Close day details' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dayDialog).toBeHidden();
  await expect(fullDetailsButton).toBeFocused();

  const addActivityButton = page.getByRole('button', { name: 'Add activity', exact: true }).first();
  await addActivityButton.click();
  const activityDialog = page.getByRole('dialog', { name: 'Add custom activity' });
  await expect(activityDialog.getByLabel('Activity title')).toBeFocused();
  await activityDialog.getByRole('button', { name: 'Close activity editor' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(activityDialog.getByRole('button', { name: 'Add activity', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(activityDialog).toBeHidden();
  await expect(addActivityButton).toBeFocused();

  weatherShouldBeMalformed = true;
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Weather service returned an invalid response.');
  await expect(page.getByRole('heading', { name: 'Provider recovery test', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});
