import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

type Coordinate = { latitude: number; longitude: number };
type GpsFixture = { latest: number; fixes: PositionCallback[]; cleared: number[]; denied: boolean };
const user = { id: 'gps-owner', name: 'Travel Tester', email: 'gps@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const destination = { id: 'museum', name: 'Museum', label: 'Museum, Manila, Philippines', latitude: 14.551, longitude: 121.051 };
const plan = { destination: 'Manila, Philippines', currency: 'PHP', totalBudget: 20000, source: 'mock', days: [{ day: 1, date: '2040-10-08', theme: 'Manila', imageUrl: '', totalCost: 0, activities: [] }], budgetSummary: { accommodation: 0, food: 0, activities: 0, transport: 0, reserve: 20000, dailyAverage: 0, total: 20000 } };
const trip = { id: 'gps-saved', userId: user.id, destination: plan.destination, destinationCity: 'Manila', destinationCountry: 'Philippines', destinationCountryCode: 'PH', latitude: 14.551, longitude: 121.051, budget: 20000, currency: 'PHP', travelers: 1, partyType: 'solo', interests: [], startDate: '2040-10-08', endDate: '2040-10-08', status: 'active', createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z', itinerary: plan, weather: null };
function routeFor(origin: Coordinate, target: Coordinate, mode: string) {
  return { origin, destination: target, mode, provider: 'osrm', fetchedAt: '2026-10-08T00:00:00Z', originOffsetMeters: 0, destinationOffsetMeters: 0, distanceMeters: 218, durationSeconds: 180,
    geometry: [origin, { latitude: target.latitude, longitude: origin.longitude }, target], steps: [
      { instruction: 'Head north on Sample Road', distanceMeters: 111, durationSeconds: 90, location: origin, maneuver: 'depart' },
      { instruction: 'Turn right onto Park Street', distanceMeters: 107, durationSeconds: 90, location: { latitude: target.latitude, longitude: origin.longitude }, maneuver: 'turn', modifier: 'right' },
      { instruction: 'Arrive at your destination', distanceMeters: 0, durationSeconds: 0, location: target, maneuver: 'arrive' },
    ] };
}
const move = (page: Page, point: Coordinate, accuracy = 10) => page.evaluate(({ point, accuracy }) => {
  const gps = (window as unknown as { gpsFixture: GpsFixture }).gpsFixture;
  gps.fixes[gps.latest]({ coords: { ...point, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() } as GeolocationPosition);
}, { point, accuracy });

async function setup(page: Page, context: BrowserContext, denied = false, open = true) {
  await context.addCookies([{ name: 'travelmate_session', value: 'gps-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  await page.addInitScript(({ denied }) => {
    const gps: GpsFixture = { latest: -1, fixes: [], cleared: [], denied };
    Object.defineProperty(window, 'gpsFixture', { value: gps });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition: (fix: PositionCallback, error: PositionErrorCallback) => {
        gps.fixes.push(fix); const index = gps.latest = gps.fixes.length - 1;
        queueMicrotask(() => { if (gps.cleared.includes(index)) return; if (gps.denied) error({ code: 1 } as GeolocationPositionError); else fix({ coords: { latitude: 14.55, longitude: 121.05, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() } as GeolocationPosition); });
        return index;
      }, clearWatch: (index: number) => gps.cleared.push(index),
    } });
  }, { denied });
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#dce5db"/><path d="M0 150L256 80M120 0L180 256" stroke="#fff" stroke-width="5"/><text x="10" y="24" fill="#526b59" font-size="12">Test map tile</text></svg>' }));
  await page.route('**/api/platform**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (path.endsWith(`/trips/${trip.id}`)) return route.fulfill({ json: { trip } });
    return route.fulfill({ json: { user, trips: [{ ...trip, itinerary: null }], tripsPage: { total: 1, hasMore: false, nextCursor: null }, directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  const state = { searches: [] as string[], routes: [] as Array<{ origin: Coordinate; destination: Coordinate; mode: string }>, noRoute: false, malformed: false, pause: false, release: () => {}, failSearch: false };
  await page.route('**/api/navigation/search', route => {
    expect(route.request().method()).toBe('POST'); state.searches.push(route.request().postDataJSON().query);
    return state.failSearch ? route.fulfill({ status: 503, json: { error: 'Place search unavailable. Try again.' } }) : route.fulfill({ json: { destinations: [destination] } });
  });
  await page.route('**/api/navigation/route', async route => {
    const input = route.request().postDataJSON(); state.routes.push(input);
    if (state.pause) await new Promise<void>(resolve => { state.release = resolve; });
    if (state.noRoute) return route.fulfill({ status: 404, json: { error: 'No road or path route connects these locations.' } });
    return route.fulfill({ json: { route: state.malformed ? {} : routeFor(input.origin, input.destination, input.mode) } });
  });
  await page.route('**/api/locations/current**', () => { throw new Error('GPS must not reverse-geocode the current user position.'); });
  await page.goto('/dashboard');
  if (open) await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'GPS navigation', exact: true }).click();
  const gps = page.getByRole('region', { name: 'GPS navigation', exact: true });
  if (open) await expect(gps).toBeVisible();
  return { gps, state };
}
const selectMuseum = async (page: Page) => {
  const gps = page.getByRole('region', { name: 'GPS navigation', exact: true });
  await gps.getByLabel('Where do you want to go?').fill('Museum Manila');
  await gps.getByRole('button', { name: 'Search destination', exact: true }).click();
  await gps.getByRole('list', { name: 'GPS destination results' }).getByRole('button').click();
};

test('GPS has a distinct sidebar icon, shows live position on opening, draws routes and advances guidance', async ({ page, context }) => {
  const { gps, state } = await setup(page, context);
  await expect(gps.getByRole('button', { name: 'Your current location', exact: true })).toBeVisible();
  await gps.getByLabel('Where do you want to go?').fill('Museum Manila');
  expect(state.searches).toHaveLength(0); expect(state.routes).toHaveLength(0);
  await gps.getByRole('button', { name: 'Search destination', exact: true }).click();
  await gps.getByRole('list', { name: 'GPS destination results' }).getByRole('button').click();
  await gps.getByRole('button', { name: 'Show route', exact: true }).click();
  await expect(gps.locator('.gps-route-line')).toHaveCount(1);
  await expect(gps.getByRole('list', { name: 'Turn-by-turn directions' })).toContainText('Turn right onto Park Street');
  expect(state.routes[0]).toEqual({ origin: { latitude: 14.55, longitude: 121.05 }, destination: { latitude: 14.551, longitude: 121.051 }, mode: 'walking' });
  await gps.getByRole('button', { name: 'Start guidance', exact: true }).click();
  await move(page, { latitude: 14.551, longitude: 121.0503 });
  await expect(gps.getByRole('list', { name: 'Turn-by-turn directions' }).locator('[aria-current="step"]')).toContainText('Turn right');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await gps.screenshot({ path: '../audit/2026-10-08/gps-navigation/gps-desktop.png' });
  for (const width of [320,390,768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await gps.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await gps.evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await gps.screenshot({ path: '../audit/2026-10-08/gps-navigation/gps-mobile.png' });
  await move(page, { latitude: 14.551, longitude: 121.051 });
  await expect(gps).toContainText('You have arrived');
  expect(state.routes).toHaveLength(1);
});

test('changing travel modes and entering another destination clears stale routes; pins are keyboard-selectable', async ({ page, context }) => {
  const { gps, state } = await setup(page, context);
  await selectMuseum(page); await gps.getByRole('button', { name: 'Show route', exact: true }).click();
  await expect(gps.locator('.gps-route-line')).toHaveCount(1);
  await gps.getByRole('button', { name: 'Driving', exact: true }).click();
  await expect(gps.locator('.gps-route-line')).toHaveCount(0);
  await gps.getByRole('button', { name: 'Show route', exact: true }).click();
  await expect.poll(() => state.routes.length).toBe(2); expect(state.routes[1].mode).toBe('driving');
  await gps.getByLabel('Where do you want to go?').fill('Another place');
  await expect(gps.getByRole('button', { name: 'Show route', exact: true })).toBeDisabled();
  await gps.getByRole('button', { name: 'Use map center', exact: true }).click();
  await expect(gps.getByLabel('Where do you want to go?')).toHaveValue(/Pinned destination/);
  await expect(gps.getByRole('button', { name: 'Destination: Dropped pin', exact: true })).toBeVisible();
});

test('GPS denial, failed searches and unreachable or malformed routes remain recoverable', async ({ page, context }) => {
  const { gps, state } = await setup(page, context, true);
  await expect(gps).toContainText('Location permission was denied');
  await selectMuseum(page); await expect(gps.getByRole('button', { name: 'Show route', exact: true })).toBeDisabled();
  await page.evaluate(() => { (window as unknown as { gpsFixture: GpsFixture }).gpsFixture.denied = false; });
  await gps.getByRole('button', { name: 'Enable my location', exact: true }).click();
  await move(page, { latitude: 14.55, longitude: 121.05 });
  state.noRoute = true;
  await gps.getByRole('button', { name: 'Show route', exact: true }).click();
  await expect(gps.getByRole('alert')).toContainText('No road or path route');
  await expect(gps.locator('.gps-route-line')).toHaveCount(0);
  state.noRoute = false; state.malformed = true;
  await gps.getByRole('button', { name: 'Show route', exact: true }).click();
  await expect(gps.getByRole('alert')).toContainText('incomplete or mismatched');
  state.malformed = false;
  await gps.getByRole('button', { name: 'Show route', exact: true }).click();
  await expect(gps.locator('.gps-route-line')).toHaveCount(1);
  state.failSearch = true; await gps.getByLabel('Where do you want to go?').fill('Other');
  await gps.getByRole('button', { name: 'Search destination', exact: true }).click();
  await expect(gps).toContainText('Place search unavailable');
});

test('GPS reroutes after moving off route without flooding, and canceled responses cannot restore a guide', async ({ page, context }) => {
  const { gps, state } = await setup(page, context);
  await selectMuseum(page); await gps.getByRole('button', { name: 'Show route', exact: true }).click();
  await gps.getByRole('button', { name: 'Start guidance', exact: true }).click();
  await move(page, { latitude: 14.5525, longitude: 121.0525 });
  await page.waitForTimeout(350); expect(state.routes).toHaveLength(1);
  await page.evaluate(() => { const actual = Date.now; Date.now = () => actual() + 16000; });
  await move(page, { latitude: 14.553, longitude: 121.053 });
  await expect.poll(() => state.routes.length).toBe(2);
  await move(page, { latitude: 14.5531, longitude: 121.0531 });
  await page.waitForTimeout(350); expect(state.routes).toHaveLength(2);
  await gps.getByRole('button', { name: 'Stop guidance', exact: true }).click();
  state.pause = true;
  await gps.getByRole('button', { name: 'Show route', exact: true }).click();
  await expect.poll(() => state.routes.length).toBe(3);
  await gps.getByLabel('Where do you want to go?').fill('A new destination');
  state.release();
  await expect(gps.getByRole('complementary', { name: 'Route guide' })).toHaveCount(0);
  await gps.getByRole('button', { name: 'Stop sharing location', exact: true }).click();
  await expect(gps.getByRole('button', { name: 'Your current location', exact: true })).toHaveCount(0);
});

test('saved-trip GPS opens with its recorded destination and leaving stops location tracking', async ({ page, context }) => {
  const { gps, state } = await setup(page, context, false, false);
  const nav = page.getByRole('navigation', { name: 'Traveler workspace' });
  await nav.getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'Open GPS navigation', exact: true }).click();
  await expect(gps.getByLabel('Where do you want to go?')).toHaveValue('Manila, Philippines');
  await expect(gps.getByRole('button', { name: 'Your current location', exact: true })).toBeVisible();
  expect(state.searches).toHaveLength(0);
  await nav.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(gps).toHaveCount(0);
  expect(await page.evaluate(() => { const gps = (window as unknown as { gpsFixture: GpsFixture }).gpsFixture; return gps.cleared.includes(gps.latest); })).toBe(true);
});
