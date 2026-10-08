// Generated from travelmate-backend-api/openapi/travelmate-api.json. Do not edit by hand.

export type CurrencyCode = "PHP" | "USD" | "EUR" | "JPY" | "KRW" | "THB" | "GBP" | "AUD" | "CAD" | "SGD" | "CNY" | "HKD" | "TWD" | "MYR" | "IDR" | "VND" | "INR" | "NZD" | "CHF" | "AED";

export interface FreshnessMetadata {
  source: "flights" | "hotels" | "activities" | "weather" | "exchange-rates";
  status: "live" | "fresh-cache" | "stale-cache" | "unavailable";
  isStale: boolean;
  fetchedAt: string;
  expiresAt: string;
  staleUntil: string;
  policy: string;
}

export interface LocationSuggestion {
  id: number;
  name: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  label: string;
  placeType: string;
  contextLabel: string;
  provider?: "geonames" | "openstreetmap";
  providerId?: string;
  bounds?: { south: number; north: number; west: number; east: number; };
}

export interface AreaSuggestion {
  id: number;
  name: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  label: string;
  placeType: string;
  contextLabel: string;
  provider?: "geonames" | "openstreetmap";
  providerId?: string;
  bounds?: { south: number; north: number; west: number; east: number; };
  description: string;
  population?: number;
  membership: "country-code" | "administrative-hierarchy" | "boundary";
}

export interface DestinationAreasResponse {
  parentId: number;
  countryCode: string;
  areas: Array<AreaSuggestion>;
  total: number;
  nextOffset: number | null;
  status: "ready" | "empty";
  message: string;
  fetchedAt: string;
  expiresAt: string;
  sourceUrls: Array<string>;
}

export interface AreaInterestProfile {
  cityId: number;
  foodPlaces: number;
  culturePlaces: number;
  naturePlaces: number;
}

export interface AreaComparisonResponse {
  parentId: number;
  countryCode: string;
  profiles: Array<AreaInterestProfile>;
  fetchedAt: string;
  expiresAt: string;
  sourceUrl: string;
  radiusKm: number;
  disclaimer: string;
}

export interface TransportationOption {
  id: string;
  label: string;
  category: "public" | "private" | "active" | "water";
}

export interface DestinationContext {
  currency: CurrencyCode | null;
  currencySource: "country-code" | "unsupported";
  transportation: Array<TransportationOption>;
  transportationSource: "curated-country-city-guidance" | "unavailable";
  transportationMessage: string;
}

export interface ExchangeRateQuote {
  base: CurrencyCode;
  quote: CurrencyCode;
  rate: number;
  asOf: string;
  fetchedAt: string;
  refreshAfter: string;
  source: "frankfurter";
  sourceUrl: string;
  disclaimer: string;
  freshness: FreshnessMetadata;
}

export interface AccommodationQuote {
  provider: "expedia-rapid" | "liteapi";
  propertyId: string;
  roomId: string;
  offerId: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  occupancy: Array<{ adults: number; childAges: Array<number>; }>;
  currency: "PHP" | "USD" | "EUR" | "JPY" | "KRW" | "THB" | "GBP" | "AUD" | "CAD" | "SGD" | "CNY" | "HKD" | "TWD" | "MYR" | "IDR" | "VND" | "INR" | "NZD" | "CHF" | "AED";
  total: number;
  nightlyAverage: number;
  taxesAndFeesIncluded?: boolean;
  payableAtProperty: Array<{ amount: number; currency: string; }>;
  budgetTotal?: number;
  guestNationality?: string;
  taxDetails?: Array<{ description: string; included?: boolean; amount?: number; currency?: string; }>;
  priceBreakdown: Array<{ label: string; amount: number; currency: string; }>;
  approximateTotal?: { amount: number; currency: string; };
  checkedAt: string;
  isLive: boolean;
  photoReferences: Array<string>;
  revalidatedAt?: string;
}

export interface PropertyPhoto {
  reference: string;
  url: string;
  caption: string;
  attribution: { creator: string; license: string; sourceUrl: string; licenseUrl?: string; };
}

export type RoomOccupancy = Array<{ adults: number; childAges: Array<number>; }>;

export interface ProviderAccommodation {
  id: string;
  propertyId: string;
  name: string;
  originalName?: string;
  nameSource: "provider-english" | "transliterated" | "unavailable";
  address: string;
  type: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  rating?: number;
  amenities: Array<string>;
  photos: Array<PropertyPhoto>;
  availability: "available" | "sold-out" | "unavailable" | "price-unavailable" | "provider-error";
  environment?: "sandbox" | "production";
  providerMessage?: string;
  quote?: AccommodationQuote;
  quoteToken?: string;
}

export interface LiveAccommodation {
  id: string;
  hotelId: string;
  offerId: string;
  name: string;
  type: "Hotel" | "Hostel" | "Condo" | "Apartment" | "Resort" | "Accommodation" | "Guesthouse";
  typeSource: "name-inferred";
  rating?: number;
  address: string;
  checkInDate: string;
  checkOutDate: string;
  nightlyRate: number;
  total: number;
  currency: CurrencyCode;
  roomDescription: string;
  cancellationPolicy: string;
  available: boolean;
  isLive: boolean;
  source: "amadeus";
  selectionToken: string;
  fetchedAt: string;
  amenities?: Array<string>;
  distanceKm?: number;
  originalName?: string;
  nameSource?: "provider-english" | "transliterated" | "unavailable";
}

export interface NearbyAccommodation {
  id: string;
  name: string;
  type: "Hotel" | "Hostel" | "Resort" | "Guesthouse" | "Motel" | "Apartment";
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  source: "openstreetmap";
  sourceUrl: string;
  city?: string;
  countryCode?: string;
  imageUrl?: string;
  imageAttribution?: { creator: string; license: string; licenseUrl?: string; sourceUrl: string; };
  originalName?: string;
  nameSource?: string;
}

export interface LocationSearchResponse {
  locations: Array<LocationSuggestion>;
}

export interface AccommodationSearchResponse {
  configured: boolean;
  accommodations: Array<LiveAccommodation>;
  message: string;
  freshness: FreshnessMetadata;
  nearbyAccommodations?: Array<NearbyAccommodation>;
  status?: "ready" | "no-results" | "provider-error" | "needs-area";
  mapStatus?: "ready" | "no-results" | "provider-error";
  quoteStatus?: "ready" | "no-results" | "provider-error" | "not-configured";
  areas?: Array<LocationSuggestion>;
  providerAccommodations?: Array<ProviderAccommodation>;
  providerStatus?: "not-configured" | "ready" | "provider-error" | "no-results";
  providerMessage?: string;
  providerEnvironment?: "sandbox" | "production";
}
