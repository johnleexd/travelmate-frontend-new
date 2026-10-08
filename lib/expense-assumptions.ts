import type { ItineraryResponse } from './contracts';
export type ExpenseAssumptions = { rooms?: number; foodDailyPerPerson?: number; nightlyRoomEstimate?: number; transportFare?: number; transportFareType?: 'shared-fare' | 'per-person'; fees?: number; contingencyPercent?: number };
export function restoredExpenseAssumptions(plan: ItineraryResponse): ExpenseAssumptions {
  const evidence = plan.grounding;
  if (!evidence) return {};
  const food = plan.days.flatMap(day => day.activities).find(activity => activity.category === 'food')?.priceEvidence;
  const transport = plan.days.flatMap(day => day.activities).find(activity => activity.category === 'transport')?.priceEvidence;
  return { rooms: evidence.rooms, foodDailyPerPerson: food?.source === 'user-entered' ? food.unitAmount : undefined,
    nightlyRoomEstimate: evidence.accommodation.source === 'user-entered' ? evidence.accommodation.unitAmount : undefined,
    transportFare: transport?.source === 'user-entered' ? transport.unitAmount : undefined,
    transportFareType: transport?.unit === 'shared-fare' || transport?.unit === 'per-person' ? transport.unit : undefined,
    fees: evidence.additionalFees, contingencyPercent: evidence.contingencyPercent };
}
