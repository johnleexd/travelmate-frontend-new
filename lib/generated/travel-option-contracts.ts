// Generated from travelmate-backend-api/openapi/travelmate-api.json. Do not edit by hand.

import type { FreshnessMetadata } from './destination-contracts';

export interface FlightOption {
  id: string;
  provider: "amadeus";
  airline: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  returnDeparture?: string;
  returnArrival?: string;
  duration: string;
  price: number;
  currency: string;
  stops: number;
  seatsAvailable?: number;
  fetchedAt: string;
  isLive: boolean;
  selectionToken: string;
}

export interface ActivityOption {
  id: string;
  provider: "amadeus" | "travelmate";
  name: string;
  location: string;
  description: string;
  price: number;
  currency: string;
  rating?: number;
  referenceUrl?: string;
  fetchedAt: string;
  isLive: boolean;
  selectionToken: string;
}

export interface TravelProviderStatus {
  name: "amadeus";
  configured: boolean;
  isLive: boolean;
}

export interface TravelOptionFreshness {
  flights: FreshnessMetadata;
  activities: FreshnessMetadata;
}

export interface TravelOptionsResponse {
  fetchedAt: string;
  provider: TravelProviderStatus;
  flights: Array<FlightOption>;
  activities: Array<ActivityOption>;
  flightMessage: string;
  activityMessage: string;
  freshness: TravelOptionFreshness;
}
