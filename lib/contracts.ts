import type { PartyType } from './domain';

export interface ImageAttribution { creator: string; license: string; licenseUrl?: string; sourceUrl: string; }
export interface DayActivity { time: string; title: string; description: string; estimatedCost: number; unitCost?: number; category: 'accommodation' | 'food' | 'activity' | 'transport' | 'misc'; icon: string; imageUrl?: string; imageAttribution?: ImageAttribution; }
export interface DayPlan { day: number; date: string; theme: string; imageUrl: string; imageAttribution?: ImageAttribution; travelNote?: string; returnToStayAt?: string; rideFare?: number; totalCost: number; activities: DayActivity[]; weatherAlert?: string; crowdLevel?: 'low' | 'moderate' | 'high'; crowdSource?: 'estimated'; crowdConfidence?: 'low'; crowdNote?: string; }
export interface AccommodationPlan { listingId: string; name: string; address: string; nightlyRate: number; nights: number; total: number; source?: 'travelmate' | 'amadeus'; offerId?: string; isLive?: boolean; }
export interface BudgetOptimizationSuggestion { id: string; category: 'accommodation' | 'food' | 'activity' | 'transport'; title: string; description: string; estimatedSavings: number; tradeoff: string; affectedDay?: number; affectedActivityTitle?: string; }
export interface BudgetOptimization { status: 'within_budget' | 'near_limit' | 'over_budget'; targetSpend: number; amountToTarget: number; combinedEstimatedSavings: number; projectedSpendIfAllApplied: number; remainingGapAfterSuggestions: number; suggestions: BudgetOptimizationSuggestion[]; disclaimer: string; }

export interface ItineraryResponse {
  destination: string; totalBudget: number; currency: string; source?: 'openai' | 'gemini' | 'mock'; manuallyEdited?: boolean; partyType?: PartyType; travelers?: number; preferences?: { travelStyle: string; accommodation: string; transportation: string; activities: string[] }; accommodation?: AccommodationPlan; budgetOptimization?: BudgetOptimization;
  costSharing?: { partyType: PartyType; travelers: number; groupBudget: number; plannedGroupSpend: number; budgetShares: number[]; plannedSpendShares: number[]; accommodationShares: number[]; reserveShares: number[]; };
  days: DayPlan[];
  budgetSummary: { accommodation: number; food: number; activities: number; transport: number; reserve: number; dailyAverage: number; accommodationActual?: number; variableBudget?: number; plannedSpend?: number; remainingBudget?: number; shortfall?: number; total: number; };
}

export interface ForecastDay { date: string; tempMin: number; tempMax: number; description: string; icon: string; iconUrl: string; precipitationProbability: number; weatherAlert?: string; }
export interface WeatherData { source: 'openweathermap' | 'open-meteo' | 'unavailable' | 'mock'; city: string; country: string; temperature: number; feelsLike: number; humidity: number; windSpeed: number; description: string; icon: string; iconUrl: string; alerts: string[]; forecast: ForecastDay[]; forecastAvailable: boolean; forecastMessage?: string; }
export interface LocationSuggestion { id: number; name: string; region: string; country: string; countryCode: string; latitude: number; longitude: number; label: string; }
export interface LiveAccommodation { id: string; hotelId: string; offerId: string; name: string; address: string; checkInDate: string; checkOutDate: string; nightlyRate: number; total: number; currency: string; roomDescription: string; cancellationPolicy: string; available: boolean; isLive: boolean; source: 'amadeus'; selectionToken: string; fetchedAt: string; }
export interface FlightOption { id: string; provider: 'amadeus'; airline: string; origin: string; destination: string; departure: string; arrival: string; returnDeparture?: string; returnArrival?: string; duration: string; price: number; currency: string; stops: number; seatsAvailable?: number; fetchedAt: string; isLive: boolean; }
export interface ActivityOption { id: string; provider: 'amadeus' | 'travelmate'; name: string; location: string; description: string; price: number; currency: string; rating?: number; referenceUrl?: string; fetchedAt: string; isLive: boolean; }
export interface TravelOptionsResponse { fetchedAt: string; provider: { name: 'amadeus'; configured: boolean; isLive: boolean }; flights: FlightOption[]; activities: ActivityOption[]; flightMessage: string; activityMessage: string; }
