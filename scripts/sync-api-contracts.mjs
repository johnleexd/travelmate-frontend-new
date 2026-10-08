import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourcePath = resolve(process.cwd(), '../travelmate-backend-api/openapi/travelmate-api.json');
const errorOutputPath = resolve(process.cwd(), 'lib/generated/api-error-contract.ts');
const plannerOutputPath = resolve(process.cwd(), 'lib/generated/destination-contracts.ts');
const weatherOutputPath = resolve(process.cwd(), 'lib/generated/weather-contracts.ts');
const travelOutputPath = resolve(process.cwd(), 'lib/generated/travel-option-contracts.ts');
const coreOutputPath = resolve(process.cwd(), 'lib/generated/core-contracts.ts');
const document = JSON.parse(await readFile(sourcePath, 'utf8'));
const schemas = document?.components?.schemas;
const schema = schemas?.ApiError;

if (!schema || !Array.isArray(schema.required) || !schema.required.includes('error') || !schema.required.includes('code') || !schema.required.includes('retryable')) {
  throw new Error('Backend OpenAPI ApiError schema is missing required fields.');
}

const codes = schema.properties?.code?.enum;
if (!Array.isArray(codes) || codes.length === 0 || codes.some((code) => typeof code !== 'string')) {
  throw new Error('Backend OpenAPI ApiError code enum is invalid.');
}

const generatedError = `// Generated from travelmate-backend-api/openapi/travelmate-api.json. Do not edit by hand.\n\nexport const API_ERROR_CODES = ${JSON.stringify(codes)} as const;\nexport type ApiErrorCode = typeof API_ERROR_CODES[number];\n\nexport interface ApiErrorResponse {\n  error: string;\n  code: ApiErrorCode;\n  retryable: boolean;\n  details?: Record<string, unknown>;\n}\n\nconst API_ERROR_CODE_SET = new Set<string>(API_ERROR_CODES);\n\nexport function isApiErrorResponse(value: unknown): value is ApiErrorResponse {\n  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;\n  const candidate = value as Partial<ApiErrorResponse>;\n  return typeof candidate.error === 'string' && candidate.error.length > 0\n    && typeof candidate.code === 'string' && API_ERROR_CODE_SET.has(candidate.code)\n    && typeof candidate.retryable === 'boolean'\n    && (candidate.details === undefined || (typeof candidate.details === 'object' && candidate.details !== null && !Array.isArray(candidate.details)));\n}\n`;

function typeFor(value) {
  if (value['x-typescript-type']) return value['x-typescript-type'];
  if (value.$ref) return value.$ref.split('/').at(-1);
  if (Array.isArray(value.anyOf)) return value.anyOf.map(typeFor).join(' | ');
  if (Array.isArray(value.enum)) return value.enum.map((item) => JSON.stringify(item)).join(' | ');
  if (value.type === 'array') return `Array<${typeFor(value.items)}>`;
  if (value.type === 'object') {
    const required = new Set(value.required || []);
    return `{ ${Object.entries(value.properties || {}).map(([name, property]) => `${name}${required.has(name) ? '' : '?'}: ${typeFor(property)};`).join(' ')} }`;
  }
  if (value.type === 'null') return 'null';
  if (value.type === 'number' || value.type === 'integer') return 'number';
  if (value.type === 'boolean') return 'boolean';
  return 'string';
}

const destinationSchemaNames = [
  'CurrencyCode',
  'FreshnessMetadata',
  'LocationSuggestion',
  'AreaSuggestion',
  'DestinationAreasResponse',
  'AreaInterestProfile',
  'AreaComparisonResponse',
  'TransportationOption',
  'DestinationContext',
  'ExchangeRateQuote',
  'AccommodationQuote', 'PropertyPhoto', 'RoomOccupancy', 'ProviderAccommodation',
  'LiveAccommodation',
  'NearbyAccommodation',
  'LocationSearchResponse',
  'AccommodationSearchResponse',
];

const generatedDestination = `// Generated from travelmate-backend-api/openapi/travelmate-api.json. Do not edit by hand.\n\n${destinationSchemaNames.map((name) => {
  const value = schemas?.[name];
  if (!value) throw new Error(`Backend OpenAPI schema ${name} is missing.`);
  if (value.type !== 'object') return `export type ${name} = ${typeFor(value)};`;
  const required = new Set(value.required || []);
  const fields = Object.entries(value.properties || {}).map(([propertyName, property]) => `  ${propertyName}${required.has(propertyName) ? '' : '?'}: ${typeFor(property)};`).join('\n');
  return `export interface ${name} {\n${fields}\n}`;
}).join('\n\n')}\n`;

const weatherSchemaNames = ['CrowdCondition', 'ForecastDay', 'WeatherData'];
const generatedWeather = `// Generated from travelmate-backend-api/openapi/travelmate-api.json. Do not edit by hand.\n\nimport type { FreshnessMetadata } from './destination-contracts';\n\n${weatherSchemaNames.map((name) => {
  const value = schemas?.[name];
  if (!value || value.type !== 'object') throw new Error(`Backend OpenAPI schema ${name} is missing or invalid.`);
  const required = new Set(value.required || []);
  const fields = Object.entries(value.properties || {}).map(([propertyName, property]) => `  ${propertyName}${required.has(propertyName) ? '' : '?'}: ${typeFor(property)};`).join('\n');
  return `export interface ${name} {\n${fields}\n}`;
}).join('\n\n')}\n`;

const travelSchemaNames = ['FlightOption', 'ActivityOption', 'TravelProviderStatus', 'TravelOptionFreshness', 'TravelOptionsResponse'];
const generatedTravel = `// Generated from travelmate-backend-api/openapi/travelmate-api.json. Do not edit by hand.\n\nimport type { FreshnessMetadata } from './destination-contracts';\n\n${travelSchemaNames.map((name) => {
  const value = schemas?.[name];
  if (!value || value.type !== 'object') throw new Error(`Backend OpenAPI schema ${name} is missing or invalid.`);
  const required = new Set(value.required || []);
  const fields = Object.entries(value.properties || {}).map(([propertyName, property]) => `  ${propertyName}${required.has(propertyName) ? '' : '?'}: ${typeFor(property)};`).join('\n');
  return `export interface ${name} {\n${fields}\n}`;
}).join('\n\n')}\n`;

const coreSchemaNames = [
  'NavigationMode', 'NavigationCoordinate', 'NavigationDestination', 'NavigationStep', 'NavigationRequest', 'NavigationRoute',
  'DestinationAnchor', 'PriceEvidence', 'PlaceEvidence', 'PlanGrounding',
  'Role', 'ProfileStatus', 'PartyType', 'PaymentStatus',
  'AccommodationQuote', 'PropertyPhoto', 'RoomOccupancy',
  'ImageAttribution', 'DayActivity', 'DayPlan', 'AccommodationPlan', 'PlannedAccommodation',
  'SelectedFlightCost', 'SelectedActivityCost', 'PreTripCosts', 'SelectedTravelCosts',
  'BudgetOptimizationSuggestion', 'BudgetOptimization', 'CostSharing',
  'BudgetSummary', 'ItineraryPreferences', 'ItineraryResponse',
  'PublicUser', 'CurrentUserResponse', 'AuthActionResponse', 'ProfileResponse',
  'Listing', 'Booking', 'ListingBlockedDate', 'Promotion', 'Review', 'Notification', 'PaymentTransaction', 'OwnerDocument', 'ModerationItem', 'SavedTrip', 'ItineraryVersion',
  'ItineraryGenerationSummary', 'AuditEvent', 'PlatformMetrics',
  'PlatformIntegrations', 'PlatformResponse', 'PlatformActionResponse',
  'VisitedPlace', 'VisitRecordResponse', 'VisitedPlacesResponse', 'PageInfo', 'TripDetailResponse', 'TripVersionsResponse', 'NotificationsResponse',
  'ItineraryDayResponse',
  'FeedbackSentiment', 'FeedbackCategory', 'FeedbackInput', 'FeedbackEntry', 'FeedbackListResponse', 'FeedbackDetailResponse', 'FeedbackSubmissionResponse', 'FeedbackItineraryResponse',
];
const generatedCore = `// Generated from travelmate-backend-api/openapi/travelmate-api.json. Do not edit by hand.\n\nimport type { CurrencyCode } from './destination-contracts';\n\n${coreSchemaNames.map((name) => {
  const value = schemas?.[name];
  if (!value) throw new Error(`Backend OpenAPI schema ${name} is missing.`);
  if (value.type !== 'object') return `export type ${name} = ${typeFor(value)};`;
  const required = new Set(value.required || []);
  const fields = Object.entries(value.properties || {}).map(([propertyName, property]) => `  ${propertyName}${required.has(propertyName) ? '' : '?'}: ${typeFor(property)};`).join('\n');
  return `export interface ${name} {\n${fields}\n}`;
}).join('\n\n')}\n`;

if (process.argv.includes('--check')) {
  const [currentError, currentDestination, currentWeather, currentTravel, currentCore] = await Promise.all([
    readFile(errorOutputPath, 'utf8').catch(() => ''),
    readFile(plannerOutputPath, 'utf8').catch(() => ''),
    readFile(weatherOutputPath, 'utf8').catch(() => ''),
    readFile(travelOutputPath, 'utf8').catch(() => ''),
    readFile(coreOutputPath, 'utf8').catch(() => ''),
  ]);
  const normalizeLines = value => value.replace(/\r\n/g, '\n');
  if ([
    [currentError, generatedError], [currentDestination, generatedDestination],
    [currentWeather, generatedWeather], [currentTravel, generatedTravel], [currentCore, generatedCore],
  ].some(([current, generated]) => normalizeLines(current) !== normalizeLines(generated))) {
    console.error('Generated API contracts are stale. Run npm run contracts:sync.');
    process.exitCode = 1;
  }
} else {
  await mkdir(resolve(process.cwd(), 'lib/generated'), { recursive: true });
  await Promise.all([
    writeFile(errorOutputPath, generatedError, 'utf8'),
    writeFile(plannerOutputPath, generatedDestination, 'utf8'),
    writeFile(weatherOutputPath, generatedWeather, 'utf8'),
    writeFile(travelOutputPath, generatedTravel, 'utf8'),
    writeFile(coreOutputPath, generatedCore, 'utf8'),
  ]);
  console.log(`Updated ${errorOutputPath}, ${plannerOutputPath}, ${weatherOutputPath}, ${travelOutputPath}, and ${coreOutputPath}`);
}
