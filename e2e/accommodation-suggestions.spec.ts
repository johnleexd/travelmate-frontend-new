import { expect, test } from '@playwright/test';
import { searchDestinationIndex } from '../../travelmate-backend-api/src/services/destination/destination-index.ts';

test('destination browsing, keyboard card selection, generation and automatic saving preserve the exact stay', async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const user = { id: 'traveler', name: 'Stay Test Traveler', email: 'stays@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
  let saved: Record<string, unknown> | null = null;
  const workspace = () => ({ user, directory: [user], trips: saved ? [saved] : [], listings: [], bookings: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {}, integrations: {} });
  const saves: Record<string, unknown>[] = [];
  await page.route('**/api/platform**', route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      saves.push(body);
      saved = { ...body, id: 'saved-stay-trip', userId: user.id, status: 'active', createdAt: new Date().toISOString() };
      return route.fulfill({ json: { result: saved } });
    }
    return route.fulfill({ json: workspace() });
  });
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: searchDestinationIndex(new URL(route.request().url()).searchParams.get('q') || '') } }));
  await page.route('**/api/destination-context?**', route => route.fulfill({ json: { currency: 'EUR', currencySource: 'country-code', transportation: [], transportationMessage: '' } }));
  await page.route('**/api/destination-context/exchange-rate**', route => route.fulfill({ status: 503, json: { error: 'Rates isolated.' } }));
  await page.route('**/api/weather**', route => route.fulfill({ status: 503, json: { error: 'Weather isolated.' } }));
  await page.route('**/api/itinerary/images', route => route.fulfill({ json: { day: (saved?.itinerary as { days: unknown[] }).days[0] } }));
  // Broken, attributed property media must degrade to the placeholder.
  let mediaWorks = false;
  await page.route('https://upload.wikimedia.org/**', route => mediaWorks ? route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB0kAAAAASUVORK5CYII=', 'base64') }) : route.abort());
  const searches: URL[] = [];
  let fail = false, empty = false, delay = 0;
  await page.route('**/api/accommodations?**', async route => {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    const url = new URL(route.request().url()); searches.push(url);
    if (fail) return route.fulfill({ status: 502, json: { error: 'Technical provider diagnostic should not appear in a card.' } });
    const destination = url.searchParams.get('destination')!;
    const currency = url.searchParams.get('currency')!;
    return route.fulfill({ json: {
      configured: true, status: empty ? 'no-results' : 'ready', message: 'Raw technical provider text hidden from card content.',
      nearbyAccommodations: empty ? [] : ['Hotel', 'Hostel', 'Resort', 'Guesthouse'].map((type, i) => ({
        id: 'osm:node:' + (i + 1), name: destination.split(',')[0] + ' ' + type + ' fixture', type,
        address: i === 0 ? 'Address not supplied; location 48.86000, 2.35000' : 'Central area, ' + destination,
        latitude: Number(url.searchParams.get('latitude')), longitude: Number(url.searchParams.get('longitude')), distanceKm: 1,
        source: 'openstreetmap', sourceUrl: 'https://www.openstreetmap.org/node/' + (i + 1),
        ...(i === 0 ? { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/fixture-property.jpg', imageAttribution: { creator: 'Fixture Photographer', license: 'CC BY-SA 4.0', sourceUrl: 'https://commons.wikimedia.org/?curid=123', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' } } : {}),
      })),
      accommodations: empty ? [] : [{ id: 'offer', hotelId: 'h', offerId: 'o', name: destination.split(',')[0] + ' quoted hotel fixture', type: 'Hotel', typeSource: 'name-inferred', address: destination, distanceKm: 0.8, rating: 4, amenities: ['WIFI'], checkInDate: url.searchParams.get('checkInDate'), checkOutDate: url.searchParams.get('checkOutDate'), nightlyRate: 100, total: 600, currency, roomDescription: 'Provider room', cancellationPolicy: 'Provider terms', available: true, isLive: true, source: 'amadeus', selectionToken: 'test-only-token', fetchedAt: new Date().toISOString() }],
    } });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  const destination = page.getByRole('combobox', { name: 'Destination', exact: true });
  const browse = page.getByRole('button', { name: 'Browse accommodations', exact: true });
  const modal = page.getByRole('dialog', { name: 'Browse accommodations' });
  for (const city of ['Kyoto', 'Paris', 'Barcelona, Spain']) {
    await destination.fill(city);
    await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
    await browse.click();
    await expect(modal.getByRole('list', { name: 'Accommodation choices' }).getByRole('listitem').filter({ has: page.getByRole('button', { name: /^Select accommodation:/ }) })).toHaveCount(5);
    await expect(modal.getByText('Photo unavailable', { exact: true })).toHaveCount(5);
    await expect(modal.getByText('Price unavailable', { exact: true })).toHaveCount(4);
    await expect(modal).not.toContainText('48.86000');
    await expect(modal).not.toContainText('Raw technical');
    const cardButton = modal.getByRole('button', { name: 'Select accommodation: ' + city.split(',')[0] + ' Hotel fixture', exact: true });
    await cardButton.focus(); await page.keyboard.press('Enter');
    await expect(modal).toHaveCount(0);
    await expect(page.getByText(/Planning preference · Price and availability unconfirmed/)).toBeVisible();
    await browse.click();
    await expect(modal.getByRole('button', { name: 'Select accommodation: ' + city.split(',')[0] + ' Hotel fixture', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await modal.getByRole('button', { name: 'Close accommodations' }).click();
  }
  // A date/group change invalidates quotes and old selections.
  await page.getByLabel('Start date', { exact: true }).fill('2040-01-01');
  await page.getByLabel(/^End date/).fill('2040-01-05');
  await expect(page.getByRole('button', { name: 'Choose accommodation later' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel(/^Traveling as/).selectOption('friends');
  await page.getByLabel(/^Travelers/).fill('3');
  await expect.poll(() => searches.at(-1)?.searchParams.get('adults')).toBe('3');
  await browse.click();
  await modal.getByLabel('Search accommodations by name').fill('Resort');
  await expect(modal.getByRole('button', { name: /^Select accommodation:/ })).toHaveCount(1);
  await modal.getByLabel('Search accommodations by name').fill('No matching property');
  await expect(modal.getByText('No matching accommodations', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Close accommodations' }).click();
  await expect(browse).toBeFocused();
  const beforeCountry = searches.length;
  await destination.fill('Japan');
  await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await expect(browse).toBeDisabled();
  await expect(page.getByText('Choose a city or town to browse relevant stays.', { exact: true })).toBeVisible();
  expect(searches.length).toBe(beforeCountry);
  fail = true;
  await destination.fill('Paris');
  await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await expect(page.getByText(/Could not load stays/)).toBeVisible();
  await page.getByRole('button', { name: 'Enter accommodation manually', exact: true }).click();
  await page.getByLabel('Accommodation name', { exact: true }).fill('My chosen guesthouse');
  await page.getByLabel('Accommodation location', { exact: true }).fill('Paris city centre');
  fail = false; empty = true;
  await page.getByRole('button', { name: 'Refresh stays', exact: true }).click();
  await expect(page.getByText(/No stays found/)).toBeVisible();
  await expect(page.getByLabel('Accommodation name', { exact: true })).toHaveValue('My chosen guesthouse');
  await page.getByRole('button', { name: 'Choose accommodation later', exact: true }).click();
  await expect(page.getByLabel('Accommodation name', { exact: true })).toHaveCount(0);
  empty = false; delay = 1000;
  await page.getByRole('button', { name: 'Refresh stays', exact: true }).click();
  await browse.click();
  await expect(modal.getByText('Loading relevant accommodation…', { exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: /^Select accommodation:/ })).toHaveCount(5);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '../audit/2026-10-08/accommodation-browser-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../audit/2026-10-08/accommodation-browser-mobile.png', fullPage: true });
  // A transport-only pixel fixture checks rendering/attribution; it is never a product hotel asset.
  await modal.getByRole('button', { name: 'Close accommodations' }).click();
  mediaWorks = true;
  await browse.click();
  await expect(modal.getByRole('img', { name: 'Paris Hotel fixture accommodation' })).toBeVisible();
  await expect(modal.getByRole('link', { name: 'Fixture Photographer' })).toHaveAttribute('href', 'https://commons.wikimedia.org/?curid=123');
  await expect(modal.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0/');
  await modal.getByRole('button', { name: 'Select accommodation: Paris Hotel fixture', exact: true }).click();
  await page.getByLabel(/^Total barkada budget/).fill('5000');
  let generated: Record<string, unknown> | null = null;
  await page.route('**/api/itinerary', route => {
    const body = route.request().postDataJSON(); generated = body;
    return route.fulfill({ json: {
      destination: body.destination, totalBudget: body.budget, currency: body.currency, source: 'mock', plannedAccommodation: body.plannedAccommodation,
      days: Array.from({ length: 5 }, (_, i) => ({ day: i + 1, date: '2040-01-0' + (i + 1), theme: 'Explore Paris', imageUrl: '', totalCost: 30, activities: [{ time: '09:00', title: 'Walk', description: 'Explore the city', estimatedCost: 30, category: 'activity', icon: 'map' }] })),
      budgetSummary: { accommodation: 1700, food: 1100, activities: 1000, transport: 700, reserve: 500, dailyAverage: 1000, total: 5000, accommodationActual: 0, plannedSpend: 150 },
    } });
  });
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect.poll(() => generated).not.toBeNull();
  expect(generated!.plannedAccommodation).toMatchObject({ name: 'Paris Hotel fixture', source: 'openstreetmap', sourceId: 'osm:node:1', type: 'Hotel' });
  expect(generated!.externalAccommodation).toBeUndefined();
  await expect.poll(() => saves.length).toBe(1);
  expect((saves[0].itinerary as Record<string, unknown>).plannedAccommodation).toEqual(generated!.plannedAccommodation);
  await expect(page.getByText(/It was saved automatically/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByText('Paris Hotel fixture', { exact: true }).first()).toBeVisible();
});
