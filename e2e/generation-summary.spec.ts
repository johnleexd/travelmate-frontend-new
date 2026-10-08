import { expect, test } from '@playwright/test';

test('generation summary explains missing fields, focuses the fix, and handles building and retry states', async ({ page, context }) => {
  test.setTimeout(90000);
  await context.addCookies([{ name: 'travelmate_session', value: 'summary-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const user = { id: 'summary-traveler', name: 'Summary Traveler', email: 'summary@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
  const destination = 'Manila, National Capital Region, Philippines';
  let saves = 0;
  const requests: Record<string, unknown>[] = [];
  let releaseGeneration: (() => void) | undefined;
  const generationGate = new Promise<void>(resolve => { releaseGeneration = resolve; });
  await page.route('**/api/platform**', route => {
    if (route.request().method() === 'POST') { saves += 1; return route.fulfill({ json: { result: { id: 'summary-trip' } } }); }
    return route.fulfill({ json: { user, directory: [user], trips: [], listings: [], bookings: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {}, integrations: {} } });
  });
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: [{ id: 1, name: 'Manila', label: destination, region: 'National Capital Region', country: 'Philippines', countryCode: 'PH', placeType: 'City', contextLabel: 'City · Philippines', latitude: 14.5995, longitude: 120.9842, source: 'geonames' }] } }));
  await page.route('**/api/destination-context?**', route => route.fulfill({ json: { currency: 'PHP', currencySource: 'country-code', transportation: [], transportationMessage: '' } }));
  await page.route('**/api/destination-context/exchange-rate**', route => route.fulfill({ status: 503, json: { error: 'No reference rate in fixture.' } }));
  await page.route('**/api/accommodations?**', route => route.fulfill({ json: { configured: false, status: 'ready', accommodations: [], nearbyAccommodations: [] } }));
  await page.route('**/api/weather?**', route => route.fulfill({ status: 503, json: { error: 'No weather in fixture.' } }));
  await page.route('**/api/itinerary', async route => {
    const body = route.request().postDataJSON(); requests.push(body);
    if (requests.length === 1) {
      await generationGate;
      return route.fulfill({ status: 503, json: { error: 'Generation is temporarily unavailable. Please retry.' } });
    }
    return route.fulfill({ json: { destination: body.destination, totalBudget: body.budget, currency: 'PHP', source: 'mock',
      days: [1, 2, 3].map(day => ({ day, date: '2040-01-0' + day, theme: 'Explore Manila', imageUrl: '', totalCost: 0, activities: [] })),
      budgetSummary: { accommodation: 0, food: 0, activities: 0, transport: 0, reserve: 0, dailyAverage: 0, total: body.budget, accommodationActual: 0, plannedSpend: 0 },
    } });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Trip generation', exact: true });
  const generate = summary.getByRole('button', { name: 'Generate my trip', exact: true });
  const budget = page.getByLabel(/^Solo trip budget/);
  const start = page.getByLabel('Start date', { exact: true });
  const end = page.getByLabel(/^End date/);
  await expect(generate).toBeDisabled();
  await expect(summary.getByText('Complete these details to generate your trip', { exact: true })).toBeVisible();
  await expect(summary.getByText('Choose and confirm a destination to continue.', { exact: true })).toBeVisible();
  await expect(summary.getByText('Enter a total trip budget greater than zero to continue.', { exact: true })).toBeVisible();
  await expect(generate).toHaveAttribute('aria-describedby', 'generation-requirements');
  await expect(summary.getByText('2 details left to complete', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await summary.scrollIntoViewIfNeeded();
  await summary.screenshot({ path: '../audit/2026-10-08/generation-summary-redesign/missing-details-desktop.png' });
  const initialStart = await start.inputValue();
  await start.fill('');
  await expect(summary.getByRole('listitem')).toHaveCount(3);
  await expect(summary.getByText('3 details left to complete', { exact: true })).toBeVisible();
  await expect(summary.getByText('Choose start and end dates for a trip of 1–31 days.', { exact: true })).toBeVisible();
  // Each missing field is actionable even while another requirement comes first.
  await summary.getByRole('button', { name: 'Add budget', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(budget).toBeFocused();
  await summary.getByRole('button', { name: 'Review dates', exact: true }).click();
  await expect(start).toBeFocused();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await summary.scrollIntoViewIfNeeded();
    expect(await summary.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(summary.getByRole('button', { name: 'Add budget', exact: true })).toBeVisible();
  }
  await summary.screenshot({ path: '../audit/2026-10-08/generation-summary-redesign/multiple-requirements-desktop.png' });
  await start.fill(initialStart);
  await expect(summary.getByRole('listitem')).toHaveCount(2);
  await summary.getByRole('button', { name: 'Choose destination', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Destination', exact: true })).toBeFocused();
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill('Manila');
  await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await expect(summary.getByText('Choose and confirm a destination to continue.', { exact: true })).toHaveCount(0);
  await expect(summary.getByText('1 detail left to complete', { exact: true })).toBeVisible();
  await expect(summary.getByText('Enter a total trip budget greater than zero to continue.', { exact: true })).toBeVisible();
  await expect(summary).toContainText('Budget required');
  await expect(summary).not.toContainText('PHP 0.00');
  await expect(summary).not.toContainText('Ready to generate');
  await expect(budget).toHaveValue('');
  await summary.getByRole('button', { name: 'Add budget', exact: true }).click();
  await expect(budget).toBeFocused();
  for (const amount of ['0', '-1', '1000000001', '0.001']) {
    await budget.fill(amount);
    await expect(generate).toBeDisabled();
    await expect(summary.getByText('Complete your trip details', { exact: true })).toBeVisible();
    await expect(summary).toContainText(amount === '1000000001' ? 'Enter a total trip budget of 1,000,000,000 or less.' : amount === '0.001' ? 'PHP budgets must use no more than two decimal places.' : 'Enter a total trip budget greater than zero to continue.');
  }
  await budget.fill('');
  await budget.pressSequentially('0.25');
  await expect(budget).toHaveValue('0.25');
  await expect(generate).toBeEnabled();
  await budget.fill('25000');
  await start.fill('');
  await expect(generate).toBeDisabled();
  await expect(summary.getByText('Dates required', { exact: false })).toBeVisible();
  await summary.getByRole('button', { name: 'Review dates', exact: true }).click();
  await expect(start).toBeFocused();
  await start.fill('2040-01-01');
  await end.fill('');
  await expect(generate).toBeDisabled();
  await end.fill('2040-02-01');
  await expect(generate).toBeDisabled();
  await end.fill('2040-01-03');
  await expect(generate).toBeEnabled();
  await budget.fill('');
  await page.getByRole('button', { name: 'Enter accommodation manually', exact: true }).click();
  await expect(generate).toBeDisabled();
  await expect(summary.getByRole('listitem')).toHaveCount(2);
  await expect(summary).toContainText('Enter a total trip budget greater than zero to continue.');
  await expect(summary).toContainText('Enter the accommodation name or choose accommodation later.');
  await summary.getByRole('button', { name: 'Review accommodation', exact: true }).click();
  await expect(page.getByLabel('Accommodation name', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Choose accommodation later', exact: true }).click();
  await expect(generate).toBeDisabled();
  await expect(summary.getByRole('listitem')).toHaveCount(1);
  await budget.fill('25000');
  await expect(generate).toBeEnabled();
  await expect(summary.getByText('Complete these details to generate your trip', { exact: true })).toHaveCount(0);
  await expect(generate).not.toHaveAttribute('aria-describedby');
  await expect(summary.getByText('Ready to generate', { exact: true })).toBeVisible();
  expect(requests).toHaveLength(0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await summary.scrollIntoViewIfNeeded();
    expect(await summary.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(summary.getByRole('heading', { name: destination, exact: true })).toBeVisible();
  }
  await summary.screenshot({ path: '../audit/2026-10-08/generation-summary-redesign/ready-desktop.png' });
  await page.setViewportSize({ width: 390, height: 900 });
  await budget.fill('');
  await summary.scrollIntoViewIfNeeded();
  await summary.screenshot({ path: '../audit/2026-10-08/generation-summary-redesign/missing-budget-mobile.png' });
  await budget.fill('25000');
  await generate.click();
  await expect(summary.getByRole('button', { name: 'Building your trip...', exact: true })).toBeDisabled();
  await expect(summary).toHaveAttribute('aria-busy', 'true');
  await expect(summary.getByText('Building your trip', { exact: true })).toBeVisible();
  await expect(summary).toContainText('Your itinerary is being generated. Please wait for it to finish.');
  await expect(summary.getByRole('button', { name: 'Building your trip...', exact: true })).toHaveAttribute('aria-describedby', 'generation-progress');
  releaseGeneration!();
  await expect(summary.getByRole('alert')).toContainText('Generation is temporarily unavailable.');
  await expect(summary.getByRole('button', { name: 'Retry generation', exact: true })).toBeEnabled();
  await summary.getByRole('button', { name: 'Retry generation', exact: true }).click();
  await expect.poll(() => saves).toBe(1);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toMatchObject({ budget: 25000, destination, startDate: '2040-01-01', endDate: '2040-01-03' });
  await expect(summary.getByRole('button', { name: 'Generate my trip', exact: true })).toBeEnabled();
});
