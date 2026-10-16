import type { MapCoordinates } from './trip-map';
import type { NavigationRoute } from './contracts';

export interface ActivityMapPhoto { src: string; attribution: { creator: string; license: string; licenseUrl?: string; sourceUrl: string } }
export interface ActivityMapPlace extends MapCoordinates { id: string; name: string; address: string; sourceUrl: string; photo: ActivityMapPhoto | null }
export interface TripMapActivity { activityId?: string; status?: 'planned' | 'completed' | 'skipped' | 'rescheduled'; index: number; title: string; time: string; description: string; place: ActivityMapPlace | null; locationStatus: string; durationMinutes?: number; estimatedCost?: number; category?: string; budgetOnly?: boolean }
export interface TripMapDay { day: number; date: string; theme: string; estimatedTotal?: number | null; unpriced?: number; activities: TripMapActivity[] }
export interface TripMapManifest { revision?: string; tripStatus?: string; tripId: string; destination: string; anchor: (MapCoordinates & { city: string; country: string; countryCode: string }) | null; origin?: (MapCoordinates & { name: string; kind: 'accommodation' | 'destination' }) | null; days: TripMapDay[]; currency?: string }
export interface MapSelection { dayIndex: number; activityIndex: number; query?: string; placeId?: string }
export interface ActivityMapResult { activity: TripMapActivity; candidates: ActivityMapPlace[]; message: string }
export interface DayMapRoute { route: NavigationRoute; stopIndices: number[]; totalActivities: number; message: string; origin?: MapCoordinates & { name: string; kind: 'accommodation' | 'destination' }; travelLegs?: { fromActivityIndex: number; toActivityIndex: number; durationSeconds: number }[] }
export interface ActivityMapWeather {
  status: 'available' | 'outside-horizon' | 'unavailable' | 'missing-time'; kind: 'current' | 'forecast';
  temperature?: number; condition?: string; precipitationProbability?: number; validAt?: string; localTime?: string; timezone?: string;
  fetchedAt?: string; stale?: boolean; providerUpdatedAt?: string; grid?: MapCoordinates; message?: string;
}
