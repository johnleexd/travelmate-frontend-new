import { type Page, type BrowserContext } from '@playwright/test';
import { applyExpenseEdits } from '../../../travelmate-backend-api/src/services/itinerary/expense-edits';
import { buildGroundedPlan } from '../../../travelmate-backend-api/src/services/itinerary/grounded-plan';
import { parseSavedItinerary } from '../../../travelmate-backend-api/src/services/itinerary/saved-trip-schema';
import { applyManualItineraryChanges } from '../../../travelmate-backend-api/src/services/itinerary/itinerary-edit-service';
import { generationPreferencesSchema } from '../../../travelmate-backend-api/src/services/itinerary/travel-preferences';
import { resolveDestinationContext } from '../../../travelmate-backend-api/src/services/destination/destination-context-service';
import { indexedDestination } from '../../../travelmate-backend-api/src/services/destination/destination-index';
import type { ItineraryResponse } from '../../../travelmate-backend-api/src/controllers/itinerary-controller';
import type { SavedTrip } from '../../lib/contracts';

export const user = { id: 'preferences-browser-test', name: 'Preferences Test', email: 'preferences@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const tokyo = indexedDestination(1850147, 'JP')!;
type RecordValue = Record<string, unknown>;
type TripFixture = Omit<SavedTrip, 'itinerary' | 'weather' | 'updatedAt'> & { itinerary: ItineraryResponse; weather?: unknown; updatedAt?: string };

export async function setup(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: 'travelmate_session', value: 'preferences-browser-test', domain: 'localhost', path: '/' }]);
  const state = { saved: null as TripFixture | null, generations: [] as RecordValue[], writes: [] as RecordValue[] };
  const workspace = () => ({ user, trips: state.saved ? [state.saved] : [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] });
  await page.route('**/api/platform**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/photos')) return route.fulfill({ status: 503, json: { error: 'Photo recovery isolated.' } });
    if (path === '/api/platform/trips/preferences-trip') return route.fulfill({ json: { trip: state.saved } });
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state.writes.push(body);
      const trip: TripFixture = { interests: [], ...state.saved, ...body, id: 'preferences-trip', userId: user.id, status: 'active', createdAt: new Date().toISOString() };
      const plan = body.action === 'update-trip-itinerary' && state.saved ? applyManualItineraryChanges(state.saved.itinerary,body.itinerary,state.saved.itinerary.days.length,state.saved.budget,state.saved.travelers,state.saved.currency) as unknown as ItineraryResponse : body.itinerary;
      trip.itinerary = parseSavedItinerary(applyExpenseEdits(plan, body.expenseAssumptions), { days: plan.days.length, destination: trip.destination, currency: trip.currency, budget: trip.budget, travelers: trip.travelers, partyType: trip.partyType, startDate: trip.startDate });
      state.saved = trip;
      return route.fulfill({ json: { result: trip } });
    }
    return route.fulfill({ json: workspace() });
  });
  await page.route('**/api/locations?**', async route => {
    return route.fulfill({ json: { locations: [tokyo], total: 1, nextOffset: null } });
  });
  await page.route('**/api/destination-context?**', route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: resolveDestinationContext(params.get('countryCode') || '', params.get('city') || '') });
  });
  await page.route('**/api/destination-context/exchange-rate?**', route => route.fulfill({ status: 503, json: { error: 'Exchange fixture.' } }));
  await page.route('**/api/weather**', route => route.fulfill({ status: 503, json: { error: 'Weather fixture.' } }));
  await page.route('**/api/accommodations?**', route => route.fulfill({ json: { configured: true, status: 'ready', accommodations: [], nearbyAccommodations: [], providerAccommodations: [{ id: 'liteapi:preferenceshotel', propertyId: 'preferenceshotel', name: 'Preferences Test Hotel', address: 'Tokyo, Japan', type: 'Hotel', latitude: 35.68, longitude: 139.76, distanceKm: 1, amenities: ['WiFi'], photos: [], environment: 'sandbox', availability: 'price-unavailable' }] } }));
  await page.route('**/api/itinerary', async route => {
    const body = route.request().postDataJSON();
    state.generations.push(body);
    const anchor = body.destinationDetails;
    const count = Math.round((Date.parse(body.endDate) - Date.parse(body.startDate)) / 86400000) + 1;
    const plan = buildGroundedPlan({ destination: body.destination, anchor, startingLocation: '', startDate: body.startDate, endDate: body.endDate, budget: body.budget, currency: body.currency, travelers: body.travelers, partyType: body.partyType, places: [], placeDataStatus: 'unavailable', source: 'catalog', preferences: generationPreferencesSchema.parse({ travelStyle: body.travelStyle, interests: body.interests, transportation: body.transportationPreference, accommodation: body.accommodationPreference }), transportation: body.transportationPreference, foodDailyPerPerson: body.foodDailyPerPerson, nightlyRoomEstimate: body.nightlyRoomEstimate, rooms: body.rooms || Math.ceil(body.travelers / 2), transportFare: body.transportFare, transportFareType: body.transportFareType, fees: body.fees, contingencyPercent: body.contingencyPercent, schedule: Array.from({ length: count }, (_, index) => ({ day: index + 1, date: new Date(Date.parse(body.startDate) + index * 86400000).toISOString().slice(0, 10), theme: 'Controlled browser fixture', visits: [], planningStatus: 'incomplete' as const })) });
    if (body.plannedAccommodation) plan.plannedAccommodation = body.plannedAccommodation;
    return route.fulfill({ json: plan });
  });
  return state;
}
