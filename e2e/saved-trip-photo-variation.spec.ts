import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';
import pools from './fixtures/verified-destination-pools.json' with { type: 'json' };

const user = { id: 'variety-owner', name: 'Photo Tester', email: 'photo@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const makeTrip = (id: string, city: string) => ({ id, userId: user.id, destination: city + ', ' + (city === 'Manila' ? 'Philippines' : 'Japan'),
  destinationCity: city, destinationCountry: city === 'Manila' ? 'Philippines' : 'Japan', destinationCountryCode: city === 'Manila' ? 'PH' : 'JP',
  latitude: city === 'Manila' ? 14.6042 : 33.6, longitude: city === 'Manila' ? 120.9822 : 130.41667,
  budget: 12345, currency: city === 'Manila' ? 'PHP' : 'JPY', travelers: 2, partyType: 'couple', interests: [],
  startDate: '2040-10-08', endDate: '2040-10-09', status: 'active', createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z', itinerary: null, weather: null, completedAt: null });
async function setup(page: Page, context: BrowserContext, single = false) {
  await context.addCookies([{ name: 'travelmate_session', value: 'variety-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await mockPlanningLookups(page);
  const state = { trips: [makeTrip('manila-a', 'Manila'), makeTrip('manila-b', 'Manila'), makeTrip('manila-c', 'Manila'), makeTrip('fukuoka-a', 'Fukuoka'), makeTrip('fukuoka-b', 'Fukuoka')], searches: [] as string[], selections: [] as { tripId: string; photoId: string }[] };
  await page.route('**/api/destination-context/photo?*', route => {
    const city = new URL(route.request().url()).searchParams.get('city')!; state.searches.push(city);
    const photos = city === 'Manila' ? single ? [pools.Manila[0], ...pools.Fukuoka] : pools.Manila : pools.Fukuoka;
    return route.fulfill({ json: { photos } });
  });
  await page.route('**/api/destination-context/photo-selection', route => {
    state.selections.push(route.request().postDataJSON());
    return route.fulfill({ json: { tracked: true } });
  });
  await page.route('**/api/platform**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    return route.fulfill({ json: { user, trips: state.trips, tripsPage: { total: state.trips.length, hasMore: false, nextCursor: null }, directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  const open = async () => {
    await page.goto('/dashboard');
    await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  };
  await open();
  return { state, open };
}
const cards = (page: Page) => page.getByRole('region', { name: 'Saved plans' }).getByRole('article');
test('Manila and Fukuoka covers vary accurately and survive reload, reordering and new trips without repeated searches', async ({ page, context }) => {
  const { state, open } = await setup(page, context);
  await expect(cards(page)).toHaveCount(5);
  await expect.poll(() => state.selections.length).toBe(5);
  const ids = await cards(page).getByRole('img').evaluateAll(images => images.map(image => image.getAttribute('data-photo-id')));
  expect(new Set(ids.slice(0, 3)).size).toBe(3); expect(new Set(ids.slice(3)).size).toBe(2);
  expect(state.searches.sort()).toEqual(['Fukuoka', 'Manila']);
  for (const [index, id] of ids.entries()) {
    const image = cards(page).nth(index).getByRole('img');
    const photo = [...pools.Manila, ...pools.Fukuoka].find(item => item.id === id)!;
    await expect(image).toHaveAttribute('src', photo.src);
    await expect(image).toHaveAttribute('loading', 'lazy');
    await expect(cards(page).nth(index).getByRole('link', { name: photo.attribution.creator, exact: true })).toHaveAttribute('href', photo.attribution.photographerUrl);
    await expect(cards(page).nth(index).getByRole('link', { name: 'Unsplash', exact: true })).toHaveAttribute('href', photo.attribution.sourceUrl);
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await cards(page).first().scrollIntoViewIfNeeded();
    const image = cards(page).first().getByRole('img');
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const geometry = await image.evaluate(img => ({ fit: getComputedStyle(img).objectFit, height: img.parentElement!.getBoundingClientRect().height,
      radius: getComputedStyle(img.parentElement!).borderRadius, overflow: document.documentElement.scrollWidth > innerWidth }));
    expect(geometry).toEqual({ fit: 'cover', height: width < 480 ? 160 : 180, radius: '11px', overflow: false });
    await page.screenshot({ path: '../audit/2026-10-09/saved-trip-photo-variation/covers-' + width + '.png' });
  }
  await open();
  await expect(cards(page)).toHaveCount(5);
  await expect(cards(page).first().getByRole('img')).toHaveAttribute('data-photo-id', ids[0]!);
  expect(await cards(page).getByRole('img').evaluateAll(images => images.map(image => image.getAttribute('data-photo-id')))).toEqual(ids);
  expect(state.searches).toHaveLength(2); expect(state.selections).toHaveLength(5);
  state.trips.reverse(); await open();
  await expect(cards(page)).toHaveCount(5);
  await expect(cards(page).first().getByRole('img')).toHaveAttribute('data-photo-id', ids[4]!);
  expect(await cards(page).getByRole('img').evaluateAll(images => images.map(image => image.getAttribute('data-photo-id')))).toEqual([...ids].reverse());
  state.trips.push(makeTrip('manila-d', 'Manila')); await open();
  await expect(cards(page)).toHaveCount(6);
  await expect.poll(() => state.selections.length).toBe(6);
  expect(state.searches).toHaveLength(2);
  expect((await cards(page).getByRole('img').evaluateAll(images => images.map(image => image.getAttribute('data-photo-id')))).slice(0, 5)).toEqual([...ids].reverse());
});
test('one suitable Manila image is reused without taking Fukuoka images for variety', async ({ page, context }) => {
  await setup(page, context, true);
  for (let index = 0; index < 3; index++) await expect(cards(page).nth(index).getByRole('img')).toHaveAttribute('data-photo-id', pools.Manila[0].id);
});
test('failed Unsplash hotlinks show the existing neutral placeholder and leave card controls usable', async ({ page, context }) => {
  await page.route('https://images.unsplash.com/**', route => route.fulfill({ status: 404, body: '' }));
  await setup(page, context);
  for (const card of await cards(page).all()) {
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByText('Destination photo unavailable', { exact: true })).toBeVisible();
    await expect(card.getByText('Upcoming trip', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'View itinerary', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Mark as done', exact: true })).toBeVisible();
  }
  await cards(page).first().getByRole('button', { name: 'More options for Manila, Philippines' }).click();
  await expect(page.getByRole('menuitem', { name: 'Rate this trip', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
});
