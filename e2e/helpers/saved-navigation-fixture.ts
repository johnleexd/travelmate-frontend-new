import type { Page, BrowserContext } from '@playwright/test';
import { mockPlanningLookups } from './mock-planning-lookups';
import type { TripMapManifest, TripMapActivity } from '../../lib/trip-navigation';

type Point = { latitude: number; longitude: number };
export type Gps = { fixes: PositionCallback[]; cleared: number[] };
const user = { id: 'daily-map-owner', name: 'Map Tester', email: 'daily-map@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const makePlace = (id: string, name: string, latitude: number, longitude: number) => ({ id, name, latitude, longitude, address: name + ', Manila, Philippines', sourceUrl: 'https://www.wikidata.org/wiki/' + id, photo: null });
export const cathedral = makePlace('Q112', 'Manila Cathedral', 14.591, 120.973), fort = makePlace('Q113', 'Fort Santiago', 14.594, 120.969), museum = makePlace('Q114', 'National Museum', 14.587, 120.981);
const photo = { src: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/The_Manila_Cathedral.jpg',
  attribution: { creator: 'Kuranges', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Manila_Cathedral.jpg' } };
const makeActivity = (index: number, title: string, place: typeof cathedral | null, time: string): TripMapActivity => ({ index, title, place, time, description: 'Saved description for ' + title, locationStatus: place ? 'Verified saved place' : 'Choose an exact place' });
export const makeMap = (id: string): TripMapManifest => ({ tripId: id, destination: id === 'trip-a' ? 'Manila, Philippines' : 'Fukuoka, Japan',
  anchor: { city: id === 'trip-a' ? 'Manila' : 'Fukuoka', country: id === 'trip-a' ? 'Philippines' : 'Japan', countryCode: id === 'trip-a' ? 'PH' : 'JP', latitude: id === 'trip-a' ? 14.6042 : 33.6, longitude: id === 'trip-a' ? 120.9822 : 130.41 },
  days: id === 'trip-a' ? [{ day: 1, date: '2026-10-10', theme: 'Historic Manila', activities: [makeActivity(0, cathedral.name, cathedral, '9:00 AM - 10:00 AM'), makeActivity(1, fort.name, fort, '11:00 AM'), makeActivity(2, 'Local ramen shop', null, '12:00 PM')] },
    { day: 2, date: '2040-10-11', theme: 'Museum day', activities: [makeActivity(0, museum.name, museum, '09:00')] }]
    : [{ day: 1, date: '2026-10-12', theme: 'Fukuoka city', activities: [makeActivity(0, 'Fukuoka Tower', { ...cathedral, id: 'Q500', name: 'Fukuoka Tower', address: 'Fukuoka, Japan', latitude: 33.593, longitude: 130.351 }, '10:00')] }] });
const trips = ['trip-a', 'trip-b'].map(id => ({ id, userId: user.id, destination: makeMap(id).destination, destinationCity: makeMap(id).anchor!.city,
  destinationCountry: makeMap(id).anchor!.country, destinationCountryCode: makeMap(id).anchor!.countryCode, latitude: makeMap(id).anchor!.latitude, longitude: makeMap(id).anchor!.longitude,
  budget: 20000, currency: id === 'trip-a' ? 'PHP' : 'JPY', travelers: 1, partyType: 'solo', interests: [], startDate: '2026-10-10', endDate: '2026-10-12', status: 'active', createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z', itinerary: null, weather: null }));
function routeFor(origin: Point, destination: Point, mode: string) {
  return { origin, destination, mode, provider: 'osrm', fetchedAt: '2026-10-09T00:00:00Z', originOffsetMeters: 0, destinationOffsetMeters: 0, distanceMeters: 900, durationSeconds: 600,
    geometry: [origin, { latitude: destination.latitude, longitude: origin.longitude }, destination], steps: [
      { instruction: 'Head north on the mapped street', distanceMeters: 500, durationSeconds: 300, location: origin, maneuver: 'depart' },
      { instruction: 'Continue to the mapped entrance', distanceMeters: 400, durationSeconds: 300, location: destination, maneuver: 'arrive' }] };
}
export async function setupSavedNavigation(page: Page, context: BrowserContext, options: { denied?: boolean; accuracy?: number; noGps?: boolean; timeline?: boolean; initialUrl?: string; openMap?: boolean; empty?: boolean } = {}) {
  await context.addCookies([{ name: 'travelmate_session', value: 'daily-map-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await mockPlanningLookups(page);
  await page.addInitScript(options => {
    const gps: Gps = { fixes: [], cleared: [] }; Object.defineProperty(window, 'dailyGps', { value: gps });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: options.noGps ? undefined : {
      watchPosition: (fix: PositionCallback, fail: PositionErrorCallback) => {
        const id = gps.fixes.push(fix) - 1;
        queueMicrotask(() => options.denied ? fail({ code: 1 } as GeolocationPositionError) : fix({ coords: { latitude: 14.592, longitude: 120.972, accuracy: options.accuracy || 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() } as GeolocationPosition));
        return id;
      }, clearWatch: (id: number) => gps.cleared.push(id),
    } });
  }, options);
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e4ede1"/><path d="M0 180L256 70M70 0L180 256" stroke="#fffefa" stroke-width="12"/><text x="12" y="25" fill="#52645a">Test map tile</text></svg>' }));
  await page.route('**/api/destination-context/photo?*', route => route.fulfill({ json: { photo: null } }));
  function mapFor(id: string) {
    const map = makeMap(id);
    if (options.timeline && id === 'trip-a') {
      map.currency = 'PHP';
      map.days[0].activities = [
        { ...makeActivity(0, 'Daily meals allowance', null, 'Daily allowance'), budgetOnly: true, estimatedCost: 375, category: 'food' },
        { ...makeActivity(1, fort.name, fort, '11:00 AM'), durationMinutes: 90, estimatedCost: 100 },
        { ...makeActivity(2, 'Daily transport allowance', null, 'Daily allowance'), budgetOnly: true, estimatedCost: 125, category: 'transport' },
        { ...makeActivity(3, cathedral.name, cathedral, '9:00 AM'), durationMinutes: 60, estimatedCost: 0 },
        { ...makeActivity(4, 'Lunch at Named Restaurant', { ...fort, id: 'Q115', name: 'Named Restaurant' }, '1:00 PM – 2:00 PM'), estimatedCost: 300, category: 'food' },
        { ...makeActivity(5, museum.name, museum, '14:00'), estimatedCost: undefined },
        makeActivity(6, 'Unscheduled activity', null, 'Flexible'),
      ];
      map.days[1].activities = [{ ...makeActivity(0, 'Daily meals allowance', null, 'Daily allowance'), budgetOnly: true, estimatedCost: 400 }, makeActivity(1, museum.name, museum, '09:00')];
      map.days.push({ day: 3, date: '2040-10-12', theme: 'Budget only', activities: [{ ...makeActivity(0, 'Daily meals allowance', null, 'Daily allowance'), budgetOnly: true, estimatedCost: 250 }] });
    }
    return map;
  }
  const state = { maps: [] as string[], activities: [] as Record<string, unknown>[], weather: [] as Record<string, unknown>[], dayRoutes: [] as Record<string, unknown>[], routes: [] as Record<string, unknown>[], writes: [] as Record<string, unknown>[], routeFails: false, mapFails: false };
  await page.route('**/api/platform**', route => {
    if (route.request().method() === 'POST') state.writes.push(route.request().postDataJSON());
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (path.endsWith('/activities')) {
      const id = path.split('/')[4], saved = trips.find(trip => trip.id === id), map = mapFor(id);
      return route.fulfill({ json: { trip: { ...saved, itinerary: { days: map.days } }, revision: 'fixture-revision', canManage: false } });
    }
    return route.fulfill({ json: { user, trips: options.empty ? [] : trips, tripsPage: { total: options.empty ? 0 : 2, hasMore: false, nextCursor: null }, directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.route('**/api/navigation/trips/**', route => {
    const url = new URL(route.request().url()), id = url.pathname.split('/')[4], map = mapFor(id), endpoint = url.pathname.split('/').at(-1);
    if (endpoint === 'map') { state.maps.push(id); return state.mapFails || !['trip-a', 'trip-b'].includes(id) ? route.fulfill({ status: 404, json: { error: 'Saved trip not found.' } }) : route.fulfill({ json: { map } }); }
    const body = route.request().postDataJSON();
    if (endpoint === 'activity') {
      state.activities.push({ tripId: id, ...body });
      const activity = map.days[body.dayIndex].activities[body.activityIndex];
      if (body.query) {
        const candidates = [{ ...fort, id: 'node:100', name: 'Named Ramen Venue', photo: null }, { ...fort, id: 'node:101', name: 'Second Named Venue', longitude: 120.975, photo: null }];
        const chosen = body.placeId ? candidates.find(item => item.id === body.placeId) : null;
        return route.fulfill({ json: { activity: { ...activity, place: chosen, locationStatus: chosen ? 'Selected for this map session' : 'Choose an exact place' }, candidates, message: chosen ? '' : 'Choose a specific venue from these verified matches.' } });
      }
      return route.fulfill({ json: { activity: { ...activity, place: activity.place ? { ...activity.place, photo: id === 'trip-a' && body.dayIndex === 0 && body.activityIndex === 0 ? photo : null } : null }, candidates: [], message: '' } });
    }
    if (endpoint === 'weather') {
      state.weather.push({ tripId: id, ...body });
      return route.fulfill({ json: { weather: body.selection.dayIndex === 1 && !body.current ? { status: 'outside-horizon', kind: 'forecast', message: 'Forecast not available yet. This date is outside the provider forecast window.' } : {
        status: 'available', kind: body.current ? 'current' : 'forecast', temperature: 29, condition: 'partly cloudy', precipitationProbability: 40,
        timezone: 'Asia/Manila', localTime: '2026-10-10T09:00', validAt: '2026-10-10T01:00:00Z', fetchedAt: '2026-10-09T00:00:00Z', stale: false, grid: { latitude: 14.6, longitude: 120.98 } } } });
    }
    state.dayRoutes.push({ tripId: id, ...body });
    return state.routeFails ? route.fulfill({ status: 429, headers: { 'Retry-After': '60' }, json: { error: 'Routing is busy. Try again later.' } })
      : route.fulfill({ json: { route: routeFor(cathedral, fort, body.mode), stopIndices: [0, 1], totalActivities: 3, ...(options.timeline ? { travelLegs: [{ fromActivityIndex: 1, toActivityIndex: 3, durationSeconds: 660 }, { fromActivityIndex: 3, toActivityIndex: 4, durationSeconds: 420 }, { fromActivityIndex: 4, toActivityIndex: 5, durationSeconds: 900 }] } : {}), message: 'Route includes only verified stops. Unresolved activities are omitted.' } });
  });
  await page.route('**/api/navigation/search', route => route.fulfill({ json: { destinations: [{ id: 'start', name: 'Exact starting address', label: 'Exact starting address, Manila, Philippines', latitude: 14.595, longitude: 120.977 }] } }));
  await page.route('**/api/navigation/route', route => { const body = route.request().postDataJSON(); state.routes.push(body); return route.fulfill({ json: { route: routeFor(body.origin, body.destination, body.mode) } }); });
  await page.goto(options.initialUrl || '/dashboard'); if (!options.initialUrl) await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  const open = async (index = 0) => page.getByRole('region', { name: 'Saved plans' }).getByRole('article').nth(index).getByRole('button', { name: 'View map / Navigate', exact: true }).click();
  if (options.openMap !== false) await open();
  return { state, open, dialog: page.getByRole('dialog', { name: 'Manila, Philippines', exact: true }) };
}
