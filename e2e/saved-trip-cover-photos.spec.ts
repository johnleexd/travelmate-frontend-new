import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

const user = { id: 'cover-owner', name: 'Cover Tester', email: 'cover@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const makeTrip = (id: string, city: string, country: string, code: string, latitude: number, longitude: number) => ({
  id, userId: user.id, destination: city + ', ' + country, destinationCity: city, destinationCountry: country, destinationCountryCode: code, latitude, longitude,
  budget: 12345, currency: code === 'JP' ? 'JPY' : 'PHP', travelers: 2, partyType: 'couple', interests: [], startDate: '2040-10-08', endDate: '2040-10-09',
  status: 'active', createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z', itinerary: null, weather: null, completedAt: null as string | null,
});
const trips = [makeTrip('manila', 'Manila', 'Philippines', 'PH', 14.6042, 120.9822),
  makeTrip('fukuoka', 'Fukuoka', 'Japan', 'JP', 33.6, 130.41667), makeTrip('manila-again', 'Manila', 'Philippines', 'PH', 14.6042, 120.9822),
  makeTrip('missing', 'Paris', 'France', 'FR', 48.8534, 2.3488)];
const photo = (city: string) => ({
  src: city === 'Manila' ? 'https://upload.wikimedia.org/wikipedia/commons/e/ea/The_Manila_Cathedral.jpg' : 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Fukuoka_City_from_Fukuoka_Tower.jpg',
  kind: 'destination-photo', city, countryCode: city === 'Manila' ? 'PH' : 'JP', scope: 'destination',
  label: city === 'Manila' ? 'Manila Cathedral, Manila, Philippines' : 'Fukuoka skyline viewed from Fukuoka Tower, Japan',
  attribution: { creator: city === 'Manila' ? 'Kuranges' : 'そらみみ', license: city === 'Manila' ? 'CC BY-SA 3.0' : 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:' + (city === 'Manila' ? 'The_Manila_Cathedral.jpg' : 'Fukuoka_City_from_Fukuoka_Tower.jpg') },
});
const saved = async (page: Page) => page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
async function setup(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: 'travelmate_session', value: 'cover-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await mockPlanningLookups(page);
  const state = { trips: structuredClone(trips), photoRequests: [] as URL[], posts: [] as Record<string, unknown>[], feedback: [] as Record<string, unknown>[], details: [] as string[], histories: [] as string[] };
  await page.route('**/api/destination-context/photo?*', route => {
    const url = new URL(route.request().url()); state.photoRequests.push(url);
    const city = url.searchParams.get('city')!;
    return route.fulfill({ json: { photo: city === 'Manila' || city === 'Fukuoka' ? photo(city) : null } });
  });
  await page.route('**/api/feedback**', route => {
    if (route.request().method() === 'POST') state.feedback.push(route.request().postDataJSON());
    return route.fulfill({ json: { result: null } });
  });
  await page.route('**/api/platform**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (url.pathname.endsWith('/versions')) { state.histories.push(url.pathname); return route.fulfill({ json: { versions: [], page: { total: 0, nextCursor: null } } }); }
    const id = url.pathname.match(/\/trips\/([^/]+)$/)?.[1];
    if (id) {
      state.details.push(id); const trip = state.trips.find(item => item.id === id)!;
      return route.fulfill({ json: { trip: { ...trip, itinerary: { destination: trip.destination, currency: trip.currency, totalBudget: trip.budget, travelers: trip.travelers, partyType: trip.partyType, source: 'mock',
        days: [{ day: 1, date: trip.startDate, theme: 'Explore ' + trip.destinationCity, imageUrl: '', totalCost: 0, activities: [] }, { day: 2, date: trip.endDate, theme: 'Continue exploring', imageUrl: '', totalCost: 0, activities: [] }],
        budgetSummary: { total: trip.budget, accommodation: 0, food: 0, activities: 0, transport: 0, reserve: trip.budget, dailyAverage: trip.budget / 2, plannedSpend: 0, remainingBudget: trip.budget, shortfall: 0 } } } } });
    }
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); state.posts.push(body);
      const trip = state.trips.find(item => item.id === body.id)!;
      if (body.action === 'complete-trip') { trip.status = 'completed'; trip.completedAt = '2026-10-09T00:00:00Z'; }
      if (body.action === 'reopen-trip') { trip.status = 'active'; trip.completedAt = null; }
      if (body.action === 'archive-trip') trip.status = 'archived';
      if (body.action === 'restore-trip') trip.status = trip.completedAt ? 'completed' : 'active';
      return route.fulfill({ json: { result: trip } });
    }
    return route.fulfill({ json: { user, trips: state.trips, tripsPage: { total: 4, hasMore: false, nextCursor: null }, directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.goto('/dashboard'); await saved(page);
  return state;
}

test('destination covers show real Manila and Fukuoka photos, preserve geometry, lazy-load and cache duplicate cities', async ({ page, context }) => {
  const state = await setup(page, context);
  const cards = page.getByRole('region', { name: 'Saved plans' }).getByRole('article');
  await expect(cards).toHaveCount(4);
  await expect.poll(() => state.photoRequests.length).toBe(3);
  for (const [index, city] of [[0, 'Manila'], [1, 'Fukuoka']] as const) {
    const image = cards.nth(index).getByRole('img'); await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(image).toHaveAttribute('alt', new RegExp(city)); await expect(image).toHaveAttribute('loading', 'lazy');
    expect(await image.evaluate(img => getComputedStyle(img).objectFit)).toBe('cover');
    const request = state.photoRequests.find(url => url.searchParams.get('city') === city)!;
    expect(request.searchParams.get('countryCode')).toBe(city === 'Manila' ? 'PH' : 'JP');
    expect(request.searchParams.has('latitude') && request.searchParams.has('longitude')).toBe(true);
    await expect(cards.nth(index).getByRole('link', { name: 'Photo:', exact: false })).toBeVisible();
  }
  await expect(cards.nth(3).getByText('Destination photo unavailable', { exact: true })).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await cards.first().scrollIntoViewIfNeeded();
    const geometry = await cards.first().getByRole('img').evaluate(img => {
      const parent = img.parentElement!; const box = parent.getBoundingClientRect();
      return { height: box.height, radius: getComputedStyle(parent).borderRadius, overflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    expect(geometry.height).toBe(width < 480 ? 160 : 180); expect(geometry.radius).toBe('11px'); expect(geometry.overflow).toBe(false);
    await page.screenshot({ path: '../audit/2026-10-09/saved-trip-cover-photos/covers-' + width + '.png' });
  }
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Home', exact: true }).click(); await saved(page);
  await expect(cards).toHaveCount(4); expect(state.photoRequests).toHaveLength(3); expect(state.posts).toHaveLength(0); expect(state.details).toHaveLength(0);
});

test('failed destination images keep the neutral placeholder and status badge without flags or layout changes', async ({ page, context }) => {
  await page.route('**/_next/image?*', route => route.fulfill({ status: 404, body: '' }));
  await setup(page, context);
  const cards = page.getByRole('region', { name: 'Saved plans' }).getByRole('article');
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByText('Destination photo unavailable', { exact: true })).toBeVisible();
    await expect(card.getByText('Upcoming trip', { exact: true })).toBeVisible();
    await expect(card.getByRole('img')).toHaveCount(0);
    expect(await card.locator('[class*="image"]').evaluate(el => el.getBoundingClientRect().height)).toBe(180);
    await expect(card.getByRole('button', { name: 'View itinerary', exact: true })).toBeVisible();
  }
});

test('View, Edit, completion, rating, history, archive and restore retain their original behavior', async ({ page, context }) => {
  const state = await setup(page, context);
  const card = () => page.getByRole('region', { name: 'Saved plans' }).getByRole('article').filter({ has: page.getByRole('heading', { name: 'Manila, Philippines', exact: true }) }).first();
  await card().getByRole('button', { name: 'View itinerary', exact: true }).click();
  await expect(page.getByText('Saved trip loaded.', { exact: false })).toBeVisible(); expect(state.details).toEqual(['manila']); await saved(page);
  await card().getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit saved trip', exact: true }); await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: 'Close trip editor' }).click();
  const trigger = card().getByRole('button', { name: 'More options for Manila, Philippines' }); await trigger.focus(); await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: 'Rate this trip', exact: true })).toBeFocused(); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await trigger.click(); await page.getByRole('menuitem', { name: 'Rate this trip', exact: true }).click();
  const form = page.getByRole('form', { name: 'Feedback for Manila, Philippines' }); await form.getByRole('radio', { name: '5 stars' }).check();
  await form.getByLabel('Feedback comment').fill('A useful saved trip plan.'); await form.getByRole('button', { name: 'Submit Feedback', exact: true }).click();
  expect(state.feedback[0]).toMatchObject({ itineraryId: 'manila', rating: 5, comment: 'A useful saved trip plan.' });
  await card().getByRole('button', { name: 'More options for Manila, Philippines' }).click(); await page.getByRole('menuitem', { name: 'Version history', exact: true }).click();
  await expect(card().getByText('No version snapshots are available for this legacy trip.', { exact: true })).toBeVisible(); expect(state.histories).toHaveLength(1);
  await card().getByRole('button', { name: 'Mark as done', exact: true }).click();
  await expect(card().getByRole('button', { name: 'Mark as not done', exact: true })).toBeVisible(); await expect(card().getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  expect(state.posts.at(-1)).toEqual({ action: 'complete-trip', id: 'manila' });
  await card().getByRole('button', { name: 'Mark as not done', exact: true }).click(); expect(state.posts.at(-1)).toEqual({ action: 'reopen-trip', id: 'manila' });
  await card().getByRole('button', { name: 'More options for Manila, Philippines' }).click(); await page.getByRole('menuitem', { name: 'Archive', exact: true }).click();
  await page.getByRole('button', { name: 'Archived 1', exact: true }).click(); await expect(card().getByRole('button', { name: 'Delete permanently', exact: true })).toBeVisible();
  await expect(card().getByRole('button', { name: 'View itinerary', exact: true })).toHaveCount(0);
  expect(state.posts.at(-1)).toEqual({ action: 'archive-trip', id: 'manila' });
  await card().getByRole('button', { name: 'More options for Manila, Philippines' }).click(); await page.getByRole('menuitem', { name: 'Restore trip', exact: true }).click();
  expect(state.posts.at(-1)).toEqual({ action: 'restore-trip', id: 'manila' });
});
