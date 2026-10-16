import { test, expect, type Page } from '@playwright/test';
import { setup, user } from './fixtures/planner-fixture';

async function checkFields(page: Page) {
  await expect(page.getByText('Accommodation suggestions', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Travel style', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/Interests|Preferred activities|Stay preference/i)).toHaveCount(0);
  await expect(page.locator('#trip-interests, #trip-interests-help, #trip-interests-error')).toHaveCount(0);
  await expect(page.locator('#trip-stay-preference, #trip-preferred-activities, #transportation')).toHaveCount(0);
  const positions = await page.locator('#trip-accommodation, #trip-travel-style').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  expect(positions).toHaveLength(2);
  expect(positions.every((top, index) => index === 0 || top > positions[index - 1])).toBeTruthy();
}

async function chooseTokyo(page: Page) {
  await page.locator('#destination-search').fill('Tokyo');
  await page.locator('#destination-suggestions').getByRole('button').filter({ hasText: 'Japan' }).first().click();
  await page.locator('#trip-budget').fill('300000');
  await page.locator('#trip-end-date').fill(await page.locator('#trip-start-date').inputValue());
}

test('new trips generate without retired activity fields before and after refresh', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.goto('/dashboard?tab=planner');
  await checkFields(page);
  await page.reload();
  await checkFields(page);
  await chooseTokyo(page);
  await page.getByLabel('Travel style', { exact: true }).selectOption('budget');
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect.poll(() => state.saved).not.toBeNull();
  expect(state.generations[0]).toMatchObject({ travelStyle: 'budget', travelers: 1, partyType: 'solo' });
  for (const field of ['interests', 'preferredActivities', 'transportationPreference']) expect(state.generations[0]).not.toHaveProperty(field);
  expect(state.saved!.itinerary.preferences).toMatchObject({ travelStyle: 'budget', interests: [], activities: [] });
});

test('style and accommodation selection persist through save, reopen and mobile refresh', async ({ page, context }) => {
  const state = await setup(page, context);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dashboard?tab=planner');
  await chooseTokyo(page);
  await page.getByRole('button', { name: 'Browse accommodations', exact: true }).click();
  await page.getByRole('button', { name: 'Select accommodation: Preferences Test Hotel', exact: true }).click();
  await page.getByLabel('Travel style', { exact: true }).selectOption('comfort');
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect.poll(() => state.saved).not.toBeNull();
  expect(state.generations[0]).toMatchObject({ travelStyle: 'comfort', plannedAccommodation: { name: 'Preferences Test Hotel' } });
  expect(state.generations[0]).not.toHaveProperty('interests');
  expect(state.generations[0]).not.toHaveProperty('preferredActivities');
  await expect(page).toHaveURL(/trip=preferences-trip/);
  await page.reload();
  await page.getByText('Trip planning settings', { exact: true }).click();
  await checkFields(page);
  await expect(page.getByLabel('Travel style', { exact: true })).toHaveValue('comfort');
  await expect(page.locator('#trip-accommodation').getByText('Preferences Test Hotel', { exact: true })).toBeVisible();
  await page.getByLabel('Travel style', { exact: true }).selectOption('family-friendly');
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect.poll(() => state.saved!.itinerary.preferences?.travelStyle).toBe('family-friendly');
  await page.reload();
  await page.getByText('Trip planning settings', { exact: true }).click();
  await checkFields(page);
  await expect(page.getByLabel('Travel style', { exact: true })).toHaveValue('family-friendly');
  await expect(page.locator('#trip-accommodation').getByText('Preferences Test Hotel', { exact: true })).toBeVisible();
  expect(state.saved!.itinerary.plannedAccommodation?.name).toBe('Preferences Test Hotel');
  await page.setViewportSize({ width: 390, height: 1000 });
  await checkFields(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#trip-accommodation').locator('..').screenshot({ path: 'test-results/style-only-form-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.locator('#trip-accommodation').evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 120));
  await page.locator('#trip-accommodation').locator('..').screenshot({ path: 'test-results/style-only-form-after-refresh.png' });
  expect(errors).toEqual([]);
});

test('legacy trip edits preserve each historical list and never regenerate automatically', async ({ page, context }) => {
  const state = await setup(page, context);
  state.saved = { id: 'preferences-trip', userId: user.id, status: 'active', destination: 'Tokyo, Japan', destinationCity: 'Tokyo', destinationCountry: 'Japan', destinationCountryCode: 'JP', latitude: 35.6762, longitude: 139.6503, budget: 300000, currency: 'JPY', travelers: 1, partyType: 'solo', startDate: '2040-01-25', endDate: '2040-01-25', interests: ['Food', 'food', 'culture'], createdAt: new Date().toISOString(), itinerary: { destination: 'Tokyo, Japan', totalBudget: 300000, currency: 'JPY', preferences: { travelStyle: 'luxury', accommodation: 'resort', transportation: 'walking', interests: ['food', 'nature'], activities: ['Culture', 'snorkeling', 'FOOD'] }, days: [{ day: 1, date: '2040-01-25', theme: 'Recorded day', imageUrl: '', totalCost: 0, activities: [] }], budgetSummary: { accommodation: 0, food: 0, activities: 0, transport: 0, reserve: 300000, dailyAverage: 0, total: 0 } } };
  const historical = structuredClone(state.saved);
  await page.goto('/dashboard?tab=planner&trip=preferences-trip&from=saved');
  await page.getByText('Trip planning settings', { exact: true }).click();
  await checkFields(page);
  await expect(page.getByLabel('Travel style', { exact: true })).toHaveValue('luxury');
  expect(state.writes).toHaveLength(0);
  expect(state.generations).toHaveLength(0);
  await page.getByLabel('Travel style', { exact: true }).selectOption('comfort');
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).not.toHaveProperty('interests');
  expect(state.saved!.interests).toEqual(historical.interests);
  expect(state.saved!.itinerary.preferences?.interests).toEqual(historical.itinerary.preferences?.interests);
  expect(state.saved!.itinerary.preferences?.activities).toEqual(historical.itinerary.preferences?.activities);
  expect(state.saved!.itinerary.preferences?.transportation).toBe(historical.itinerary.preferences?.transportation);
  expect(state.saved!.itinerary.days).toEqual(historical.itinerary.days);
  await page.reload();
  await page.getByText('Trip planning settings', { exact: true }).click();
  await checkFields(page);
  await expect(page.getByLabel('Travel style', { exact: true })).toHaveValue('comfort');
  expect(state.generations).toHaveLength(0);
  await page.goto('/dashboard?tab=bookings');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel(/Interests|Preferred activities|Stay preference/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Change trip details', exact: true }).click();
  await checkFields(page);
  await expect(page.getByLabel('Travel style', { exact: true })).toHaveValue('comfort');
  expect(state.generations).toHaveLength(0);
  expect(state.saved!.itinerary.days).toEqual(historical.itinerary.days);
});

test('unavailable accommodation suggestions do not block style-only generation', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.route('**/api/accommodations?**', route => route.fulfill({ status: 502, json: { error: 'Suggestion provider unavailable for this test.' } }));
  await page.goto('/dashboard?tab=planner');
  await chooseTokyo(page);
  await page.getByLabel('Travel style', { exact: true }).selectOption('balanced');
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect.poll(() => state.saved).not.toBeNull();
  expect(state.generations[0]).not.toHaveProperty('plannedAccommodation');
  expect(state.saved!.itinerary.preferences?.travelStyle).toBe('balanced');
});
