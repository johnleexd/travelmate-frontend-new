import { expect, test } from '@playwright/test';

test('activity arrows work on short and narrow screens without a photo', async ({ page, context }) => {
  const date = '2026-10-10';
  const day = {
    day: 1, date, theme: 'Culture day', imageUrl: '', totalCost: 200,
    activities: ['Heritage site briefing', 'Museum visit'].map((title) => ({
      title, time: '09:00 AM', description: 'A guided explanation of regional history and local customs.',
      estimatedCost: 100, category: 'activity', icon: 'map', imageUrl: '',
    })),
  };
  const itinerary = {
    destination: 'Tokyo, Japan', currency: 'JPY', totalBudget: 1000, days: [day],
    budgetSummary: { accommodation: 0, food: 0, activities: 200, transport: 0, reserve: 800, dailyAverage: 200, total: 1000 },
  };
  await context.addCookies([{ name: 'travelmate_session', value: 'layout-test', domain: 'localhost', path: '/' }]);
  await page.route('**/api/platform**', (route) => route.fulfill({ json: {
    user: { id: 'layout', name: 'Layout Test', email: 'layout@example.test', role: 'traveler', emailVerified: true, accountStatus: 'active' },
    trips: [{ id: 'trip', destination: itinerary.destination, startDate: date, endDate: date, budget: 1000, currency: 'JPY', travelers: 1, partyType: 'solo', interests: [], status: 'saved', itinerary, createdAt: date }],
    listings: [], bookings: [], directory: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {},
  } }));
  await page.route('**/api/itinerary/images', (route) => route.fulfill({ json: { day } }));
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'Full details', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const viewport of [{ width: 1085, height: 500 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await expect(dialog.getByText('Activity 1 of 2', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Next activity', exact: true }).click();
    await expect(dialog.getByText('Activity 2 of 2', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Next activity', exact: true }).click();
    await expect(dialog.getByText('Activity 1 of 2', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Previous activity', exact: true }).click();
    await expect(dialog.getByText('Activity 2 of 2', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Previous activity', exact: true }).click();
  }
  await dialog.getByRole('button', { name: 'Close day details' }).click();
  await expect(dialog).toHaveCount(0);
});
