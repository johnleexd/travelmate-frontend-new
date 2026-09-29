import type {
  AuditEvent,
  Booking,
  Listing,
  ModerationItem,
  PartyType,
  PublicUser,
  SavedTrip,
} from './generated/core-contracts';
import type { CurrencyCode } from './generated/destination-contracts';

export type {
  AuditEvent,
  Booking,
  ItineraryGenerationSummary,
  ItineraryVersion,
  Listing,
  ModerationItem,
  PartyType,
  PaymentStatus,
  ProfileStatus,
  PublicUser,
  Role,
  SavedTrip,
} from './generated/core-contracts';
export type { CurrencyCode } from './generated/destination-contracts';

export const SUPPORTED_CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY', 'KRW', 'THB', 'GBP', 'AUD', 'CAD', 'SGD', 'CNY', 'HKD', 'TWD', 'MYR', 'IDR', 'VND', 'INR', 'NZD', 'CHF', 'AED'] as const;
export const ZERO_DECIMAL_CURRENCIES: readonly CurrencyCode[] = ['JPY', 'KRW', 'VND'];
export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  PHP: 'Philippine peso', USD: 'US dollar', EUR: 'Euro', JPY: 'Japanese yen', KRW: 'South Korean won',
  THB: 'Thai baht', GBP: 'British pound', AUD: 'Australian dollar', CAD: 'Canadian dollar', SGD: 'Singapore dollar',
  CNY: 'Chinese yuan', HKD: 'Hong Kong dollar', TWD: 'New Taiwan dollar', MYR: 'Malaysian ringgit', IDR: 'Indonesian rupiah',
  VND: 'Vietnamese dong', INR: 'Indian rupee', NZD: 'New Zealand dollar', CHF: 'Swiss franc', AED: 'UAE dirham',
};

export function formatMoney(value: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.includes(currency) ? 0 : 2,
  }).format(value);
}

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  solo: 'Solo',
  couple: 'Couple',
  family: 'Family',
  friends: 'Friends / barkada',
};

export function partyBudgetLabel(partyType: PartyType, travelers: number): string {
  if (partyType === 'solo') return 'Solo trip budget';
  if (partyType === 'couple') return 'Combined couple budget';
  if (partyType === 'family') return `Total family budget (${travelers} travelers)`;
  return `Total barkada budget (${travelers} travelers)`;
}

export function partyBudgetExplanation(partyType: PartyType, travelers: number): string {
  if (partyType === 'solo') return 'This entire amount is for you alone.';
  if (partyType === 'couple') return 'Enter one combined budget for both travelers, not an amount per person.';
  if (partyType === 'family') return `Enter one total budget shared by all ${travelers} family members.`;
  return `Enter one total budget shared by all ${travelers} barkada members.`;
}

export function partySpendLabel(partyType: PartyType): string {
  if (partyType === 'solo') return 'Estimated solo spend';
  if (partyType === 'couple') return 'Estimated combined couple spend';
  if (partyType === 'family') return 'Estimated family spend';
  return 'Estimated barkada spend';
}

export function partyEstimateLabel(partyType: PartyType): string {
  if (partyType === 'solo') return 'solo estimate';
  if (partyType === 'couple') return 'combined couple estimate';
  return 'group estimate';
}

export interface StoredUser extends PublicUser {
  passwordHash: string;
  passwordSalt: string;
}

export interface Database {
  users: StoredUser[];
  listings: Listing[];
  bookings: Booking[];
  moderation: ModerationItem[];
  trips: SavedTrip[];
  audit: AuditEvent[];
}

export interface BudgetSplit {
  accommodation: number;
  food: number;
  activities: number;
  transport: number;
  reserve: number;
  dailyAverage: number;
  total: number;
}

export function splitBudget(total: number, travelers = 1, days = 7): BudgetSplit {
  if (!Number.isFinite(total) || total <= 0) throw new Error('Budget must be positive.');
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 20) throw new Error('Travelers must be between 1 and 20.');
  if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error('Trip length must be between 1 and 14 days.');
  const weights = { accommodation: 0.34, food: 0.22, activities: 0.2, transport: 0.14 };
  const accommodation = Math.round(total * weights.accommodation);
  const food = Math.round(total * weights.food);
  const activities = Math.round(total * weights.activities);
  const transport = Math.round(total * weights.transport);
  const reserve = total - accommodation - food - activities - transport;
  return { accommodation, food, activities, transport, reserve, dailyAverage: Math.round(total / days), total };
}

export function travelersForParty(partyType: PartyType, requestedTravelers: number): number {
  if (partyType === 'solo') return 1;
  if (partyType === 'couple') return 2;
  if (!Number.isInteger(requestedTravelers) || requestedTravelers < 2 || requestedTravelers > 20) {
    throw new Error('Family and friends groups must have between 2 and 20 travelers.');
  }
  return requestedTravelers;
}

export function currencyFractionDigits(currency: CurrencyCode): 0 | 2 {
  return ZERO_DECIMAL_CURRENCIES.includes(currency) ? 0 : 2;
}

export function hasValidCurrencyPrecision(value: number, currency: CurrencyCode): boolean {
  if (!Number.isFinite(value)) return false;
  const scale = 10 ** currencyFractionDigits(currency);
  return Math.abs(value * scale - Math.round(value * scale)) < 1e-7;
}

/** Split money exactly in its smallest supported unit; the first members absorb any remainder. */
export function allocateEqualShares(total: number, travelers: number, currency: CurrencyCode): number[] {
  if (total < 0 || !hasValidCurrencyPrecision(total, currency)) {
    throw new Error(`Shared amount must be a non-negative ${currency} value with at most ${currencyFractionDigits(currency)} decimal places.`);
  }
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 20) throw new Error('Travelers must be between 1 and 20.');
  const scale = 10 ** currencyFractionDigits(currency);
  const minorUnitTotal = Math.round(total * scale);
  const base = Math.floor(minorUnitTotal / travelers);
  const remainder = minorUnitTotal - base * travelers;
  return Array.from({ length: travelers }, (_, index) => (base + (index < remainder ? 1 : 0)) / scale);
}

/** Preserve the relative mix of estimates while keeping their exact whole-peso sum under a cap. */
export function capCostsToBudget(costs: number[], cap: number): number[] {
  const safeCosts = costs.map((cost) => Math.max(0, Math.round(Number.isFinite(cost) ? cost : 0)));
  const safeCap = Math.max(0, Math.floor(Number.isFinite(cap) ? cap : 0));
  const total = safeCosts.reduce((sum, cost) => sum + cost, 0);
  if (total <= safeCap) return safeCosts;
  if (total === 0 || safeCap === 0) return safeCosts.map(() => 0);

  const scaled = safeCosts.map((cost) => (cost * safeCap) / total);
  const capped = scaled.map(Math.floor);
  let remainder = safeCap - capped.reduce((sum, cost) => sum + cost, 0);
  const order = scaled
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; remainder > 0; index += 1, remainder -= 1) capped[order[index].index] += 1;
  return capped;
}

const DAILY_SPEND_WEIGHTS = [11, 14, 16, 13, 19, 17, 10] as const;

export function allocateDailyBudget(total: number, reserve: number, days = 7): number[] {
  if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error('Trip length must be between 1 and 14 days.');
  const spendable = Math.max(0, Math.round(total - reserve));
  const weights = Array.from({ length: days }, (_, index) => DAILY_SPEND_WEIGHTS[index % DAILY_SPEND_WEIGHTS.length]);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const daily = weights.map((weight) => Math.floor((spendable * weight) / weightTotal));
  let remainder = spendable - daily.reduce((sum, amount) => sum + amount, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % daily.length) {
    daily[index] += 1;
    remainder -= 1;
  }
  return daily;
}

export function publicUser(user: StoredUser): PublicUser {
  const { passwordHash: _hash, passwordSalt: _salt, ...safe } = user;
  void _hash;
  void _salt;
  return safe;
}
