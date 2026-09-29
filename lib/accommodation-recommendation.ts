import type { LiveAccommodation } from './contracts';
import type { CurrencyCode } from './domain';

export interface AccommodationRecommendation {
  accommodation: LiveAccommodation;
  reason: string;
}

const preferenceTypes: Record<string, LiveAccommodation['type'][]> = {
  hostel: ['Hostel'],
  condo: ['Condo', 'Apartment'],
  apartment: ['Apartment', 'Condo'],
  resort: ['Resort'],
};

export function recommendAccommodation(
  accommodations: LiveAccommodation[],
  preference: string,
  budget: number,
  currency: CurrencyCode,
): AccommodationRecommendation | null {
  const eligible = accommodations.filter((stay) => stay.available && stay.currency === currency && stay.total > 0);
  if (!eligible.length) return null;

  const normalizedPreference = preference.trim().toLowerCase();
  const preferredTypes = preferenceTypes[normalizedPreference] || [];
  const lodgingTarget = Number.isFinite(budget) && budget > 0 ? budget * 0.4 : Number.POSITIVE_INFINITY;
  const scored = eligible.map((accommodation) => {
    const matchesType = preferredTypes.includes(accommodation.type);
    const withinTarget = accommodation.total <= lodgingTarget;
    const rating = accommodation.rating || 0;
    let score = (matchesType ? 1_000 : 0) + (withinTarget ? 250 : 0) + rating * 20;
    if (normalizedPreference === 'budget-friendly') score += Math.max(0, 500 - accommodation.total / 10);
    if (normalizedPreference === 'luxury') score += rating * 80 + accommodation.nightlyRate / 20;
    if (normalizedPreference === 'family-friendly' && /family|suite|apartment|condo/i.test(`${accommodation.name} ${accommodation.roomDescription}`)) score += 500;
    return { accommodation, score };
  }).sort((left, right) => right.score - left.score || left.accommodation.total - right.accommodation.total);

  const accommodation = scored[0].accommodation;
  const reasons = [
    preferredTypes.includes(accommodation.type) ? `matches your ${normalizedPreference} stay type` : '',
    accommodation.total <= lodgingTarget ? 'fits the accommodation portion of your budget' : '',
    accommodation.rating ? `has a ${accommodation.rating}/5 provider rating` : '',
  ].filter(Boolean);
  return {
    accommodation,
    reason: reasons.length ? reasons.join(', ') : 'is the strongest available provider result for the selected dates',
  };
}
