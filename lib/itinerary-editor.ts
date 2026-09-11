import type { DayActivity, ItineraryResponse } from './contracts.ts';
import { allocateEqualShares } from './domain.ts';
import { buildBudgetOptimization } from './budget-optimization.ts';

export type ActivityDraft = Pick<DayActivity, 'time' | 'title' | 'description' | 'estimatedCost' | 'category'>;

function validDay(plan: ItineraryResponse, dayIndex: number) {
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= plan.days.length) throw new Error('Select a valid itinerary day.');
}

function normalizedActivity(activity: DayActivity, travelers: number): DayActivity {
  const cost = Number(activity.estimatedCost);
  if (!activity.title.trim() || activity.title.length > 160) throw new Error('Activity title is required and must not exceed 160 characters.');
  if (!Number.isFinite(cost) || cost < 0 || cost > 10_000_000) throw new Error('Activity cost must be between PHP 0 and PHP 10,000,000.');
  return {
    ...activity,
    time: activity.time.trim() || 'Flexible',
    title: activity.title.trim(),
    description: activity.description.trim(),
    estimatedCost: Math.round(cost * 100) / 100,
    unitCost: Math.round((cost / travelers) * 100) / 100,
    icon: activity.category,
  };
}

export function recalculateItineraryCosts(plan: ItineraryResponse): ItineraryResponse {
  const travelers = Math.max(1, plan.travelers || 1);
  const nights = Math.max(0, plan.accommodation?.nights || 0);
  const nightlyRate = Math.max(0, plan.accommodation?.nightlyRate || 0);
  const days = plan.days.map((day, dayIndex) => {
    const activities = day.activities.map((activity) => normalizedActivity(activity, travelers));
    const activityTotal = activities.reduce((sum, activity) => sum + activity.estimatedCost, 0);
    const rideFare = activities.filter((activity) => activity.category === 'transport').reduce((sum, activity) => sum + activity.estimatedCost, 0);
    return { ...day, activities, rideFare, totalCost: activityTotal + (dayIndex < nights ? nightlyRate : 0) };
  });
  const plannedSpend = days.reduce((sum, day) => sum + day.totalCost, 0);
  const groupBudget = plan.totalBudget || plan.budgetSummary.total;
  const remainingBudget = Math.max(0, groupBudget - plannedSpend);
  const shortfall = Math.max(0, plannedSpend - groupBudget);
  const accommodationTotal = nightlyRate * nights;
  const budgetOptimization = buildBudgetOptimization({
    budget: groupBudget,
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
    budgetSummary: { ...plan.budgetSummary, total: groupBudget, plannedSpend, remainingBudget, shortfall },
    costSharing: plan.costSharing ? {
      ...plan.costSharing,
      travelers,
      groupBudget,
      plannedGroupSpend: plannedSpend,
      budgetShares: allocateEqualShares(Math.round(groupBudget), travelers),
      plannedSpendShares: allocateEqualShares(Math.round(plannedSpend), travelers),
      accommodationShares: allocateEqualShares(Math.round(accommodationTotal), travelers),
      reserveShares: allocateEqualShares(Math.round(remainingBudget), travelers),
    } : plan.costSharing,
  };
}

export function upsertActivity(plan: ItineraryResponse, dayIndex: number, activityIndex: number | null, draft: ActivityDraft): ItineraryResponse {
  validDay(plan, dayIndex);
  const activities = [...plan.days[dayIndex].activities];
  if (activityIndex === null && activities.length >= 8) throw new Error('A day can contain at most 8 activities.');
  const existing = activityIndex === null ? undefined : activities[activityIndex];
  if (activityIndex !== null && !existing) throw new Error('Select a valid activity.');
  const activity: DayActivity = normalizedActivity({ ...existing, ...draft, icon: draft.category }, Math.max(1, plan.travelers || 1));
  if (activityIndex === null) activities.push(activity);
  else activities[activityIndex] = activity;
  return recalculateItineraryCosts({ ...plan, days: plan.days.map((day, index) => index === dayIndex ? { ...day, activities } : day) });
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
  return { ...plan, manuallyEdited: true, days: plan.days.map((day, index) => index === dayIndex ? { ...day, activities } : day) };
}
