import { expect, test } from '@playwright/test';
import { searchDestinationIndex } from '../../travelmate-backend-api/src/services/destination/destination-index.ts';

test('LiteAPI sandbox recommendations, photos, stale searches, and fees persist through generation and saving', async ({ page, context }) => {
  test.setTimeout(90000);
  await context.addCookies([{ name: 'travelmate_session', value: 'room-browser-fixture', domain: 'localhost', path: '/' }]);
  const user = { id: 'traveler', role: 'traveler', name: 'Traveler', email: 'guest@example.test', emailVerified: true, accountStatus: 'active' };
  const saves: Record<string, unknown>[] = [], searches: URL[] = [], checks: Record<string, unknown>[] = [];
  let saved: Record<string, unknown> | null = null, checkedQuote: Record<string, unknown> | null = null, changed = false;
  const workspace = () => ({ user, directory: [user], trips: saved ? [saved] : [], listings: [], bookings: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {}, integrations: {} });
  await page.route('**/api/platform**', route => {
    if (route.request().method() === 'POST') { const body = route.request().postDataJSON(); saves.push(body); saved = { ...body, id: 'saved', userId: user.id, status: 'active', createdAt: new Date().toISOString() }; return route.fulfill({ json: { result: saved } }); }
    return route.fulfill({ json: workspace() });
  });
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: searchDestinationIndex(new URL(route.request().url()).searchParams.get('q') || '') } }));
  await page.route('**/api/destination-context?**', route => route.fulfill({ json: { currency: 'JPY', currencySource: 'country-code', transportation: [], transportationMessage: '' } }));
  await page.route('**/api/destination-context/exchange-rate**', route => route.fulfill({ status: 503, json: { error: 'Fixture unavailable.' } }));
  await page.route('**/api/weather**', route => route.fulfill({ status: 503, json: { error: 'Fixture unavailable.' } }));
  await page.route('https://static.cupid.travel/**', route => {
    if (route.request().url().includes('broken')) return route.abort();
    // Test transport pixel, never a production hotel asset.
    return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB0kAAAAASUVORK5CYII=', 'base64') });
  });
  let delayNextSearch = false, delayedSearchCompleted = false;
  let selectedProperty: Record<string, unknown> = {};
  await page.route('**/api/accommodations?**', async route => {
    const url = new URL(route.request().url()); searches.push(url);
    if (delayNextSearch) { delayNextSearch = false; await new Promise(resolve => setTimeout(resolve, 2500)); delayedSearchCompleted = true; }
    const quote = { provider: 'liteapi', propertyId: 'lp123', roomId: 'family', offerId: 'rate', roomType: 'Family room', checkInDate: url.searchParams.get('checkInDate'), checkOutDate: url.searchParams.get('checkOutDate'), occupancy: JSON.parse(url.searchParams.get('occupancy')!), currency: 'JPY', total: 12345, nightlyAverage: Math.round(12345 / ((Date.parse(url.searchParams.get('checkOutDate')!)-Date.parse(url.searchParams.get('checkInDate')!))/86400000)), taxesAndFeesIncluded: false, budgetTotal: 12645, guestNationality: 'PH', payableAtProperty: [{ currency: 'JPY', amount: 300 }], priceBreakdown: [{ label: 'tax and service fee', amount: 1000, currency: 'JPY' }], checkedAt: new Date().toISOString(), isLive: false, photoReferences: ['lp123:exterior','lp123:room'] };
    selectedProperty = { id: 'liteapi:lp123', propertyId: 'lp123', environment: 'sandbox', name: url.searchParams.get('destination')?.includes('Singapore') ? 'Official Singapore Hotel fixture' : 'Official Yokohama Hotel fixture', nameSource: 'provider-english', address: '1 Central Street, Yokohama, Japan', type: 'Hotel', latitude: 35.4, longitude: 139.6, distanceKm: 0.5, amenities: ['WiFi'], availability: 'available', quote, quoteToken: 'selected-fixture-token', photos: ['exterior','broken'].map((name,i) => ({ reference: quote.photoReferences[i], url: 'https://static.cupid.travel/' + name + '.png', caption: name, attribution: { creator: 'Authorized fixture photo credit', license: 'Provider-authorized photo', sourceUrl: 'https://static.cupid.travel/' + name + '.png' } })) };
    return route.fulfill({ json: { accommodations: [], nearbyAccommodations: [], providerEnvironment: 'sandbox', providerStatus: 'ready', status: 'ready', message: '', providerAccommodations: [selectedProperty, { ...selectedProperty, id: 'liteapi:lp456', propertyId: 'lp456', name: 'Sold-out hotel fixture', quote: undefined, quoteToken: undefined, availability: 'sold-out', photos: [] }] } });
  });
  await page.route('**/api/accommodations/revalidate', route => {
    const body = route.request().postDataJSON(); checks.push(body);
    if (changed) return route.fulfill({ status: 409, json: { error: 'The room price changed. Refresh accommodations and review the new quote.', status: 'changed' } });
    checkedQuote = { ...(selectedProperty.quote as object), revalidatedAt: new Date().toISOString() };
    return route.fulfill({ json: { accommodation: { ...selectedProperty, quote: checkedQuote, quoteToken: 'revalidated-fixture-token' } } });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill('Yokohama');
  await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await page.getByLabel('Start date', { exact: true }).fill('2040-01-01');
  await page.getByLabel(/^End date/).fill('2040-01-03');
  await page.getByLabel(/^Traveling as/).selectOption('family');
  await page.getByLabel(/^Travelers/).fill('3');
  await page.getByText(/^Rooms and guests ·/).click();
  await page.getByLabel('Guests nationality').fill('PH');
  await page.getByLabel('Number of accommodation rooms').selectOption('1');
  await page.getByLabel('Room 1 adults', { exact: true }).fill('2');
  await page.getByLabel('Room 1 children ages', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Update room guests' }).click();
  await expect.poll(() => JSON.parse(searches.at(-1)?.searchParams.get('occupancy') || '[]')).toEqual([{ adults: 2, childAges: [5] }]);
  expect(searches.at(-1)?.searchParams.get('guestNationality')).toBe('PH');
  const browse = page.getByRole('button', { name: 'Browse accommodations', exact: true });
  await browse.click();
  const modal = page.getByRole('dialog', { name: 'Browse accommodations' });
  await expect(modal.getByText('Official Yokohama Hotel fixture', { exact: true })).toBeVisible();
  await expect(modal.getByText('Sandbox test data · Not production prices or availability')).toBeVisible();
  await expect(modal.getByText('Selecting this hotel adds it to your itinerary. It does not reserve a room.')).toBeVisible();
  await expect(modal.getByText('Additional charges payable at the property are excluded from the quoted total.', { exact: true })).toBeVisible();
  await expect(modal.getByText(/Payable at property: JPY 300/)).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Select accommodation: Sold-out hotel fixture' })).toBeEnabled();
  await modal.getByRole('button', { name: 'View photo 2 of Official Yokohama Hotel fixture' }).click();
  await expect(modal.getByText('Photo unavailable', { exact: true })).toHaveCount(2);
  await modal.getByRole('button', { name: 'View photo 1 of Official Yokohama Hotel fixture' }).click();
  await expect(modal.getByRole('link', { name: 'Authorized fixture photo credit', exact: true })).toBeVisible();
  await page.screenshot({ path: '../audit/2026-10-08/accommodation-quotes-desktop.png', fullPage: true });
  const desktopViewport = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(modal).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '../audit/2026-10-08/accommodation-quotes-mobile.png', fullPage: true });
  await page.setViewportSize(desktopViewport || { width: 1440, height: 900 });
  changed = true;
  await modal.getByRole('button', { name: 'Select accommodation: Official Yokohama Hotel fixture' }).click();
  await expect(modal.getByRole('alert')).toContainText('price changed');
  await expect(modal).toBeVisible();
  changed = false;
  await modal.getByRole('button', { name: 'Select accommodation: Official Yokohama Hotel fixture' }).click();
  await page.getByRole('region', { name: 'Accommodation preference' }).getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.getByText(/Room quote rechecked/)).toBeVisible();
  await page.getByLabel(/^End date/).fill('2040-01-04');
  await expect(page.getByRole('button', { name: 'Choose accommodation later' })).toHaveAttribute('aria-pressed','true');
  await expect.poll(() => searches.at(-1)?.searchParams.get('checkOutDate')).toBe('2040-01-04');
  await browse.click();
  await modal.getByRole('button', { name: 'Select accommodation: Official Yokohama Hotel fixture' }).click();
  expect(checks.at(-1)).toMatchObject({ checkOutDate: '2040-01-04', occupancy: [{ adults: 2, childAges: [5] }] });
  await page.getByLabel(/^Total family budget/).fill('100000');
  let generated: Record<string, unknown> | null = null;
  await page.route('**/api/itinerary', route => {
    const body = route.request().postDataJSON(); generated = body;
    return route.fulfill({ json: { destination: body.destination, totalBudget: body.budget, currency: body.currency, source: 'mock',
      accommodation: { listingId: 'liteapi:lp123', offerId: 'rate', name: selectedProperty.name, address: selectedProperty.address, nightlyRate: 4115, nights: 3, rooms: 1, total: 12645, quotedTotal: 12645, currency: 'JPY', source: 'liteapi', providerQuote: checkedQuote },
      days: Array.from({ length: 4 }, (_,i) => ({ day: i+1, date: '2040-01-0' + (i+1), theme: 'Explore', imageUrl: '', totalCost: 0, activities: [] })),
      budgetSummary: { accommodation: 12645, food: 0, activities: 0, transport: 0, reserve: 0, dailyAverage: 0, total: 100000, accommodationActual: 12645, plannedSpend: 12645 },
    } });
  });
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect.poll(() => saves.length).toBe(1);
  expect(generated).toMatchObject({ selectedAccommodationQuote: 'revalidated-fixture-token', rooms: 1 });
  const savedStay = (saves[0].itinerary as { accommodation: Record<string, unknown> }).accommodation;
  expect(savedStay).toMatchObject({ listingId: 'liteapi:lp123', offerId: 'rate', total: 12645, providerQuote: checkedQuote });
  expect((savedStay.providerQuote as Record<string, unknown>).photoReferences).toEqual(['lp123:exterior','lp123:room']);
  // Delay a search for the old destination, then select a new destination.
  await page.getByRole('button', {name: 'Plan a trip', exact: true}).click();
  await page.getByRole('combobox', {name:'Destination',exact:true}).fill('Yokohama');
  await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await expect(page.getByRole('button', {name:'Refresh stays',exact:true})).toBeEnabled();
  delayNextSearch = true;
  const before = searches.length;
  await page.getByRole('button', {name: 'Refresh stays', exact: true}).click();
  await expect.poll(() => searches.length).toBeGreaterThan(before);
  await page.getByRole('combobox', {name: 'Destination', exact:true}).fill('Singapore');
  await page.locator('#destination-suggestions').getByRole('option').filter({hasText:'City'}).first().getByRole('button').click();
  await expect(page.getByRole('button', {name:'Choose accommodation later'})).toHaveAttribute('aria-pressed','true');
  await expect.poll(() => searches.at(-1)?.searchParams.get('destination')).toContain('Singapore');
  await browse.click();
  await expect(modal.getByText('Official Singapore Hotel fixture',{exact:true})).toBeVisible();
  // Wait for the deliberately delayed, obsolete route before checking isolation.
  await expect.poll(() => delayedSearchCompleted,{timeout:5000}).toBe(true);
  await expect(modal.getByText('Official Yokohama Hotel fixture',{exact:true})).toHaveCount(0);
  await page.screenshot({path:'../audit/2026-10-08/liteapi-accommodations.png',fullPage:true});
});
