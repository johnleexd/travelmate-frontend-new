import type { ItineraryResponse, WeatherData } from './contracts.ts';

/** Refreshes advisory crowd metadata without changing user-owned itinerary content. */
export function applyConditionSnapshot(plan: ItineraryResponse, conditions: WeatherData): ItineraryResponse {
  const byDate = new Map(conditions.crowd.map((condition) => [condition.date, condition]));
  return {
    ...plan,
    days: plan.days.map((day) => {
      const crowd = byDate.get(day.date);
      return crowd ? {
        ...day,
        crowdLevel: crowd.crowdLevel,
        crowdSource: crowd.crowdSource,
        crowdConfidence: crowd.crowdConfidence,
        crowdNote: crowd.crowdNote,
        crowdRecommendation: crowd.crowdRecommendation,
        crowdFetchedAt: crowd.fetchedAt,
        crowdRefreshAfter: crowd.refreshAfter,
      } : day;
    }),
  };
}
