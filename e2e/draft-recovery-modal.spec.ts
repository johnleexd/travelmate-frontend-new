import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';
import { readFileSync } from 'node:fs';

const user = { id: 'draft-modal-owner', name: 'Draft Traveler', email: 'draft@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const key = `travelmate-itinerary-draft:${user.id}`;
const itinerary = {
  destination: 'Kyoto, Japan', currency: 'JPY', totalBudget: 60000, travelers: 1, partyType: 'solo', source: 'openai', manuallyEdited: true,
  preferences: { travelStyle: 'balanced', accommodation: 'quiet hotel', transportation: '', activities: ['temples'], pace: 'relaxed' },
  days: [{ day: 1, date: '2040-01-01', theme: 'My edited Kyoto day', imageUrl: '', totalCost: 1000, activities: [{ title: 'My unsaved temple visit', description: 'Draft edit', time: '09:00', durationMinutes: 60, estimatedCost: 1000, category: 'activity', icon: 'activity' }] }],
  budgetSummary: { total: 60000, accommodation: 0, food: 0, activities: 1000, transport: 0, reserve: 59000, dailyAverage: 60000, plannedSpend: 1000, remainingBudget: 59000, shortfall: 0 },
};
const trip = { id: 'draft-trip', userId: user.id, destination: itinerary.destination, destinationCity: 'Kyoto', destinationCountry: 'Japan', destinationCountryCode: 'JP', latitude: 35.0116, longitude: 135.7681, budget: 60000, currency: 'JPY', startDate: '2040-01-01', endDate: '2040-01-01', travelers: 1, partyType: 'solo', interests: ['culture'], status: 'active', createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z', itinerary, weather: null };
const draft = { trip, itinerary, weather: null, savedAt: '2026-10-11T06:45:06Z' };
const workspace = { user, trips: [trip], tripsPage: { total: 1, nextCursor: null }, notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] };

async function setup(page: Page, context: BrowserContext, stored: string | null = JSON.stringify(draft)) {
  await context.addCookies([{ name: 'travelmate_session', value: 'draft-modal-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  await page.route('**/api/auth', route => route.fulfill({ json: { user } }));
  const writes: Record<string, unknown>[] = [];
  let failSave = false;
  await page.route('**/api/platform**', route => {
    if (new URL(route.request().url()).pathname.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (route.request().method() === 'POST') {
      writes.push(route.request().postDataJSON());
      return failSave ? route.fulfill({ status: 503, json: { error: 'Save unavailable. Try again.' } }) : route.fulfill({ json: { result: trip } });
    }
    return route.fulfill({ json: workspace });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let prompts = 0;
  page.on('dialog', dialog => { prompts++; void dialog.dismiss(); });
  await page.addInitScript(({ key, stored }) => { if (stored !== null) localStorage.setItem(key, stored); }, { key, stored });
  await page.goto('/dashboard');
  await expect(page.locator('h1').filter({ hasText: 'Your travel home' })).toBeVisible();
  return { writes, errors, prompts: () => prompts, failSave: () => { failSave = true; }, allowSave: () => { failSave = false; } };
}

test('restores actual draft data without saving, then uses normal save and retry flow', async ({ page, context }) => {
  const state = await setup(page, context);
  const modal = page.getByRole('dialog', { name: 'Continue your trip plan?' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Kyoto, Japan', { exact: true })).toBeVisible();
  await expect(modal.locator('time')).toHaveAttribute('datetime', draft.savedAt.replace('Z', '.000Z'));
  await modal.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your trip itinerary', exact: true })).toBeFocused();
  await expect(page.getByText('Unsaved browser draft restored. Review it, then save your changes.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await expect(page.locator('[data-itinerary-day="1"]:visible').getByRole('heading', { name: 'My unsaved temple visit', exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).itinerary, key)).toEqual(itinerary);
  state.failSave();
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t update trip. Please try again.' })).toBeVisible();
  expect(await page.evaluate(key => !!localStorage.getItem(key), key)).toBe(true);
  state.allowSave();
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Trip updated successfully' })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
  const expectedWrite = { action: 'update-trip-itinerary', id: trip.id, itinerary, expenseAssumptions: {}, planningPreferences: itinerary.preferences };
  expect(state.writes).toEqual([expectedWrite, expectedWrite]);
  expect(state.errors).toEqual([]);
  expect(state.prompts()).toBe(0);
});

test('recovers a complete grounded plan with no saved trip ID and preserves provenance', async ({ page, context }) => {
  const plan = JSON.parse(readFileSync(new URL('./fixtures/generated-daily-schedules.json', import.meta.url), 'utf8')).sufficient;
  const stored = { ...draft, itinerary: plan, weather: { malformed: true }, trip: { ...trip, id: '', destination: plan.destination, currency: plan.currency, budget: plan.totalBudget, travelers: plan.travelers, partyType: plan.partyType, startDate: plan.days[0].date, endDate: plan.days.at(-1).date } };
  const state = await setup(page, context, JSON.stringify(stored));
  const modal = page.getByRole('dialog', { name: 'Continue your trip plan?' });
  await expect(modal.getByText(plan.destination, { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save manual changes', exact: true })).toBeVisible();
  await page.getByText('Trip budget & sources', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Expense sources and confidence' })).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).itinerary.groundingProof, key)).toBe(plan.groundingProof);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

for (const dismissal of ['Not now', 'Escape']) {
  test(`${dismissal} preserves the draft, traps focus and prevents repeated session prompts`, async ({ page, context }) => {
    const state = await setup(page, context);
    const modal = page.getByRole('dialog', { name: 'Continue your trip plan?' });
    const cancel = modal.getByRole('button', { name: 'Not now', exact: true });
    const restore = modal.getByRole('button', { name: 'Restore draft', exact: true });
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(restore).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    if (dismissal === 'Escape') await page.keyboard.press('Escape');
    else await cancel.click();
    await expect(modal).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your travel home', exact: true })).toBeFocused();
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(JSON.stringify(draft));
    const nav = page.getByRole('navigation', { name: 'Traveler workspace' });
    await nav.getByRole('button', { name: 'Notifications', exact: true }).click();
    await nav.getByRole('button', { name: 'Home', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(modal).toHaveCount(0);
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
    expect(state.prompts()).toBe(0);
  });
}

for (const [name, stored] of Object.entries({ missing: null, malformed: '{broken', empty: '{}', 'invalid itinerary': JSON.stringify({ ...draft, itinerary: { destination: trip.destination, days: [null] } }), 'invalid trip': JSON.stringify({ ...draft, trip: { ...trip, interests: null } }), 'invalid timestamp': JSON.stringify({ ...draft, savedAt: 'invalid' }), 'another account': JSON.stringify({ ...draft, trip: { ...trip, userId: 'other' } }) })) {
  test(`${name} draft does not prompt or restore`, async ({ page, context }) => {
    const state = await setup(page, context, stored);
    await expect(page.getByRole('navigation', { name: 'Traveler workspace' })).toBeVisible();
    // Crossing sections exercises the deferred recovery check and workspace rerenders.
    await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Notifications', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Continue your trip plan?' })).toHaveCount(0);
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
    expect(state.prompts()).toBe(0);
  });
}

test('desktop and mobile keep summary and actions visible without overflow', async ({ page, context }) => {
  await setup(page, context);
  const modal = page.getByRole('dialog', { name: 'Continue your trip plan?' });
  await expect(modal).toBeVisible();
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['small-mobile', 320, 568]] as const) {
    await page.setViewportSize({ width, height });
    await expect(modal.getByRole('button', { name: 'Not now', exact: true })).toBeInViewport();
    await expect(modal.getByRole('button', { name: 'Restore draft', exact: true })).toBeInViewport();
    expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const bounds = await modal.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `../audit/2026-10-11/draft-recovery-modal/${name}.png` });
  }
});
