import type { ItineraryResponse, SavedTrip, WeatherData } from './contracts';
import { isCurrencyCode } from './currency-conversion';
import { parseWeatherData } from '../services/provider-response';

export type ItineraryDraft = { trip: SavedTrip; itinerary: ItineraryResponse; providerBase?: ItineraryResponse; weather: WeatherData | null; savedAt: string };

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Browser storage is untrusted; reject incomplete drafts before offering recovery. */
export function parseItineraryDraft(stored: string, owner: string): ItineraryDraft | null {
  try {
    const draft: unknown = JSON.parse(stored);
    if (!record(draft) || !record(draft.trip) || !record(draft.itinerary)) return null;
    const trip = draft.trip;
    const plan = draft.itinerary;
    if (trip.userId !== owner || typeof trip.id !== 'string' || !text(trip.destination)
      || !amount(trip.budget) || trip.budget === 0 || !isCurrencyCode(trip.currency)
      || !date(trip.startDate) || !date(trip.endDate) || trip.endDate < trip.startDate
      || !Number.isInteger(trip.travelers) || Number(trip.travelers) < 1
      || !['solo', 'couple', 'family', 'friends'].includes(String(trip.partyType))
      || !Array.isArray(trip.interests) || !trip.interests.every(item => typeof item === 'string')
      || !text(draft.savedAt) || !Number.isFinite(Date.parse(draft.savedAt))) return null;
    const duration = (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86_400_000 + 1;
    if (duration > 31 || plan.destination !== trip.destination || plan.currency !== trip.currency
      || !amount(plan.totalBudget) || !record(plan.budgetSummary)
      || !['total', 'accommodation', 'food', 'activities', 'transport', 'reserve', 'dailyAverage'].every(key => amount((plan.budgetSummary as Record<string, unknown>)[key]))
      || !Array.isArray(plan.days) || plan.days.length !== duration
      || !plan.days.every(day => record(day) && Number.isInteger(day.day) && date(day.date) && text(day.theme) && amount(day.totalCost)
        && Array.isArray(day.activities) && day.activities.every(activity => record(activity) && text(activity.title)
          && typeof activity.description === 'string' && text(activity.time) && text(activity.category) && amount(activity.estimatedCost)))) return null;
    if (plan.preferences !== undefined && (!record(plan.preferences)
      || (plan.preferences.travelStyle !== undefined && typeof plan.preferences.travelStyle !== 'string')
      || !['accommodation', 'transportation'].every(key => typeof (plan.preferences as Record<string, unknown>)[key] === 'string')
      || (plan.preferences.interests !== undefined && (!Array.isArray(plan.preferences.interests) || !plan.preferences.interests.every(item => typeof item === 'string')))
      || !Array.isArray(plan.preferences.activities) || !plan.preferences.activities.every(item => typeof item === 'string'))) return null;
    if (plan.grounding !== undefined && (!record(plan.grounding) || !record(plan.grounding.accommodation)
      || !record(plan.grounding.destination) || typeof plan.grounding.destination.latitude !== 'number' || !Number.isFinite(plan.grounding.destination.latitude)
      || typeof plan.grounding.destination.longitude !== 'number' || !Number.isFinite(plan.grounding.destination.longitude)
      || !Array.isArray(plan.grounding.limitations) || !plan.grounding.limitations.every(item => typeof item === 'string'))) return null;
    if (plan.costSharing !== undefined && (!record(plan.costSharing)
      || !['plannedSpendShares', 'accommodationShares', 'budgetShares', 'reserveShares'].every(key => Array.isArray((plan.costSharing as Record<string, unknown>)[key])))) return null;
    // Weather is advisory: a malformed snapshot must not crash a usable itinerary.
    let weather: WeatherData | null = null;
    if (draft.weather) {
      try { weather = parseWeatherData(draft.weather); } catch { /* Restore the plan without invalid weather metadata. */ }
    }
    const providerBase = record(draft.providerBase) && draft.providerBase.destination === plan.destination && draft.providerBase.currency === plan.currency && typeof draft.providerBase.groundingProof === 'string' ? draft.providerBase as unknown as ItineraryResponse : undefined;
    return { trip: trip as unknown as SavedTrip, itinerary: plan as unknown as ItineraryResponse, providerBase,
      weather, savedAt: draft.savedAt };
  } catch { return null; }
}
