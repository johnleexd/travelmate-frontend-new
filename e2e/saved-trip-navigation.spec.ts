import { expect, test, type Page } from '@playwright/test';
import { setupSavedNavigation as setup, cathedral, fort, museum, type Gps } from './helpers/saved-navigation-fixture';

const gpsCount = (page: Page) => page.evaluate(() => (window as unknown as { dailyGps: Gps }).dailyGps.fixes.length);
test('exact trip context, real day controls, pin-panel sync, photos, forecast horizon and cached selections', async ({ page, context }) => {
  const { dialog, state, open } = await setup(page, context);
  await expect(dialog).toBeVisible(); expect(state.maps).toEqual(['trip-a']); expect(await gpsCount(page)).toBe(0);
  const detail = dialog.getByRole('region', { name: 'Selected activity details' });
  await expect(detail.getByRole('heading', { name: cathedral.name, exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Activity 1: Manila Cathedral', exact: true })).toBeVisible();
  await expect(detail.getByRole('link', { name: 'Photo: Kuranges' })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Activity weather' }).getByRole('heading', { name: 'Forecast · 29 °C' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Activity 2: Fort Santiago', exact: true }).click();
  await expect(detail.getByRole('heading', { name: fort.name, exact: true })).toBeVisible(); await expect(detail.getByText('Place photo unavailable', { exact: true })).toBeVisible();
  const firstPin = dialog.getByRole('button', { name: 'Activity 1: Manila Cathedral', exact: true });
  await firstPin.focus(); await page.keyboard.press('Enter');
  await expect(detail.getByRole('heading', { name: cathedral.name, exact: true })).toBeVisible(); await expect(firstPin).toBeFocused();
  await dialog.getByRole('list', { name: 'Day activity list' }).getByRole('button', { name: /Manila Cathedral/ }).click();
  await expect(detail.getByRole('heading', { name: cathedral.name, exact: true })).toBeVisible();
  expect(state.activities.filter(item => item.tripId === 'trip-a' && item.activityIndex === 0 && item.dayIndex === 0)).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Day 2 2040-10-11', exact: true }).click();
  await expect(detail.getByRole('heading', { name: museum.name, exact: true })).toBeVisible();
  await expect(dialog.getByText(/Forecast not available yet/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Activity 1: National Museum', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Show day route', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Show day route', exact: true }).click();
  await expect(dialog.locator('.trip-road-route')).toBeVisible();
  expect(state.dayRoutes.at(-1)?.dayIndex).toBe(1);
  await expect(dialog.getByRole('button', { name: 'Activity 1: Manila Cathedral', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close trip map' }).click(); await open(1);
  const second = page.getByRole('dialog', { name: 'Fukuoka, Japan', exact: true });
  await expect(second.getByRole('region', { name: 'Selected activity details' }).getByRole('heading', { name: 'Fukuoka Tower', exact: true })).toBeVisible();
  expect(state.maps).toEqual(['trip-a', 'trip-b']); expect(state.writes).toHaveLength(0);
});
test('vague activities stay unpinned until a venue is explicitly selected; all routing modes and rate failures remain honest', async ({ page, context }) => {
  const { dialog, state } = await setup(page, context);
  await dialog.getByRole('list', { name: 'Day activity list' }).getByRole('button', { name: /Local ramen shop/ }).click();
  const detail = dialog.getByRole('region', { name: 'Selected activity details' });
  await expect(detail.getByRole('button', { name: 'Navigate here', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Activity 3: Local ramen shop' })).toHaveCount(0);
  await detail.getByLabel('Choose an exact place', { exact: true }).fill('Named Ramen Venue');
  await detail.getByRole('button', { name: 'Find place', exact: true }).click();
  await expect(detail.getByText('Choose a specific venue from these verified matches.')).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Navigate here', exact: true })).toBeDisabled();
  await detail.getByRole('button', { name: 'Fort Santiago, Manila, Philippines', exact: true }).first().click();
  await expect(detail.getByRole('heading', { name: 'Named Ramen Venue', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Activity 3: Local ramen shop' })).toBeVisible();
  for (const mode of ['Walking', 'Cycling', 'Driving']) {
    await dialog.getByRole('button', { name: mode, exact: true }).click();
    await dialog.getByRole('button', { name: 'Show day route', exact: true }).click();
    await expect(dialog.locator('.trip-road-route')).toBeVisible();
    expect(state.dayRoutes.at(-1)?.mode).toBe(mode.toLowerCase());
    expect(state.dayRoutes.at(-1)?.selections).toEqual([{ activityIndex: 2, query: 'Named Ramen Venue', placeId: 'node:100' }]);
  }
  state.routeFails = true; await dialog.getByRole('button', { name: 'Day 2 2040-10-11', exact: true }).click();
  await dialog.getByRole('button', { name: 'Day 1 2026-10-10', exact: true }).click();
  // A new selection changes the route key and avoids using a prior successful cached path.
  await dialog.getByRole('list', { name: 'Day activity list' }).getByRole('button', { name: /Local ramen shop/ }).click();
  await detail.getByLabel('Choose an exact place', { exact: true }).fill('Different Named Venue'); await detail.getByRole('button', { name: 'Find place', exact: true }).click();
  await detail.getByRole('button', { name: 'Fort Santiago, Manila, Philippines', exact: true }).nth(1).click();
  await dialog.getByRole('button', { name: 'Show day route', exact: true }).click();
  await expect(dialog.getByText(/Routing is busy/)).toBeVisible(); await expect(dialog.locator('.trip-straight-preview')).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test('GPS permission is deferred, denied permission supports a manual start, and navigation keeps the selected place', async ({ page, context }) => {
  const { dialog, state } = await setup(page, context, { denied: true });
  await dialog.getByRole('button', { name: 'Navigate here', exact: true }).click(); expect(await gpsCount(page)).toBe(0);
  await dialog.getByRole('button', { name: 'Use live GPS', exact: true }).click();
  await expect(dialog.getByText(/Location permission was denied/)).toBeVisible(); expect(await gpsCount(page)).toBe(1);
  await dialog.getByLabel('Manual starting point').fill('Exact starting address, Manila, Philippines');
  await dialog.getByRole('button', { name: 'Find start', exact: true }).click();
  await dialog.getByRole('button', { name: 'Exact starting address, Manila, Philippines', exact: true }).click();
  await dialog.getByRole('button', { name: 'Show route here', exact: true }).click();
  await expect(dialog.getByText(/OSRM road\/path route/)).toBeVisible();
  await dialog.getByLabel('Manual starting point').fill('Another starting point');
  await expect(dialog.getByRole('button', { name: 'Show route here', exact: true })).toBeDisabled();
  expect(state.routes[0]).toMatchObject({ origin: { latitude: 14.595, longitude: 120.977 }, destination: { latitude: cathedral.latitude, longitude: cathedral.longitude }, mode: 'walking' });
  await dialog.getByRole('button', { name: 'End navigation', exact: true }).click();
  await expect(dialog.getByRole('region', { name: 'Navigate to selected activity' })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test('poor accuracy blocks live routing; improving GPS and leaving the view stops the location watcher', async ({ page, context }) => {
  const { dialog } = await setup(page, context, { accuracy: 500 });
  await dialog.getByRole('button', { name: 'Navigate here', exact: true }).click(); await dialog.getByRole('button', { name: 'Use live GPS', exact: true }).click();
  await expect(dialog.getByText(/GPS accuracy is poor/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Show route here', exact: true })).toBeDisabled();
  await page.evaluate(() => { const gps = (window as unknown as { dailyGps: Gps }).dailyGps; gps.fixes[0]({ coords: { latitude: 14.592, longitude: 120.972, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() } as GeolocationPosition); });
  await expect(dialog.getByRole('button', { name: 'Show route here', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Close trip map', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { dailyGps: Gps }).dailyGps.cleared)).toContain(0);
});
test('mobile map, collapsible activity panel, focus restoration and failed photos remain usable', async ({ page, context }) => {
  await page.route('**/_next/image?*', route => route.fulfill({ status: 404, body: '' }));
  const { dialog } = await setup(page, context, { noGps: true });
  await expect(dialog.getByRole('region', { name: 'Selected activity details' }).getByText('Place photo unavailable', { exact: true })).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(dialog.getByRole('region', { name: 'Daily itinerary map' })).toBeVisible();
    expect(await dialog.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
    await page.screenshot({ path: '../audit/2026-10-09/trip-specific-navigation/map-' + width + '.png' });
  }
  await dialog.getByText('Day activities · show or hide details', { exact: true }).click();
  await expect(dialog.getByRole('region', { name: 'Selected activity details' })).not.toBeVisible();
  await dialog.getByText('Day activities · show or hide details', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Navigate here', exact: true }).click(); await dialog.getByRole('button', { name: 'Use live GPS', exact: true }).click();
  await expect(dialog.getByText(/Your browser cannot share location here/)).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Saved plans' }).getByRole('article').first().getByRole('button', { name: 'View map / Navigate', exact: true })).toBeFocused();
});

test('daily timeline sorts local schedules, preserves pin identity, separates budget and uses only next-stop provider legs', async ({ page, context }) => {
  const { dialog, state } = await setup(page, context, { timeline: true });
  const panel = dialog.getByRole('region', { name: 'Daily timeline and budget' }), list = panel.getByRole('list', { name: 'Day activity list' }), detail = dialog.getByRole('region', { name: 'Selected activity details' });
  const buttons = list.getByRole('button');
  await expect(buttons).toHaveCount(5);
  await expect(buttons.nth(0)).toContainText(cathedral.name); await expect(buttons.nth(1)).toContainText(fort.name); await expect(buttons.nth(2)).toContainText('Lunch at Named Restaurant');
  await expect(buttons.nth(0)).toContainText('9:00 AM – 10:00 AM'); await expect(buttons.nth(0)).toContainText('Duration: 1 hr'); await expect(buttons.nth(0)).toContainText('PHP 0.00');
  await expect(buttons.nth(3)).toContainText('End time not set'); await expect(buttons.nth(4)).toContainText('Time not set');
  await expect(detail.getByRole('heading', { name: cathedral.name, exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Activity 4: Manila Cathedral', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const budget = panel.getByRole('region', { name: 'Daily budget' }); await expect(budget).toContainText('PHP 375.00'); await expect(budget).toContainText('PHP 125.00');
  await expect(panel.getByRole('region', { name: 'Recorded daily estimate' })).toContainText('PHP 900.00');
  await expect(panel.getByRole('region', { name: 'Recorded daily estimate' })).toContainText('partial (2 items unpriced)');
  await expect(budget.getByRole('button')).toHaveCount(0); await expect(dialog.getByRole('button', { name: /Activity [13]: Daily/ })).toHaveCount(0);
  await buttons.nth(4).click(); await expect(detail).toContainText('Time not set'); await expect(detail.getByRole('button', { name: 'Navigate here', exact: true })).toBeDisabled();
  await buttons.nth(2).click(); await expect(detail.getByRole('heading', { name: 'Named Restaurant', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Activity 5: Lunch at Named Restaurant', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(detail.getByRole('button', { name: 'Navigate here', exact: true })).toBeEnabled();
  await expect(panel.getByText(/min to next stop/)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Show day route', exact: true }).click();
  await expect(panel.getByText('15 min to next stop · walking · OSRM estimate')).toBeVisible();
  await expect(panel.getByText(/11 min to next stop|7 min to next stop/)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cycling', exact: true }).click(); await expect(panel.getByText(/min to next stop/)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Day 2 2040-10-11', exact: true }).click();
  await expect(detail.getByRole('heading', { name: museum.name, exact: true })).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Activity 2: National Museum', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByRole('region', { name: 'Daily budget' })).toContainText('PHP 400.00');
  await dialog.getByRole('button', { name: 'Day 3 2040-10-12', exact: true }).click();
  await expect(dialog.getByText('2040-10-12 · 0 scheduled activities · times are local to the place', { exact: true })).toBeVisible();
  await expect(dialog.getByText('0 mapped stops', { exact: true })).toBeVisible();
  await expect(dialog.getByText('No mapped stops for this day', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Show day route', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Review Day 3 itinerary', exact: true })).toBeVisible();
  await expect(panel).toContainText('No scheduled activities for this day.'); await expect(detail).toHaveCount(0); await expect(list.getByRole('button')).toHaveCount(0);
  await expect(panel.getByRole('region', { name: 'Daily budget' })).toContainText('PHP 250.00'); await expect(dialog.getByRole('button', { name: /^Activity/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Day 1 2026-10-10', exact: true }).click();
  await expect(detail.getByRole('heading', { name: cathedral.name, exact: true })).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded();
    expect(await dialog.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
    expect(await panel.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
    await expect(panel.getByRole('region', { name: 'Daily budget' })).toBeVisible();
    await page.screenshot({ path: '../audit/2026-10-09/daily-map-timeline/timeline-' + width + '.png' });
    await panel.focus(); await page.keyboard.press('End'); await expect(panel.getByRole('region', { name: 'Daily budget' })).toBeInViewport();
    await page.screenshot({ path: '../audit/2026-10-09/daily-map-timeline/timeline-budget-' + width + '.png' });
    await page.keyboard.press('Home'); await expect(buttons.nth(0)).toBeInViewport();
  }
  expect(state.writes).toHaveLength(0);
});
