import { expect, test } from '@playwright/test';
import { searchDestinationIndex } from '../../travelmate-backend-api/src/services/destination/destination-index.ts';

test('pagination, price and star filters, and unquoted selection persist through generation and saving', async ({ page, context }) => {
  test.setTimeout(90000);
  await context.addCookies([{ name: 'travelmate_session', value: 'browsing-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const user = { id: 'traveler', name: 'Stay Traveler', email: 'stay@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
  let saved: Record<string, unknown> | null = null;
  let generated: Record<string, unknown> | null = null;
  let checks = 0;
  let omitSelectedHotel = false;
  let releaseRefresh: (() => void) | undefined;
  let refreshGate: Promise<void> | undefined;
  const workspace = () => ({ user, directory: [user], trips: saved ? [saved] : [], listings: [], bookings: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {}, integrations: {} });
  await page.route('**/api/platform**', route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      saved = { ...body, id: 'saved-preference', userId: user.id, status: 'active', createdAt: new Date().toISOString() };
      return route.fulfill({ json: { result: saved } });
    }
    return route.fulfill({ json: workspace() });
  });
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: searchDestinationIndex(new URL(route.request().url()).searchParams.get('q') || '') } }));
  await page.route('**/api/destination-context?**', route => route.fulfill({ json: { currency: 'JPY', currencySource: 'country-code', transportation: [], transportationMessage: '' } }));
  await page.route('**/api/destination-context/exchange-rate**', route => route.fulfill({ status: 503, json: { error: 'Fixture unavailable.' } }));
  await page.route('**/api/weather**', route => route.fulfill({ status: 503, json: { error: 'Fixture unavailable.' } }));
  await page.route('**/api/itinerary/images', route => route.fulfill({ json: { day: (saved?.itinerary as { days: unknown[] }).days[0] } }));
  await page.route('**/api/accommodations/revalidate', route => { checks += 1; return route.fulfill({ status: 409, json: { error: 'Unexpected quote check.' } }); });
  await page.route('https://static.cupid.travel/selected-panel-fixture/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#355d54"/><rect x="175" y="55" width="290" height="305" fill="#d7ba7c"/><path d="M215 110h45v45h-45zm100 0h45v45h-45zm100 0h20v45h-20zM215 200h45v45h-45zm100 0h45v45h-45zm100 0h20v45h-20z" fill="#25493f"/><text x="320" y="320" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#25493f">Hotel photo fixture</text></svg>' }));
  await page.route('**/api/accommodations?**', async route => {
    if (refreshGate) await refreshGate;
    const url = new URL(route.request().url());
    const properties = Array.from({ length: 14 }, (_, i) => {
      const number = i + 1;
      const priced = number <= 10;
      return { id: 'liteapi:lp' + number, propertyId: 'lp' + number, name: 'Tokyo Hotel ' + String(number).padStart(2, '0'), nameSource: 'provider-english', address: 'Tokyo, Japan', type: 'Hotel', latitude: 35.68, longitude: 139.76, distanceKm: 1, rating: number === 14 ? undefined : number % 5 + 1, amenities: number === 11 ? ['FREE_WIFI', 'AIR_CONDITIONING'] : [], photos: number === 11 ? ['exterior', 'room'].map(name => ({ reference: 'lp11:' + name, url: 'https://static.cupid.travel/selected-panel-fixture/' + name + '.png', caption: name, attribution: { creator: 'Selected hotel photo fixture', license: 'Provider content terms', sourceUrl: 'https://static.cupid.travel/selected-panel-fixture/' + name + '.png' } })) : [], environment: 'sandbox', availability: priced ? 'available' : number === 12 ? 'sold-out' : number === 13 ? 'provider-error' : 'unavailable',
        ...(priced ? { quoteToken: 'fixture-token', quote: { provider: 'liteapi', propertyId: 'lp' + number, roomId: 'room', offerId: 'rate', roomType: 'Double room', checkInDate: url.searchParams.get('checkInDate'), checkOutDate: url.searchParams.get('checkOutDate'), occupancy: JSON.parse(url.searchParams.get('occupancy')!), currency: number === 10 ? 'USD' : 'JPY', nightlyAverage: number * 1000, total: number * 2000, payableAtProperty: [], priceBreakdown: [], checkedAt: new Date().toISOString(), photoReferences: [], isLive: false } } : {}),
      };
    });
    return route.fulfill({ json: { configured: true, accommodations: [], nearbyAccommodations: [], providerAccommodations: properties.filter(stay => !omitSelectedHotel || stay.propertyId !== 'lp11'), status: 'ready', providerStatus: 'ready', providerEnvironment: 'sandbox' } });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill('Tokyo');
  await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await page.getByLabel('Start date', { exact: true }).fill('2040-01-01');
  await page.getByLabel(/^End date/).fill('2040-01-03');
  const browse = page.getByRole('button', { name: 'Browse accommodations', exact: true });
  await browse.click();
  const modal = page.getByRole('dialog', { name: 'Browse accommodations' });
  const choices = modal.getByRole('button', { name: /^Select accommodation:/ });
  await expect(choices).toHaveCount(6);
  await expect(modal.getByText('Showing 1–6 of 14 accommodations')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Previous accommodation page' })).toBeDisabled();
  await modal.getByRole('button', { name: 'Next accommodation page' }).click();
  await expect(modal.getByText('Showing 7–12 of 14 accommodations')).toBeVisible();
  await modal.getByRole('button', { name: 'Next accommodation page' }).click();
  await expect(choices).toHaveCount(2);
  await expect(modal.getByRole('button', { name: 'Next accommodation page' })).toBeDisabled();
  await modal.getByLabel('Search accommodations by name').fill('Hotel 12');
  await expect(choices).toHaveCount(1);
  await expect(modal.getByText('Page 1 of 1')).toBeVisible();
  await expect(choices).toBeEnabled();
  await modal.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await modal.getByLabel('Minimum nightly price (JPY)').fill('3000');
  await modal.getByLabel('Maximum nightly price (JPY)').fill('8000');
  await expect(choices).toHaveCount(6);
  await modal.getByLabel('Minimum hotel star rating').selectOption('4');
  await expect(choices).toHaveCount(3);
  await expect(modal.getByRole('heading', { level: 3 })).toHaveText(['Tokyo Hotel 03', 'Tokyo Hotel 04', 'Tokyo Hotel 08']);
  await modal.getByLabel('Sort accommodations').selectOption('price-desc');
  await expect(modal.getByRole('heading', { level: 3 })).toHaveText(['Tokyo Hotel 08', 'Tokyo Hotel 04', 'Tokyo Hotel 03']);
  await modal.getByLabel('Sort accommodations').selectOption('rating');
  await expect(modal.getByRole('heading', { level: 3 })).toHaveText(['Tokyo Hotel 04', 'Tokyo Hotel 03', 'Tokyo Hotel 08']);
  await modal.getByLabel('Maximum nightly price (JPY)').fill('2000');
  await expect(modal.getByRole('alert')).toContainText('maximum at least as high');
  await expect(modal.getByText('No matching accommodations', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Reset accommodation filters' }).click();
  await modal.getByLabel('Maximum nightly price (JPY)').fill('100000');
  await expect(modal.getByText('Showing 1–6 of 9 accommodations')).toBeVisible();
  await modal.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await modal.getByLabel('Minimum hotel star rating').selectOption('1');
  await expect(modal.getByText('Showing 1–6 of 13 accommodations')).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(modal.getByRole('button', { name: 'Next accommodation page' })).toBeVisible();
  }
  await modal.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.screenshot({ path: '../audit/2026-10-08/accommodation-feature/desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../audit/2026-10-08/accommodation-feature/mobile.png' });
  await modal.getByLabel('Search accommodations by name').fill('Hotel 11');
  await choices.focus();
  await page.keyboard.press('Enter');
  await expect(modal).toHaveCount(0);
  await expect(browse).toBeFocused();
  await expect(page.getByText('Tokyo Hotel 11', { exact: true })).toBeVisible();
  await expect(page.getByText('Planning preference · Price and availability unconfirmed. No room reserved.', { exact: true })).toBeVisible();
  const preference = page.getByRole('region', { name: 'Accommodation preference' });
  const hotelPhoto = preference.getByRole('img', { name: 'Tokyo Hotel 11 accommodation', exact: true });
  await expect(hotelPhoto).toBeVisible();
  await expect(preference.getByText('Tokyo, Japan', { exact: true }).first()).toBeVisible();
  await expect(preference.getByText('2/5 hotel stars', { exact: true })).toBeVisible();
  const details = preference.getByRole('button', { name: 'Details', exact: true });
  await expect(details).toHaveAttribute('aria-expanded', 'false');
  await expect(preference.getByRole('list', { name: 'Selected hotel amenities' })).toHaveCount(0);
  await details.focus();
  await page.keyboard.press('Enter');
  await expect(details).toHaveAttribute('aria-expanded', 'true');
  await expect(preference.getByRole('list', { name: 'Selected hotel amenities' })).toHaveText('free wifiair conditioning');
  await expect(preference.getByText(/Your budget uses a lodging allowance/)).toBeVisible();
  await details.click();
  await expect(preference.getByRole('link', { name: 'Selected hotel photo fixture', exact: true })).toBeVisible();
  await expect(preference.getByRole('button', { name: /^View photo/ })).toHaveCount(0);
  await expect(hotelPhoto).toHaveAttribute('src', /exterior\.png$/);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await preference.scrollIntoViewIfNeeded();
    expect(await preference.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await preference.evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(400);
  }
  await page.setViewportSize({ width: 1440, height: 1200 });
  await preference.evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -130));
  await preference.screenshot({ path: '../audit/2026-10-08/compact-hotel-card/desktop.png' });
  await page.setViewportSize({ width: 390, height: 1200 });
  await preference.evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -130));
  await preference.screenshot({ path: '../audit/2026-10-08/compact-hotel-card/mobile.png' });
  // Keep the selected hotel visible during loading, and when refreshed results omit it.
  omitSelectedHotel = true;
  refreshGate = new Promise(resolve => { releaseRefresh = resolve; });
  await page.getByRole('button', { name: 'Refresh stays', exact: true }).click();
  await expect(preference.getByText('Loading relevant accommodation…', { exact: true })).toBeVisible();
  await expect(hotelPhoto).toBeVisible();
  await expect(preference.getByText('Tokyo Hotel 11', { exact: true })).toBeVisible();
  releaseRefresh!();
  refreshGate = undefined;
  await expect(page.getByRole('button', { name: 'Refresh stays', exact: true })).toBeEnabled();
  await expect(hotelPhoto).toBeVisible();
  await expect(preference.getByText('Tokyo Hotel 11', { exact: true })).toBeVisible();
  await details.click();
  await expect(preference.getByRole('list', { name: 'Selected hotel amenities' })).toContainText('free wifi');
  await details.click();
  await browse.click();
  await expect(modal.getByRole('button', { name: 'Select accommodation: Tokyo Hotel 11', exact: true })).toHaveCount(0);
  await expect(modal.getByText('Showing 1–6 of 13 accommodations')).toBeVisible();
  await modal.getByRole('button', { name: 'Close accommodations' }).click();
  omitSelectedHotel = false;
  await page.getByRole('button', { name: 'Refresh stays', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh stays', exact: true })).toBeEnabled();
  expect(checks).toBe(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await browse.click();
  await expect(choices.first()).toHaveAttribute('aria-label', 'Select accommodation: Tokyo Hotel 11');
  await expect(choices.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(choices).toHaveCount(6);
  await modal.getByRole('button', { name: 'Next accommodation page' }).click();
  await expect(modal.getByRole('button', { name: 'Select accommodation: Tokyo Hotel 11', exact: true })).toHaveCount(0);
  await modal.getByRole('button', { name: 'Previous accommodation page' }).click();
  await expect(choices.first()).toHaveAttribute('aria-pressed', 'true');
  for (const order of ['price-asc', 'price-desc', 'rating']) {
    await modal.getByLabel('Sort accommodations').selectOption(order);
    await expect(choices.first()).toHaveAttribute('aria-label', 'Select accommodation: Tokyo Hotel 11');
  }
  // Filters still apply to the selected stay, and clearing them restores it first.
  await modal.getByLabel('Maximum nightly price (JPY)').fill('100000');
  await expect(modal.getByRole('button', { name: 'Select accommodation: Tokyo Hotel 11', exact: true })).toHaveCount(0);
  await modal.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(choices.first()).toHaveAttribute('aria-pressed', 'true');
  await modal.getByLabel('Search accommodations by name').fill('Hotel 11');
  await expect(choices).toHaveAttribute('aria-pressed', 'true');
  await modal.getByRole('button', { name: 'Close accommodations' }).click();
  await page.getByRole('button', { name: 'Choose accommodation later' }).click();
  await expect(preference.getByRole('img')).toHaveCount(0);
  await expect(preference.getByText('Find a stay for your trip', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enter accommodation manually' }).click();
  await expect(preference.getByRole('img')).toHaveCount(0);
  await expect(page.getByLabel('Accommodation name', { exact: true })).toBeVisible();
  await browse.click();
  await modal.getByLabel('Search accommodations by name').fill('Hotel 14');
  await modal.getByRole('button', { name: 'Select accommodation: Tokyo Hotel 14', exact: true }).click();
  await expect(preference.getByText('Tokyo Hotel 14', { exact: true })).toBeVisible();
  await expect(preference.getByRole('img')).toHaveCount(0);
  await expect(preference.getByText('Photo unavailable', { exact: true })).toBeVisible();
  await expect(preference.getByRole('list', { name: 'Selected hotel amenities' })).toHaveCount(0);
  await browse.click();
  await modal.getByLabel('Search accommodations by name').fill('Hotel 11');
  await modal.getByRole('button', { name: 'Select accommodation: Tokyo Hotel 11', exact: true }).click();
  await expect(hotelPhoto).toBeVisible();
  await page.getByLabel(/^Solo trip budget/).fill('100000');
  await page.route('**/api/itinerary', route => {
    const body = route.request().postDataJSON(); generated = body;
    return route.fulfill({ json: { destination: body.destination, totalBudget: body.budget, currency: body.currency, source: 'mock', plannedAccommodation: body.plannedAccommodation,
      days: [1, 2, 3].map(day => ({ day, date: '2040-01-0' + day, theme: 'Explore Tokyo', imageUrl: '', totalCost: 0, activities: [] })),
      budgetSummary: { accommodation: 0, food: 0, activities: 0, transport: 0, reserve: 0, dailyAverage: 0, total: 100000, accommodationActual: 0, plannedSpend: 0 },
    } });
  });
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect.poll(() => saved).not.toBeNull();
  expect(generated).toMatchObject({ plannedAccommodation: { name: 'Tokyo Hotel 11', address: 'Tokyo, Japan', type: 'Hotel', source: 'provider', sourceId: 'liteapi:lp11' } });
  expect(generated!.selectedAccommodationQuote).toBeUndefined();
  expect(generated!.externalAccommodation).toBeUndefined();
  expect((saved!.itinerary as Record<string, unknown>).plannedAccommodation).toEqual(generated!.plannedAccommodation);
  expect(generated!.preview).toBeUndefined();
  expect(JSON.stringify(saved)).not.toContain('selected-panel-fixture');
  await page.reload();
  await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByText('Tokyo Hotel 11', { exact: true }).first()).toBeVisible();
});
