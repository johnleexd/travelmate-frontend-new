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

export interface LiveAccommodation {
  id: string;
  hotelId: string;
  offerId: string;
  name: string;
  type: "Hotel" | "Hostel" | "Condo" | "Apartment" | "Resort" | "Accommodation";
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
}

export interface LocationSearchResponse {
  locations: Array<LocationSuggestion>;
}

export interface AccommodationSearchResponse {
  configured: boolean;
  accommodations: Array<LiveAccommodation>;
  message: string;
  freshness: FreshnessMetadata;
}
