// Generated from travelmate-backend-api/openapi/travelmate-api.json. Do not edit by hand.

import type { FreshnessMetadata } from './destination-contracts';

export interface CrowdCondition {
  date: string;
  crowdLevel: "low" | "moderate" | "high";
  crowdSource: "estimated";
  crowdConfidence: "low";
  crowdNote: string;
  crowdRecommendation: string;
  fetchedAt: string;
  refreshAfter: string;
}

export interface ForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  description: string;
  icon: string;
  iconUrl: string;
  precipitationProbability: number;
  weatherAlert?: string;
}

export interface WeatherData {
  source: "openweathermap" | "open-meteo" | "unavailable" | "mock";
  city: string;
  country: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  iconUrl: string;
  alerts: Array<string>;
  forecast: Array<ForecastDay>;
  forecastAvailable: boolean;
  forecastMessage?: string;
  fetchedAt: string;
  refreshAfter: string;
  freshness: FreshnessMetadata;
  crowd: Array<CrowdCondition>;
}
