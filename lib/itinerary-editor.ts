import type { DayActivity, ItineraryResponse } from './contracts.ts';
import { rescheduleActivities, validateActivitySchedule } from './activity-schedule.ts';
import { allocateEqualShares, allocateNightlyCosts, formatMoney } from './domain.ts';
import { buildBudgetOptimization } from './budget-optimization.ts';

export type ActivityDraft = Pick<DayActivity, 'time' | 'title' | 'description' | 'estimatedCost' | 'category' | 'durationMinutes' | 'travelMinutes' | 'location'>;

function validDay(plan: ItineraryResponse, dayIndex: number) {
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= plan.days.length) throw new Error('Select a valid itinerary day.');
}

function normalizedActivity(activity: DayActivity, travelers: number, currency: ItineraryResponse['currency']): DayActivity {
  const cost = Number(activity.estimatedCost);
  if (!activity.title.trim() || activity.title.length > 160) throw new Error('Activity title is required and must not exceed 160 characters.');
  if (!Number.isFinite(cost) || cost < 0 || cost > 10_000_000) throw new Error(`Activity cost must be between ${formatMoney(0, currency)} and ${formatMoney(10_000_000, currency)}.`);
  return {
    ...activity,
    time: activity.time.trim() || 'Flexible',
    title: activity.title.trim(),
    description: activity.description.trim(),
    estimatedCost: Math.round(cost * 100) / 100,
    unitCost: activity.priceEvidence ? activity.unitCost : Math.round((cost / travelers) * 100) / 100,
    icon: activity.category,
  };
}

export function recalculateItineraryCosts(plan: ItineraryResponse): ItineraryResponse {
  const travelers = Math.max(1, plan.travelers || 1);
  const nights = Math.max(0, plan.accommodation?.nights || 0);
  const nightlyRate = Math.max(0, plan.accommodation?.nightlyRate || 0);
  const accommodationTotal = plan.accommodation?.quotedTotal ?? (plan.grounding?.categories.accommodation ?? Math.round(nightlyRate * nights * 100) / 100);
  const lodgingNights = nights || plan.grounding?.nights || 0;
  const lodgingByNight = lodgingNights ? allocateNightlyCosts(accommodationTotal, lodgingNights, plan.currency) : [];
  const days = plan.days.map((day, dayIndex) => {
    const activities = day.activities.map((activity) => normalizedActivity(plan.accommodation && activity.category === 'accommodation' ? { ...activity, estimatedCost: 0 } : activity, travelers, plan.currency));
    const activityTotal = activities.reduce((sum, activity) => sum + activity.estimatedCost, 0);
    const rideFare = activities.filter((activity) => activity.category === 'transport').reduce((sum, activity) => sum + activity.estimatedCost, 0);
    return { ...day, activities, rideFare, totalCost: Math.round((activityTotal + (lodgingByNight[dayIndex] || 0)) * 100) / 100 };
  });
  const plannedSpend = Math.round((days.reduce((sum, day) => sum + day.totalCost, 0) + (plan.selectedTravelCosts?.total ?? 0)) * 100) / 100;
  const groupBudget = plan.totalBudget || plan.budgetSummary.total;
  const remainingBudget = Math.max(0, groupBudget - plannedSpend);
  const shortfall = Math.max(0, plannedSpend - groupBudget);
  const budgetOptimization = buildBudgetOptimization({
    budget: groupBudget,
    currency: plan.currency,
    reserve: plan.budgetSummary.reserve || 0,
    plannedSpend,
    travelers,
    accommodation: plan.accommodation ? { nightlyRate, nights } : undefined,
    days,
  });
  return {
    ...plan,
    manuallyEdited: true,
    days,
    budgetOptimization,
    budgetSummary: { ...plan.budgetSummary, total: groupBudget, accommodationActual: accommodationTotal, travelOptionsActual: plan.selectedTravelCosts?.total ?? 0, plannedSpend, remainingBudget, shortfall },
    costSharing: plan.costSharing ? {
      ...plan.costSharing,
      travelers,
      groupBudget,
      plannedGroupSpend: plannedSpend,
      budgetShares: allocateEqualShares(groupBudget, travelers, plan.currency),
      plannedSpendShares: allocateEqualShares(plannedSpend, travelers, plan.currency),
      accommodationShares: allocateEqualShares(accommodationTotal, travelers, plan.currency),
      reserveShares: allocateEqualShares(remainingBudget, travelers, plan.currency),
    } : plan.costSharing,
  };
}

export function upsertActivity(plan: ItineraryResponse, dayIndex: number, activityIndex: number | null, draft: ActivityDraft): ItineraryResponse {
  validDay(plan, dayIndex);
  const activities = [...plan.days[dayIndex].activities];
  if (activityIndex === null && activities.length >= 8) throw new Error('A day can contain at most 8 activities.');
  const existing = activityIndex === null ? undefined : activities[activityIndex];
  if (activityIndex !== null && !existing) throw new Error('Select a valid activity.');
  const identityUnchanged = existing && existing.title === draft.title.trim() && existing.description === draft.description.trim() && (existing.location || '') === (draft.location || '').trim();
  const priceUnchanged = identityUnchanged && existing.estimatedCost === draft.estimatedCost && existing.category === draft.category;
  const userEvidence: Partial<DayActivity> = plan.grounding && !priceUnchanged ? { ...(identityUnchanged ? {} : { place: undefined, imageUrl: undefined, imageAttribution: undefined, placeVerification: 'unverified' }), unitCost: draft.estimatedCost,
    priceEvidence: { status: 'estimate', source: 'user-entered', basis: 'User-entered whole-group estimate after editing; venue and price are unverified.', fetchedAt: new Date().toISOString(), currency: plan.currency, unit: 'group', unitAmount: draft.estimatedCost, quantity: 1, participants: plan.travelers || 1, needsConfirmation: true } } : {};
  const activity: DayActivity = normalizedActivity({ ...existing, ...draft, durationMinutes: draft.durationMinutes ?? existing?.durationMinutes, ...userEvidence, icon: draft.category }, Math.max(1, plan.travelers || 1), plan.currency);
  if (activityIndex === null) activities.push(activity);
  else activities[activityIndex] = activity;
  const checked = validateActivitySchedule(activities);
  return recalculateItineraryCosts({ ...plan, days: plan.days.map((day, index) => index === dayIndex ? { ...day, activities: checked } : day) });
}

export function removeActivity(plan: ItineraryResponse, dayIndex: number, activityIndex: number): ItineraryResponse {
  validDay(plan, dayIndex);
  if (!plan.days[dayIndex].activities[activityIndex]) throw new Error('Select a valid activity.');
  const activities = plan.days[dayIndex].activities.filter((_, index) => index !== activityIndex);
  return recalculateItineraryCosts({ ...plan, days: plan.days.map((day, index) => index === dayIndex ? { ...day, activities } : day) });
}

export function moveActivity(plan: ItineraryResponse, dayIndex: number, activityIndex: number, direction: -1 | 1): ItineraryResponse {
  validDay(plan, dayIndex);
  const target = activityIndex + direction;
  const activities = [...plan.days[dayIndex].activities];
  if (!activities[activityIndex] || target < 0 || target >= activities.length) return plan;
  [activities[activityIndex], activities[target]] = [activities[target], activities[activityIndex]];
  const scheduled = rescheduleActivities(activities);
  return { ...plan, manuallyEdited: true, days: plan.days.map((day, index) => index === dayIndex ? { ...day, activities: scheduled } : day) };
}
