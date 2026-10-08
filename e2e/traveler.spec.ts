import { expect, test, type Page } from '@playwright/test';
import { demoPassword } from './demo-credentials';

const DEMO_EMAIL = 'traveler@travelmate.test';

async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Email address').click();
  await page.getByLabel('Email address').fill(DEMO_EMAIL);
  await page.getByLabel('Password').fill(demoPassword('traveler'));
  const submit = page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true });
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Your travel home', exact: true })).toBeVisible();
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

test('landing page sends signed-in travelers to their account after browser back', async ({ page }) => {
  await login(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);

  const dashboardButton = page.getByRole('button', { name: 'Dashboard', exact: true }).first();
  await expect(dashboardButton).toBeVisible();
  await dashboardButton.click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Your travel home', exact: true })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard(?:\?tab=planner)?$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Plan a trip', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Start a new trip', exact: true })).toBeVisible();
});

test('authentication dialog starts empty, hides demo credentials, and supports keyboard dismissal', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Sign in', exact: true }).first();
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Email address')).toHaveValue('');
  await expect(dialog.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(dialog.getByText('Development demo access')).toHaveCount(0);
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
  await expect(dialog.getByText('Confirm password does not match Password. Enter the same value in both fields.')).toBeVisible();

  await confirmation.fill('StrongPass1!');
  await expect(confirmation).toHaveAttribute('aria-invalid', 'false');
});

test('password recovery collects a reset code and strong replacement password', async ({ page }) => {
  const actions: string[] = [];
  await page.route('**/api/auth', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthenticated.' }) });
      return;
    }
    const body = route.request().postDataJSON() as { action?: string };
    actions.push(String(body.action || ''));
    if (body.action === 'forgot-password') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Check your email for a reset code.' }) });
      return;
    }
    if (body.action === 'reset-password') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Password reset complete. Sign in with your new password.' }) });
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(dialog.getByRole('heading', { name: 'Recover your account.' })).toBeVisible();
  await dialog.getByLabel('Email address').fill('traveler@example.com');
  await dialog.getByRole('button', { name: 'Send reset code' }).click();

  await expect(dialog.getByRole('heading', { name: 'Choose a new password.' })).toBeVisible();
  await expect(dialog.getByLabel('Password reset code')).toHaveValue('');
  await dialog.getByLabel('Password reset code').fill('A1B2C3D4');
  await dialog.getByLabel('Password', { exact: true }).fill('NewTravel123!');
  await dialog.getByLabel('Confirm password', { exact: true }).fill('NewTravel123!');
  await dialog.getByRole('button', { name: 'Reset password' }).click();

  await expect(dialog.getByRole('heading', { name: 'Welcome.' })).toBeVisible();
  await expect(dialog.getByText('Password reset complete. Sign in with your new password.')).toBeVisible();
  expect(actions).toEqual(['forgot-password', 'reset-password']);
});

test('traveler workspace tabs stay inside a 390px mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  const tabs = [
    ['Home', 'Your travel home'],
    ['Plan a trip', 'Start a new trip'],
    ['Budget review', 'Does this plan fit your budget?'],
    ['Travel options', 'Compare available travel options'],
    ['Local stays', 'Browse local stays'],
    ['Saved trips', 'Saved trips and bookings'],
    ['Account', 'Your account'],
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

test('traveler home explains the planning journey before showing detailed tools', async ({ page }) => {
  await login(page);

  await expect(page.getByRole('heading', { name: 'Turn one trip idea into a plan you understand.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Six states, one connected trip.' })).toBeVisible();
  for (const step of ['Define the trip', 'Generate a draft', 'Understand the plan', 'Refine your days', 'Save deliberately', 'Reopen anytime']) {
    await expect(page.getByRole('button', { name: `Explain ${step}` })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Explain Understand the plan' }).hover();
  await expect(page.getByText('TravelMate keeps every estimate and provider source labeled beside the same trip.')).toBeVisible();
  await expect(page.getByText('TravelMate assists planning. It does not promise availability, invent live data, or complete airline and hotel checkout.')).toBeVisible();

  await page.getByRole('button', { name: 'Enter trip details', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Required trip details', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Optional preferences', exact: true })).toBeVisible();
  await expect(page.getByText('Generation creates a reviewable itinerary. It is not saved to your account until you choose Save trip.')).toBeVisible();
});

test('dashboard keyboard navigation skips to content and announces workspace changes', async ({ page }) => {
  await login(page);
  const skipLink = page.getByRole('link', { name: 'Skip to trip workspace' });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#traveler-main-content')).toBeFocused();

  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Start a new trip', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Budget review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Does this plan fit your budget?', exact: true })).toBeFocused();
});

test('trip planning derives destination context and clears it when the destination changes', async ({ page }) => {
  let accommodationCurrency = '';
  await page.route('**/api/locations?**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') || '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        locations: query.toLowerCase().startsWith('tok') ? [{
          id: 1850147,
          name: 'Tokyo',
          region: 'Tokyo',
          country: 'Japan',
          countryCode: 'JP',
          latitude: 35.6895,
          longitude: 139.6917,
          label: 'Tokyo, Tokyo, Japan',
        }] : [],
      }),
    });
  });
  await page.route('**/api/destination-context?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      currency: 'JPY',
      currencySource: 'country-code',
      transportation: [
        { id: 'train', label: 'Train', category: 'public' },
        { id: 'metro-subway', label: 'Metro / Subway', category: 'public' },
        { id: 'bus', label: 'Bus', category: 'public' },
        { id: 'taxi', label: 'Taxi', category: 'private' },
        { id: 'walking', label: 'Walking', category: 'active' },
      ],
      transportationSource: 'curated-country-city-guidance',
      transportationMessage: 'Common destination-specific modes from TravelMate guidance; availability and schedules are not live.',
    }),
  }));
  await page.route('**/api/destination-context/exchange-rate?**', (route) => {
    const quote = new URL(route.request().url()).searchParams.get('quote') || 'PHP';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        base: 'JPY', quote, rate: quote === 'USD' ? 0.0068 : 0.40611, asOf: '2026-09-16',
        fetchedAt: '2026-09-16T00:00:00.000Z', refreshAfter: '2026-09-16T06:00:00.000Z',
        source: 'frankfurter', sourceUrl: 'https://frankfurter.dev/', disclaimer: 'Reference only.',
      }),
    });
  });
  await page.route('**/api/accommodations?**', (route) => {
    accommodationCurrency = new URL(route.request().url()).searchParams.get('currency') || '';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accommodations: [{
          id: 'amadeus:TYO001:OFF001', hotelId: 'TYO001', offerId: 'OFF001', name: 'Tokyo Station Hotel',
          type: 'Hotel', rating: 5, address: 'Marunouchi, Tokyo', checkInDate: '2026-10-01', checkOutDate: '2026-10-02',
          nightlyRate: 32000, total: 32000, currency: 'JPY', roomDescription: 'Standard room',
          cancellationPolicy: 'Check provider terms.', available: true, isLive: false, source: 'amadeus',
          selectionToken: 'signed-test-token', fetchedAt: '2026-09-16T00:00:00.000Z',
        }],
        message: 'Test hotel availability loaded.',
      }),
    });
  });

  await login(page);
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  const destination = page.getByRole('combobox', { name: 'Destination', exact: true });
  const currency = page.getByRole('combobox', { name: /Destination currency/i, exact: false });
  const accommodation = page.getByRole('combobox', { name: /Accommodation/, exact: false });
  const transportation = page.getByRole('combobox', { name: /Transportation/, exact: false });

  await expect(destination).toHaveValue('');
  await expect(currency).toHaveValue('');
  await expect(accommodation).toBeDisabled();
  await expect(transportation).toBeDisabled();

  await destination.fill('Tok');
  await page.getByRole('option').getByRole('button', { name: /Tokyo/i }).click();
  await expect(page.getByText('Confirmed: Tokyo, Tokyo, Japan')).toBeVisible();
  await expect(currency).toHaveValue('JPY');
  const referenceCurrency = page.getByRole('combobox', { name: 'Show equivalents in' });
  await expect(referenceCurrency).toHaveValue('PHP');
  await expect(page.locator('small').filter({ hasText: 'PHP 8,122.20' }).first()).toBeVisible();
  await referenceCurrency.selectOption('USD');
  await expect(page.locator('small').filter({ hasText: 'USD 136.00' }).first()).toBeVisible();
  await expect(accommodation).toContainText('Tokyo Station Hotel');
  await expect(transportation).toContainText('Train');
  await expect(transportation).not.toContainText('Jeepney');
  expect(accommodationCurrency).toBe('JPY');

  await destination.fill('Seo');
  await expect(currency).toHaveValue('');
  await expect(accommodation).toBeDisabled();
  await expect(transportation).toBeDisabled();
  await expect(accommodation).not.toContainText('Tokyo Station Hotel');
});

test('a saved trip survives reload and cannot be duplicated', async ({ page }) => {
  await login(page);
  const destination = `E2E Persistence ${Date.now()}`;
  const date = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const created = await page.request.post('/api/platform', {
    data: {
      action: 'save-trip',
      destination,
      budget: 10_000,
      currency: 'PHP',
      travelers: 1,
      startDate: date,
      endDate: date,
      interests: ['automation'],
      itinerary: {
        destination,
        totalBudget: 10_000,
        currency: 'PHP',
        days: [{ day: 1, date, activities: [] }],
      },
      weather: { source: 'unavailable', forecast: [] },
    },
  });
  expect(created.ok(), await created.text()).toBe(true);

  try {
    await page.reload();
    await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
    const tripCards = page.locator('article').filter({ hasText: destination });
    await expect(tripCards).toHaveCount(1);

    await expect(tripCards.first().getByRole('button', { name: 'Duplicate', exact: true })).toHaveCount(0);
    const tripId = (await created.json()).result.id as string;
    const duplicate = await page.request.post('/api/platform', { data: { action: 'duplicate-trip', id: tripId } });
    expect(duplicate.status()).toBe(400);
    expect((await duplicate.json()).error).toContain('no longer available');

    await page.reload();
    await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
    await expect(tripCards).toHaveCount(1);
  } finally {
    const platform = await page.request.get('/api/platform?scope=traveler').then((response) => response.json()) as { trips?: Array<{ id: string; destination: string }> };
    for (const trip of platform.trips?.filter((item) => item.destination === destination) || []) {
      await page.request.post('/api/platform', { data: { action: 'delete-trip', id: trip.id } });
    }
  }
});

test('saved trips retain supported currencies and reject mixed-currency itineraries', async ({ page }) => {
  await login(page);
  const prefix = `E2E Currency ${Date.now()}`;
  const date = new Date(Date.now() + 35 * 86_400_000).toISOString().slice(0, 10);
  const cases = [
    { currency: 'PHP', budget: 10_000 },
    { currency: 'USD', budget: 500 },
    { currency: 'EUR', budget: 450 },
    { currency: 'JPY', budget: 75_000 },
  ] as const;

  try {
    for (const { currency, budget } of cases) {
      const destination = `${prefix} ${currency}`;
      const created = await page.request.post('/api/platform', {
        data: {
          action: 'save-trip',
          destination,
          budget,
          currency,
          travelers: 1,
          startDate: date,
          endDate: date,
          interests: ['currency verification'],
          itinerary: {
            destination,
            totalBudget: budget,
            currency,
            days: [{ day: 1, date, activities: [] }],
          },
          weather: { source: 'unavailable', forecast: [] },
        },
      });
      expect(created.ok(), `${currency}: ${await created.text()}`).toBe(true);
    }

    const mismatchDestination = `${prefix} mismatch`;
    const mismatch = await page.request.post('/api/platform', {
      data: {
        action: 'save-trip',
        destination: mismatchDestination,
        budget: 500,
        currency: 'USD',
        travelers: 1,
        startDate: date,
        endDate: date,
        interests: ['currency verification'],
        itinerary: {
          destination: mismatchDestination,
          totalBudget: 500,
          currency: 'EUR',
          days: [{ day: 1, date, activities: [] }],
        },
        weather: { source: 'unavailable', forecast: [] },
      },
    });
    expect(mismatch.status()).toBe(400);
    await expect(mismatch.json()).resolves.toMatchObject({ error: 'Itinerary currency must match the trip currency.' });

    await page.reload();
    await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
    for (const { currency, budget } of cases) {
      const card = page.locator('article').filter({ hasText: `${prefix} ${currency}` });
      await expect(card).toHaveCount(1);
      await expect(card).toContainText(currency);
      await expect(card).toContainText(budget.toLocaleString('en-US'));
    }
    await expect(page.locator('article').filter({ hasText: mismatchDestination })).toHaveCount(0);
  } finally {
    const platform = await page.request.get('/api/platform?scope=traveler').then((response) => response.json()) as { trips?: Array<{ id: string; destination: string }> };
    for (const trip of platform.trips?.filter((item) => item.destination.startsWith(prefix)) || []) {
      await page.request.post('/api/platform', { data: { action: 'delete-trip', id: trip.id } });
    }
  }
});

test('provider failures preserve local comparison data and allow itinerary retry without weather claims', async ({ page }) => {
  await login(page);
  await page.route('**/api/locations?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ locations: [{ id: 1, name: 'Cordova', region: 'Cebu', country: 'Philippines', countryCode: 'PH', latitude: 10.2525, longitude: 123.9494, label: 'Cordova, Cebu, Philippines' }] }),
  }));
  await page.route('**/api/destination-context?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      currency: 'PHP', currencySource: 'country-code',
      transportation: [{ id: 'jeepney', label: 'Jeepney', category: 'public' }],
      transportationSource: 'curated-country-city-guidance',
      transportationMessage: 'Common destination-specific modes from TravelMate guidance; availability and schedules are not live.',
    }),
  }));
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

  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill('Cord');
  await page.getByRole('option').getByRole('button', { name: /Cordova/i }).click();
  await expect(page.getByRole('combobox', { name: /Destination currency/i, exact: false })).toHaveValue('PHP');
  await expect(page.getByText('Hotel provider unavailable.')).toBeVisible();

  await page.getByRole('button', { name: 'Travel options', exact: true }).click();
  await page.getByRole('button', { name: 'Compare prices', exact: true }).click();

  const status = page.getByRole('status');
  await expect(status).toContainText('Flight and activity provider unavailable.');
  await expect(page.getByText('Run a comparison to retrieve flight offers.')).toBeVisible();
  await expect(page.getByText('Run a comparison to retrieve activity options.')).toBeVisible();
  await expect(page.getByText('TravelMate database · not live').first()).toBeVisible();
  await expect(page.getByText('Harbor View Guesthouse')).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);

  let itineraryShouldFail = true;
  let weatherShouldBeMalformed = false;
  let conditionsRefreshed = false;
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
      fetchedAt: conditionsRefreshed ? '2026-09-15T02:00:00.000Z' : '2026-09-15T00:00:00.000Z',
      refreshAfter: conditionsRefreshed ? '2026-09-15T03:00:00.000Z' : '2026-09-15T01:00:00.000Z',
      freshness: {
        source: 'weather',
        status: 'unavailable',
        isStale: false,
        fetchedAt: conditionsRefreshed ? '2026-09-15T02:00:00.000Z' : '2026-09-15T00:00:00.000Z',
        expiresAt: conditionsRefreshed ? '2026-09-15T03:00:00.000Z' : '2026-09-15T01:00:00.000Z',
        staleUntil: conditionsRefreshed ? '2026-09-15T03:00:00.000Z' : '2026-09-15T01:00:00.000Z',
        policy: '15m fresh; stale fallback up to 60m when the provider fails.',
      },
      crowd: conditionsRefreshed ? [{
        date: new URL(route.request().url()).searchParams.get('startDate'),
        crowdLevel: 'high',
        crowdSource: 'estimated',
        crowdConfidence: 'low',
        crowdNote: 'Calendar estimate; this is not live foot-traffic data.',
        crowdRecommendation: 'Visit before 9:00 AM. No activity was moved automatically.',
        fetchedAt: '2026-09-15T02:00:00.000Z',
        refreshAfter: '2026-09-16T02:00:00.000Z',
      }] : [],
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

  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('AI itinerary generation is temporarily unavailable.');
  await expect(page.getByRole('heading', { name: 'Required trip details', exact: true })).toBeVisible();

  itineraryShouldFail = false;
  await page.getByRole('button', { name: 'Retry generation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Demo fallback plan ready. Its recommendations and prices are estimates.');
  await expect(page.getByText('Weather unavailable for Cordova, Cebu, Philippines')).toBeVisible();
  await expect(page.getByText('No current conditions or alerts are being claimed.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Provider recovery test', exact: true })).toBeVisible();

  conditionsRefreshed = true;
  await page.getByRole('button', { name: 'Refresh conditions', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Your itinerary activities and manual edits were not changed.');
  await expect(page.getByText('Visit before 9:00 AM. No activity was moved automatically.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Provider recovery test', exact: true })).toBeVisible();

  itineraryShouldFail = true;
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('AI itinerary generation is temporarily unavailable.');
  await expect(page.getByRole('heading', { name: 'Provider recovery test', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry generation', exact: true })).toBeVisible();

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
  await page.getByRole('button', { name: 'Retry generation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Weather service returned an invalid response.');
  await expect(page.getByRole('heading', { name: 'Provider recovery test', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});
