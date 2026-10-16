import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourcePath = resolve(process.cwd(), '../travelmate-backend-api/openapi/travelmate-api.json');
const errorOutputPath = resolve(process.cwd(), 'lib/generated/api-error-contract.ts');
const plannerOutputPath = resolve(process.cwd(), 'lib/generated/destination-contracts.ts');
const weatherOutputPath = resolve(process.cwd(), 'lib/generated/weather-contracts.ts');
const travelOutputPath = resolve(process.cwd(), 'lib/generated/travel-option-contracts.ts');
const coreOutputPath = resolve(process.cwd(), 'lib/generated/core-contracts.ts');
const storedMediaOutputPath = resolve(process.cwd(), 'lib/generated/stored-trip-media.ts');
const preferencesOutputPath = resolve(process.cwd(), 'lib/generated/trip-preferences.ts');
const generatedPreferences = '// Generated from travelmate-backend-api/src/lib/trip-preferences.ts. Do not edit by hand.\n' + await readFile(resolve(process.cwd(), '../travelmate-backend-api/src/lib/trip-preferences.ts'), 'utf8');
const generatedStoredMedia = '// Generated from travelmate-backend-api/src/lib/stored-trip-media.ts. Do not edit by hand.\n' + await readFile(resolve(process.cwd(), '../travelmate-backend-api/src/lib/stored-trip-media.ts'), 'utf8');
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
  if (Array.isArray(value.enum) && JSON.stringify(value.enum) === JSON.stringify(schemas.CurrencyCode.enum)) return 'CurrencyCode';
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
  'AdministrativeLocationSuggestion',
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
  if (name === 'CurrencyCode') return "import type { CurrencyCode } from './currency';\nexport type { CurrencyCode } from './currency';";
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
  'VisitedPlace', 'VisitRecordResponse', 'VisitedPlacesResponse', 'VisitPlaceReference', 'TripVisitCandidate', 'TripVisitCandidatesResponse', 'TripVisitsRecordResponse', 'PageInfo', 'TripDetailResponse', 'TripVersionsResponse', 'NotificationsResponse',
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

const routeSource = await readFile(resolve(process.cwd(), '../travelmate-backend-api/src/services/itinerary/transport-planning.ts'), 'utf8');
const routeTarget = resolve(process.cwd(), 'lib/generated/transport-planning.ts');
const routeContent = '// Generated from backend transport-planning.ts. Do not edit by hand.\n' + routeSource;
const outputs = [
  [resolve(process.cwd(), 'lib/generated/plan-contracts.ts'), '// Generated from backend contracts/plan.ts. Do not edit by hand.\n' + await readFile(resolve(process.cwd(), '../travelmate-backend-api/src/contracts/plan.ts'), 'utf8')],
  ...await Promise.all(['currency','currency-data'].map(async name=>[resolve(process.cwd(), 'lib/generated/'+name+'.ts'), '// Generated from backend '+name+'.ts. Do not edit by hand.\n' + await readFile(resolve(process.cwd(), '../travelmate-backend-api/src/lib/'+name+'.ts'),'utf8')])),
  [resolve(process.cwd(), 'lib/generated/expense-ledger.ts'), '// Generated from backend expense-ledger.ts. Do not edit by hand.\n' + (await readFile(resolve(process.cwd(), '../travelmate-backend-api/src/lib/expense-ledger.ts'), 'utf8')).replace("'../controllers/itinerary-controller.ts'", "'../contracts.ts'").replace("'../schemas/domain.ts'", "'../domain.ts'")],
  [errorOutputPath, generatedError],
  [plannerOutputPath, generatedDestination],
  [weatherOutputPath, generatedWeather],
  [travelOutputPath, generatedTravel],
  [coreOutputPath, generatedCore],
  [storedMediaOutputPath, generatedStoredMedia],
  [preferencesOutputPath, generatedPreferences],
  [routeTarget, routeContent],
];

// Validate every source before replacing any working contract.
for (const [outputPath, content] of outputs) {
  if (content.includes('\0')) throw new Error(`Refusing to generate ${outputPath}: source contains null bytes.`);
}

const normalizeLines = value => value.replace(/\r\n/g, '\n');
const currentContents = await Promise.all(outputs.map(([outputPath]) => readFile(outputPath, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return '';
  throw error;
})));

if (process.argv.includes('--check')) {
  if (outputs.some(([, content], index) => normalizeLines(currentContents[index]) !== normalizeLines(content))) {
    console.error('Generated API contracts are stale. Run npm run contracts:sync.');
    process.exitCode = 1;
  }
} else {
  await mkdir(resolve(process.cwd(), 'lib/generated'), { recursive: true });
  for (const [index, [outputPath, content]] of outputs.entries()) {
    if (normalizeLines(currentContents[index]) === normalizeLines(content)) continue;
    // Flush a sibling temporary file before atomically replacing the target.
    // An interrupted write leaves the existing module intact for Next.js.
    const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx', flush: true });
      await rename(temporaryPath, outputPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }
  console.log('API contracts are synchronized.');
}
