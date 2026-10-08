import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

const user = { id: 'trip-map-owner', name: 'Travel Tester', email: 'map@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const plan = {
  destination: 'Manila, Philippines', currency: 'PHP', totalBudget: 20000, source: 'mock', travelers: 1, partyType: 'solo',
  days: [{ day: 1, date: '2040-10-08', theme: 'Manila day', imageUrl: '', totalCost: 400, activities: [
    { title: 'Museum visit', time: '09:00', description: 'See the exhibits.', category: 'activity', icon: 'map', estimatedCost: 400 },
  ] }],
  budgetSummary: { accommodation: 0, food: 0, activities: 400, transport: 0, reserve: 19600, dailyAverage: 400, total: 20000, plannedSpend: 400 },
};
const trip = { id: 'map-manila', userId: user.id, destination: plan.destination, destinationCity: 'Manila', destinationCountry: 'Philippines', destinationCountryCode: 'PH', latitude: 14.5995, longitude: 120.9842, budget: 20000, currency: 'PHP', travelers: 1, partyType: 'solo', interests: [], startDate: '2040-10-08', endDate: '2040-10-08', status: 'active', createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z', itinerary: plan, weather: null };

async function setup(page: Page, context: BrowserContext, missingCoordinates = false, failTiles = false) {
  await context.addCookies([{ name: 'travelmate_session', value: 'map-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  // Render real Leaflet with a local tile fixture, never scrape public map tiles in automation.
  await page.route('https://tile.openstreetmap.org/**', route => failTiles ? route.abort() : route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#dce5db"/><path d="M0 150L256 80M120 0L180 256" stroke="#fff" stroke-width="5"/><text x="10" y="24" fill="#526b59" font-size="12">Test map tile</text></svg>',
  }));
  const requests: Array<{ path: string; method: string }> = [];
  await page.route('**/api/platform**', route => {
    const path = new URL(route.request().url()).pathname;
    requests.push({ path, method: route.request().method() });
    if (path.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    const detail = missingCoordinates ? { ...trip, latitude: null, longitude: null } : trip;
    if (path.endsWith(`/trips/${trip.id}`)) return route.fulfill({ json: { trip: detail } });
    return route.fulfill({ json: { user, trips: [{ ...detail, itinerary: null }], tripsPage: { total: 1, hasMore: false, nextCursor: null }, directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.route('**/api/locations/current**', () => { throw new Error('Trip GPS must not reverse-geocode or persist location.'); });
  await page.goto('/dashboard');
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'View', exact: true }).click();
  const map = page.getByRole('region', { name: 'Your trip map', exact: true });
  await expect(map).toBeVisible();
  return { map, requests };
}

async function instrumentGps(page: Page) {
  await page.addInitScript(() => {
    const stats = { requested: 0, cleared: 0 };
    Object.defineProperty(window, 'tripGpsStats', { value: stats });
    const gps = navigator.geolocation;
    const watch = gps.watchPosition.bind(gps), clear = gps.clearWatch.bind(gps);
    gps.watchPosition = (...args) => { stats.requested++; return watch(...args); };
    gps.clearWatch = id => { stats.cleared++; clear(id); };
  });
}
const gpsStats = (page: Page) => page.evaluate(() => (window as unknown as { tripGpsStats: { requested: number; cleared: number } }).tripGpsStats);

test('saved-trip View maps destination and opt-in live GPS, updates directions, fits mobile, and stops on exit', async ({ page, context }) => {
  await instrumentGps(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 14.55, longitude: 121.05, accuracy: 20 });
  const { map, requests } = await setup(page, context);
  await expect(map.getByRole('button', { name: 'Destination: Manila, Philippines', exact: true })).toBeVisible();
  expect((await gpsStats(page)).requested).toBe(0);
  const link = map.getByRole('link', { name: 'Get directions' });
  expect(new URL((await link.getAttribute('href'))!).searchParams.has('origin')).toBe(false);
  await map.getByRole('button', { name: 'Show my location', exact: true }).click();
  await expect(map.getByRole('button', { name: 'Your current location', exact: true })).toBeVisible();
  await expect(map).toContainText('accuracy ±20 m');
  await expect(map).toContainText('straight-line distance');
  expect(new URL((await link.getAttribute('href'))!).searchParams.get('destination')).toBe('14.5995,120.9842');
  await context.setGeolocation({ latitude: 14.56, longitude: 121.06, accuracy: 12 });
  await expect.poll(async () => new URL((await link.getAttribute('href'))!).searchParams.get('origin')).toBe('14.56,121.06');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await map.screenshot({ path: '../audit/2026-10-08/trip-location-map/map-desktop.png' });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await map.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await map.evaluate(element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth; })).toBe(true);
    await expect(map.getByRole('link', { name: 'OpenStreetMap', exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await map.screenshot({ path: '../audit/2026-10-08/trip-location-map/map-mobile.png' });
  await map.getByRole('button', { name: 'Stop sharing location', exact: true }).click();
  await expect(map.getByRole('button', { name: 'Your current location', exact: true })).toHaveCount(0);
  expect(new URL((await link.getAttribute('href'))!).searchParams.has('origin')).toBe(false);
  await map.getByRole('button', { name: 'Show my location', exact: true }).click();
  await expect(map).toContainText('Live location');
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  await expect(map).toHaveCount(0);
  await expect.poll(async () => (await gpsStats(page)).cleared).toBe(2);
  expect(requests.every(request => request.method === 'GET')).toBe(true);
});

test('denied permission and GPS timeout give retry messages while destination remains usable', async ({ page, context }) => {
  await page.addInitScript(() => {
    let attempts = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition: (_success: unknown, error: (value: { code: number }) => void) => { setTimeout(() => error({ code: ++attempts === 1 ? 1 : 3 }), 0); return attempts; },
      clearWatch: () => {},
    } });
  });
  const { map } = await setup(page, context);
  await map.getByRole('button', { name: 'Show my location', exact: true }).click();
  await expect(map).toContainText('Location permission was denied');
  await map.getByRole('button', { name: 'Try location again', exact: true }).click();
  await expect(map).toContainText('Finding your location took too long');
  await expect(map.getByRole('button', { name: 'Destination: Manila, Philippines', exact: true })).toBeVisible();
  await expect(map.getByRole('link', { name: 'Get directions' })).toBeVisible();
});

test('legacy trips without coordinates never invent a destination marker', async ({ page, context }) => {
  const { map } = await setup(page, context, true);
  await expect(map).toContainText('no destination coordinates');
  await expect(map.locator('.leaflet-container')).toHaveCount(0);
  const url = new URL((await map.getByRole('link', { name: 'Get directions' }).getAttribute('href'))!);
  expect(url.searchParams.get('destination')).toBe('Manila, Philippines');
});

type FakeGps = { fixes: PositionCallback[]; errors: PositionErrorCallback[]; cleared: number[] };
const emitFix = (page: Page, index: number, latitude: number) => page.evaluate(({ index, latitude }) => {
  const gps = (window as unknown as { fakeTripGps: FakeGps }).fakeTripGps;
  gps.fixes[index]({ coords: { latitude, longitude: 121.05, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() } as GeolocationPosition);
}, { index, latitude });

test('temporary signal loss recovers, and late GPS callbacks cannot restore stopped sharing', async ({ page, context }) => {
  await page.addInitScript(() => {
    const gps: FakeGps = { fixes: [], errors: [], cleared: [] };
    Object.defineProperty(window, 'fakeTripGps', { value: gps });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition: (fix: PositionCallback, error: PositionErrorCallback) => { gps.fixes.push(fix); gps.errors.push(error); return gps.fixes.length - 1; },
      clearWatch: (id: number) => gps.cleared.push(id),
    } });
  });
  const { map } = await setup(page, context);
  const directions = map.getByRole('link', { name: 'Get directions' });
  await map.getByRole('button', { name: 'Show my location', exact: true }).click();
  await emitFix(page, 0, 14.55);
  await expect(map).toContainText('Live location');
  await page.evaluate(() => (window as unknown as { fakeTripGps: FakeGps }).fakeTripGps.errors[0]({ code: 2 } as GeolocationPositionError));
  await expect(map).toContainText('Last known location');
  await expect(map).toContainText('trying to reconnect');
  await emitFix(page, 0, 14.56);
  await expect(map).toContainText('Live location');
  expect(new URL((await directions.getAttribute('href'))!).searchParams.get('origin')).toBe('14.56,121.05');
  await map.getByRole('button', { name: 'Stop sharing location', exact: true }).click();
  await emitFix(page, 0, 14.57);
  await expect(map).toContainText('Location sharing stopped');
  expect(new URL((await directions.getAttribute('href'))!).searchParams.has('origin')).toBe(false);
  await map.getByRole('button', { name: 'Show my location', exact: true }).click();
  await emitFix(page, 0, 14.58);
  await expect(map).toContainText('Finding your location');
  await emitFix(page, 1, 14.59);
  await expect(map).toContainText('Live location');
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  await emitFix(page, 1, 14.60);
  expect(await page.evaluate(() => (window as unknown as { fakeTripGps: FakeGps }).fakeTripGps.cleared)).toEqual([0, 1]);
  await page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'View', exact: true }).click();
  await expect(map.getByRole('button', { name: 'Show my location', exact: true })).toBeVisible();
  expect(new URL((await directions.getAttribute('href'))!).searchParams.has('origin')).toBe(false);
});

test('unavailable tiles show a fallback and hiding the tab clears location sharing', async ({ page, context }) => {
  await instrumentGps(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 14.55, longitude: 121.05, accuracy: 20 });
  const { map } = await setup(page, context, false, true);
  await expect(map).toContainText('Map tiles are unavailable');
  await map.getByRole('button', { name: 'Show my location', exact: true }).click();
  await expect(map).toContainText('Live location');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(map).toContainText('Location sharing paused');
  await expect(map.getByRole('button', { name: 'Your current location', exact: true })).toHaveCount(0);
  expect((await gpsStats(page)).cleared).toBe(1);
});
