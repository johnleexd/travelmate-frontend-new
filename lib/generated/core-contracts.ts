// Generated from travelmate-backend-api/openapi/travelmate-api.json. Do not edit by hand.

import type { CurrencyCode } from './destination-contracts';

export type NavigationMode = "walking" | "cycling" | "driving";

export interface NavigationCoordinate {
  latitude: number;
  longitude: number;
}

export interface NavigationDestination {
  id: string;
  name: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface NavigationStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  location: NavigationCoordinate;
  maneuver: string;
  modifier?: string;
}

export interface NavigationRequest {
  origin: NavigationCoordinate;
  destination: NavigationCoordinate;
  mode: NavigationMode;
}

export interface NavigationRoute {
  mode: NavigationMode;
  origin: NavigationCoordinate;
  destination: NavigationCoordinate;
  geometry: Array<NavigationCoordinate>;
  steps: Array<NavigationStep>;
  distanceMeters: number;
  durationSeconds: number;
  originOffsetMeters: number;
  destinationOffsetMeters: number;
  fetchedAt: string;
  provider: "osrm";
}

export interface DestinationAnchor {
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

export interface PriceEvidence {
  status: "provider-quote" | "estimate" | "unavailable";
  basis: string;
  source: string;
  sourceUrl?: string;
  fetchedAt: string;
  currency: "PHP" | "USD" | "EUR" | "JPY" | "KRW" | "THB" | "GBP" | "AUD" | "CAD" | "SGD" | "CNY" | "HKD" | "TWD" | "MYR" | "IDR" | "VND" | "INR" | "NZD" | "CHF" | "AED";
  unitAmount: number;
  quantity: number;
  unit: "per-person" | "shared-fare" | "per-room-night" | "group" | "daily-per-person";
  participants: number;
  needsConfirmation: boolean;
}

export interface PlaceEvidence {
  provider: string;
  placeId: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
  fetchedAt: string;
  openingHours: string;
  address: string;
}

export interface PlanGrounding {
  version: number;
  destination: { city: string; country: string; countryCode: string; latitude: number; longitude: number; };
  startingLocation: string;
  startDate: string;
  endDate: string;
  fetchedAt: string;
  placeDataStatus: "live" | "fresh-cache" | "stale-cache" | "unavailable";
  currency: "PHP" | "USD" | "EUR" | "JPY" | "KRW" | "THB" | "GBP" | "AUD" | "CAD" | "SGD" | "CNY" | "HKD" | "TWD" | "MYR" | "IDR" | "VND" | "INR" | "NZD" | "CHF" | "AED";
  rooms: number;
  nights: number;
  foodDailyPerPerson: number;
  accommodation: { status: "provider-quote" | "estimate" | "unavailable"; basis: string; source: string; sourceUrl?: string; fetchedAt: string; currency: "PHP" | "USD" | "EUR" | "JPY" | "KRW" | "THB" | "GBP" | "AUD" | "CAD" | "SGD" | "CNY" | "HKD" | "TWD" | "MYR" | "IDR" | "VND" | "INR" | "NZD" | "CHF" | "AED"; unitAmount: number; quantity: number; unit: "per-person" | "shared-fare" | "per-room-night" | "group" | "daily-per-person"; participants: number; needsConfirmation: boolean; };
  additionalFees: number;
  contingencyPercent: number;
  contingencyAmount: number;
  categories: { accommodation: number; food: number; activities: number; transportation: number; fees: number; contingency: number; };
  subtotal: number;
  total: number;
  verifiedAmount: number;
  estimatedAmount: number;
  unknownPriceCount: number;
  budgetStatus: "exceeds-budget" | "needs-confirmation" | "within-quoted-budget";
  limitations: Array<string>;
}

export type Role = "traveler" | "admin";

export type ProfileStatus = "unverified" | "pending" | "verified" | "rejected";

export type PartyType = "solo" | "couple" | "family" | "friends";

export type PaymentStatus = "PENDING" | "PAID_HELD" | "Released" | "FROZEN_HELD" | "REFUNDED";

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

export interface ImageAttribution {
  creator: string;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
}

export interface DayActivity {
  time: string;
  title: string;
  description: string;
  estimatedCost: number;
  unitCost?: number;
  category: "accommodation" | "food" | "activity" | "transport" | "misc";
  icon: string;
  imageUrl?: string;
  imageAttribution?: ImageAttribution;
  placeVerification?: "supporting-source-found" | "unverified";
  priceEvidence?: PriceEvidence;
  place?: PlaceEvidence;
  durationMinutes?: number;
  travelMinutes?: number;
  location?: string;
}

export interface DayPlan {
  day: number;
  date: string;
  theme: string;
  imageUrl: string;
  imageAttribution?: ImageAttribution;
  travelNote?: string;
  returnToStayAt?: string;
  rideFare?: number;
  totalCost: number;
  activities: Array<DayActivity>;
  weatherAlert?: string;
  crowdLevel?: "low" | "moderate" | "high";
  crowdSource?: "estimated";
  crowdConfidence?: "low";
  crowdNote?: string;
  crowdRecommendation?: string;
  crowdFetchedAt?: string;
  crowdRefreshAfter?: string;
}

export interface AccommodationPlan {
  listingId: string;
  name: string;
  address: string;
  nightlyRate: number;
  nights: number;
  total: number;
  currency: CurrencyCode;
  source?: "travelmate" | "amadeus" | "expedia-rapid" | "liteapi";
  offerId?: string;
  isLive?: boolean;
  quotedTotal?: number;
  rooms?: number;
  fetchedAt?: string;
  providerQuote?: AccommodationQuote;
  photos?: Array<PropertyPhoto>;
  latitude?: number;
  longitude?: number;
}

export interface PlannedAccommodation {
  name: string;
  address: string;
  source: "openstreetmap" | "manual" | "provider";
  sourceId?: string;
  type?: string;
}

export interface SelectedFlightCost {
  id: string;
  name: string;
  total: number;
  currency: CurrencyCode;
  fetchedAt: string;
  isLive?: boolean;
  source?: "amadeus";
}

export interface SelectedActivityCost {
  id: string;
  name: string;
  unitCost: number;
  travelers: number;
  total: number;
  currency: CurrencyCode;
  fetchedAt: string;
  isLive?: boolean;
  priceBasis?: "per-person-assumption";
  source?: "amadeus" | "travelmate";
}

export interface PreTripCosts {
  startingLocation?: string;
  departureAirport?: string;
  passportCountry?: string;
  passportStatus?: "valid" | "needs_application" | "needs_renewal" | "not_sure";
  airportTransferOutbound: number;
  airportTransferReturn: number;
  passport: number;
  visaOrAuthorization: number;
  departureTaxes: number;
  insurance: number;
  other: number;
  total: number;
  currency: CurrencyCode;
  source: "user-entered-estimate";
}

export interface SelectedTravelCosts {
  flight?: SelectedFlightCost;
  activities: Array<SelectedActivityCost>;
  preTrip?: PreTripCosts;
  total: number;
}

export interface BudgetOptimizationSuggestion {
  id: string;
  category: "accommodation" | "food" | "activity" | "transport";
  title: string;
  description: string;
  estimatedSavings: number;
  tradeoff: string;
  affectedDay?: number;
  affectedActivityTitle?: string;
}

export interface BudgetOptimization {
  status: "within_budget" | "near_limit" | "over_budget";
  targetSpend: number;
  amountToTarget: number;
  combinedEstimatedSavings: number;
  projectedSpendIfAllApplied: number;
  remainingGapAfterSuggestions: number;
  suggestions: Array<BudgetOptimizationSuggestion>;
  disclaimer: string;
}

export interface CostSharing {
  partyType: PartyType;
  travelers: number;
  groupBudget: number;
  plannedGroupSpend: number;
  budgetShares: Array<number>;
  plannedSpendShares: Array<number>;
  accommodationShares: Array<number>;
  reserveShares: Array<number>;
}

export interface BudgetSummary {
  accommodation: number;
  food: number;
  activities: number;
  transport: number;
  reserve: number;
  dailyAverage: number;
  accommodationActual?: number;
  travelOptionsActual?: number;
  variableBudget?: number;
  plannedSpend?: number;
  remainingBudget?: number;
  shortfall?: number;
  total: number;
}

export interface ItineraryPreferences {
  travelStyle: string;
  accommodation: string;
  transportation: string;
  activities: Array<string>;
  pace?: "relaxed" | "balanced" | "active";
}

export interface ItineraryResponse {
  destination: string;
  totalBudget: number;
  currency: CurrencyCode;
  source?: "openai" | "gemini" | "mock";
  manuallyEdited?: boolean;
  partyType?: PartyType;
  travelers?: number;
  preferences?: ItineraryPreferences;
  accommodation?: AccommodationPlan;
  selectedTravelCosts?: SelectedTravelCosts;
  budgetOptimization?: BudgetOptimization;
  costSharing?: CostSharing;
  days: Array<DayPlan>;
  budgetSummary: BudgetSummary;
  idempotentReplay?: boolean;
  plannedAccommodation?: PlannedAccommodation;
  grounding?: PlanGrounding;
  groundingProof?: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  profileStatus: ProfileStatus;
  trustScore: number;
  avatarUrl?: string;
  createdAt?: string;
  accountStatus: "active" | "suspended";
  bio?: string;
  phone?: string;
}

export interface CurrentUserResponse {
  user: PublicUser;
}

export interface AuthActionResponse {
  user?: PublicUser;
  redirect?: string;
  message?: string;
  ok?: boolean;
  emailAccepted?: boolean;
}

export interface ProfileResponse {
  profile: PublicUser;
}

export interface Listing {
  id: string;
  ownerId: string;
  name: string;
  category: "stay" | "activity" | "food" | "transport";
  price: number;
  capacity: number;
  available: number;
  status: "pending" | "approved" | "rejected";
  description: string;
  municipality: string;
  address: string;
  amenities: Array<string>;
  imageUrl?: string;
  imageUrls: Array<string>;
  viewCount: number;
}

export interface Booking {
  id: string;
  travelerId: string;
  listingId: string;
  amount: number;
  guests: number;
  nights: number;
  status: "pending" | "confirmed" | "declined" | "change_requested" | "cancel_requested" | "cancelled" | "completed";
  paymentStatus: PaymentStatus;
  checkIn?: string;
  checkOut?: string;
  notes: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  requestedGuests?: number;
  requestNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListingBlockedDate {
  id: string;
  listingId: string;
  date: string;
  reason: string;
}

export interface Promotion {
  id: string;
  listingId: string;
  name: string;
  discountPct: number;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface Review {
  id: string;
  bookingId: string;
  listingId: string;
  travelerId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  href: string;
  readAt?: string;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  bookingId: string;
  kind: string;
  status: string;
  amount: number;
  note: string;
  createdAt: string;
}

export interface OwnerDocument {
  id: string;
  ownerId: string;
  type: string;
  name: string;
  fileUrl: string;
  status: string;
  createdAt: string;
}

export interface ModerationItem {
  id: string;
  kind: "profile" | "listing" | "dispute" | "report" | "appeal";
  subjectId: string;
  title: string;
  details: string;
  status: "pending" | "approved" | "rejected" | "resolved";
  createdAt: string;
}

export interface SavedTrip {
  id: string;
  userId: string;
  destination: string;
  destinationCity?: string;
  destinationRegion?: string;
  destinationCountry?: string;
  destinationCountryCode?: string;
  latitude?: number;
  longitude?: number;
  budget: number;
  currency: CurrencyCode;
  startDate: string;
  endDate: string;
  travelers: number;
  partyType: PartyType;
  interests: Array<string>;
  itinerary: unknown;
  weather: unknown;
  status: "active" | "archived" | "completed";
  archivedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  selectedAccommodation?: { name: string; address: string; selectionKind: "planned" | "quoted"; };
}

export interface ItineraryVersion {
  id: string;
  tripId: string;
  version: number;
  kind: "saved" | "regenerated" | "manual_edit" | "duplicated" | "restored";
  itinerary: unknown;
  weather: unknown;
  createdAt: string;
}

export interface ItineraryGenerationSummary {
  id: string;
  destination: string;
  status: "pending" | "completed" | "failed";
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  createdAt: string;
}

export interface PlatformMetrics {
  held: number;
  released: number;
  frozen: number;
  activeUsers: number;
  pendingProfiles: number;
  listingViews: number;
  bookingRequests: number;
  occupancy: number;
  revenue: number;
}

export interface PlatformIntegrations {
  database: boolean;
  openAI: boolean;
  gemini: boolean;
  weather: boolean;
  amadeus: boolean;
  payMongo: boolean;
}

export interface PlatformResponse {
  user: PublicUser;
  listings: Array<Listing>;
  bookings: Array<Booking>;
  directory: Array<PublicUser>;
  metrics: PlatformMetrics;
  integrations?: PlatformIntegrations;
  trips: Array<SavedTrip>;
  itineraryVersions: Array<ItineraryVersion>;
  itineraryGenerations: Array<ItineraryGenerationSummary>;
  moderation: Array<ModerationItem>;
  audit: Array<AuditEvent>;
  blockedDates: Array<ListingBlockedDate>;
  promotions: Array<Promotion>;
  reviews: Array<Review>;
  notifications: Array<Notification>;
  transactions: Array<PaymentTransaction>;
  ownerDocuments: Array<OwnerDocument>;
  tripsPage?: PageInfo;
  adminOverview?: { generatedPlans: number; averageRating: number | null; feedbackCount: number; generationDays: Array<{ date: string; completed: number; }>; recentCompleted: number; recentFailed: number; timeZone: string; };
  notificationsUnreadCount?: number;
}

export interface PlatformActionResponse {
  result: unknown;
}

export interface VisitedPlace {
  id: string;
  tripId?: string;
  placeKey: string;
  name: string;
  destination: string;
  visitDate: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

export interface VisitRecordResponse {
  visit: VisitedPlace;
  alreadyRecorded: boolean;
}

export interface VisitedPlacesResponse {
  visits: Array<VisitedPlace>;
  page: { total: number; hasMore: boolean; nextCursor?: string; };
}

export interface PageInfo {
  total: number;
  nextCursor: string | null;
}

export interface TripDetailResponse {
  trip: SavedTrip;
}

export interface TripVersionsResponse {
  versions: Array<ItineraryVersion>;
  page: PageInfo;
}

export interface NotificationsResponse {
  notifications: Array<Notification>;
  unreadCount?: number;
}

export interface ItineraryDayResponse {
  day: DayPlan;
  groundingProof?: string;
}

export type FeedbackSentiment = "not_analyzed" | "positive" | "neutral" | "negative";

export type FeedbackCategory = "budget_accuracy" | "weather_info" | "ai_cohesion" | "route_efficiency";

export interface FeedbackInput {
  itineraryId: string;
  rating: number;
  category: FeedbackCategory;
  comment: string;
}

export interface FeedbackEntry {
  id: string;
  userId: string | null;
  itineraryId: string | null;
  rating: number;
  sentiment: FeedbackSentiment;
  category: FeedbackCategory;
  comment: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string; } | null;
  itinerary: { id: string; destination: string; } | null;
}

export interface FeedbackListResponse {
  entries: Array<FeedbackEntry>;
  total: number;
  page: number;
  pageSize: number;
}

export interface FeedbackDetailResponse {
  entry: FeedbackEntry;
}

export interface FeedbackSubmissionResponse {
  result: { id: string; sentiment: FeedbackSentiment; createdAt: string; rating: number; category: FeedbackCategory; comment: string; updatedAt: string; };
}

export interface FeedbackItineraryResponse {
  itinerary: { id: string; destination: string; startDate: string; endDate: string; budget: number; currency: CurrencyCode; travelers: number; updatedAt: string; itinerary: ItineraryResponse | null; };
}
