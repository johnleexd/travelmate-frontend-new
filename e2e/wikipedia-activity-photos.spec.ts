import { expect, test } from '@playwright/test';
import path from 'node:path';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test('licensed Wikipedia thumbnails, illustrative Unsplash fallback and placeholders persist with attribution and responsive layout', async ({ page, context }) => {
  await mockPlanningLookups(page);
  await context.addCookies([{ name: 'travelmate_session', value: 'wikipedia-photo-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const wiki = { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Exact_Temple.jpg/960px-Exact_Temple.jpg', imageAttribution: { creator: 'Wikipedia fixture author', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', sourceUrl: 'https://commons.wikimedia.org/?curid=42' } };
  const fallback = { imageUrl: 'https://images.unsplash.com/photo-illustrative?ixid=preserved&w=1080', imageAttribution: { provider: 'unsplash', photoId: 'illustrative', creator: 'Unsplash fixture author', license: 'Unsplash', licenseUrl: 'https://unsplash.com/license', sourceUrl: 'https://unsplash.com/photos/illustrative?utm_source=travelmate&utm_medium=referral', photographerUrl: 'https://unsplash.com/@fixture?utm_source=travelmate&utm_medium=referral', match: 'activity', illustrative: true, downloadTracked: true } };
  const activity = (index: number, name: string) => ({ id: `activity-${index}`, title: name, time: `${9 + index}:00`, durationMinutes: 30, estimatedCost: 100, category: 'activity', icon: 'map', description: 'Recorded activity description.', place: { provider: 'wikidata', placeId: `Q${index + 1}`, name, city: 'Manila', country: 'Philippines', countryCode: 'PH', latitude: 14.59, longitude: 120.98, sourceUrl: `https://www.wikidata.org/wiki/Q${index + 1}`, address: 'Recorded venue address', openingHours: 'Needs confirmation', fetchedAt: '2040-01-01T00:00:00Z' } });
  const badPhoto = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Restricted_Photo.jpg';
  const day = { day: 1, date: '2040-01-01', theme: 'Recorded visits', imageUrl: '', totalCost: 400, activities: [activity(0, 'Exact Temple'), activity(1, 'No verified attraction image'), activity(2, 'No suitable photo'), { ...activity(3, 'Restricted photo'), imageUrl: badPhoto, imageAttribution: { ...wiki.imageAttribution, license: 'All rights reserved' } }] };
  const itinerary = { destination: 'Manila, Philippines', totalBudget: 1000, currency: 'PHP', travelers: 1, partyType: 'solo', source: 'catalog', days: [day], budgetSummary: { accommodation: 0, food: 0, activities: 400, transport: 0, reserve: 600, total: 1000, dailyAverage: 400, plannedSpend: 400 } };
  const trip = { id: 'wiki-trip', destination: itinerary.destination, currency: 'PHP', budget: 1000, travelers: 1, partyType: 'solo', interests: [], startDate: day.date, endDate: day.date, status: 'active', createdAt: '2040-01-01T00:00:00Z', itinerary };
  let photoWrites = 0, tripWrites = 0;
  await page.route('**/api/platform**', route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith('/photos')) {
      expect(route.request().postDataJSON()).toEqual({ day: 1 }); photoWrites++;
      Object.assign(trip.itinerary.days[0], { activities: day.activities.map((item, index) => index === 0 ? { ...item, ...wiki } : index === 1 ? { ...item, ...fallback } : item) });
      return route.fulfill({ json: { day: trip.itinerary.days[0], persisted: true } });
    }
    if (route.request().method() === 'POST') { tripWrites++; return route.fulfill({ json: { result: trip } }); }
    if (endpoint.endsWith('/trips/wiki-trip')) return route.fulfill({ json: { trip } });
    if (endpoint.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    return route.fulfill({ json: { user: { id: 'wiki-owner', name: 'Photo Tester', email: 'wiki@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true }, trips: [trip], directory: [], listings: [], bookings: [], notifications: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  const images: string[] = [];
  await page.route('**/_next/image?**', route => { images.push(decodeURIComponent(route.request().url())); return route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }); });
  await page.route('https://images.unsplash.com/**', route => route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }));
  await page.goto('/dashboard'); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  const card = page.locator('[data-daily-card]');
  await expect(card.getByRole('link', { name: 'Photo: Wikipedia fixture author', exact: true })).toHaveAttribute('href', wiki.imageAttribution.sourceUrl);
  await expect(card.getByRole('link', { name: 'CC BY-SA 4.0', exact: true })).toHaveAttribute('href', wiki.imageAttribution.licenseUrl);
  await expect(card).toContainText('Cropped to fit');
  await expect(card.locator('img[alt="Exact Temple in Manila, Philippines"]')).toHaveAttribute('src', /960px-Exact_Temple/);
  await expect(card.locator('[data-illustrative-photo]')).toBeVisible();
  await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
  const details = page.locator('[data-day-details]');
  await expect(details.locator('[data-activity-index="2"] figure')).toContainText('Destination photo');
  await expect(details.locator('[data-activity-index="3"] figure')).toContainText('Destination photo');
  await expect(details.locator('[data-activity-index="3"] figure img')).toHaveAttribute('alt', /Destination photo/);
  await expect(details.locator('[data-activity-index="1"] img')).toHaveAttribute('alt', /Illustrative photo/);
  await details.getByRole('button', { name: 'Full details', exact: true }).click();
  const modal = page.getByRole('dialog', { name: /Day 1:/ });
  await expect(modal.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Restricted photo', exact: true }) }).getByText('Destination photo', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Close day details' }).click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 }); await details.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await details.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `../audit/2026-10-12/wikipedia-activity-photos/details-${width}.png` });
  }
  expect(images.some(url => url.includes('Restricted_Photo'))).toBe(false);
  expect(tripWrites).toBe(0); expect(photoWrites).toBeGreaterThan(0);
  expect(trip.itinerary.days[0].totalCost).toBe(400);
  expect(trip.itinerary.days[0].activities[0].description).toBe('Recorded activity description.');
  expect(Reflect.get(trip.itinerary.days[0].activities[0], 'imageAttribution')).toEqual(wiki.imageAttribution);
  await page.reload(); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  await expect(card.getByRole('link', { name: 'Photo: Wikipedia fixture author', exact: true })).toHaveAttribute('href', wiki.imageAttribution.sourceUrl);
  await expect(card.locator('img[data-photo-id="illustrative"]')).toHaveAttribute('src', fallback.imageUrl);
});
