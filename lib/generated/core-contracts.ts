// Generated from travelmate-backend-api/openapi/travelmate-api.json. Do not edit by hand.

import type { CurrencyCode } from './destination-contracts';

export type Role = "traveler" | "admin";

export type ProfileStatus = "unverified" | "pending" | "verified" | "rejected";

export type PartyType = "solo" | "couple" | "family" | "friends";

export type PaymentStatus = "PENDING" | "PAID_HELD" | "Released" | "FROZEN_HELD" | "REFUNDED";

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
  source?: "travelmate" | "amadeus";
  offerId?: string;
  isLive?: boolean;
}

export interface SelectedFlightCost {
  id: string;
  name: string;
  total: number;
  currency: CurrencyCode;
  fetchedAt: string;
}

export interface SelectedActivityCost {
  id: string;
  name: string;
  unitCost: number;
  travelers: number;
  total: number;
  currency: CurrencyCode;
  fetchedAt: string;
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
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  profileStatus: ProfileStatus;
  trustScore: number;
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
  verificationCode?: string;
  resetCode?: string;
  message?: string;
  ok?: boolean;
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
  status: "active" | "archived";
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
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
}

export interface PlatformActionResponse {
  result: unknown;
}

export interface ItineraryDayResponse {
  day: DayPlan;
}
