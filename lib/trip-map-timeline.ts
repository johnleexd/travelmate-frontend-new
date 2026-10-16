import type { TripMapActivity, DayMapRoute } from './trip-navigation.ts';

function localMinutes(value: string): number | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(value.trim());
  if (!match || !match[2] && !match[3]) return null;
  let hour = Number(match[1]); const minute = Number(match[2] || 0);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + minute;
}
function clock(minutes: number) {
  const time = minutes % 1440, hour = Math.floor(time / 60);
  return (hour % 12 || 12) + ':' + String(time % 60).padStart(2, '0') + (hour >= 12 ? ' PM' : ' AM') + (minutes >= 1440 ? ' (+1 day)' : '');
}
/** Saved clocks are destination-local wall times, never converted through the browser's timezone. */
export function timelineSchedule(activity: Pick<TripMapActivity, 'time' | 'durationMinutes'>) {
  const parts = activity.time.trim().split(/\s*[-–—]\s*|\s+to\s+/i);
  const start = localMinutes(parts[0] || '');
  let end = parts.length === 2 ? localMinutes(parts[1]) : null;
  const savedDuration = typeof activity.durationMinutes === 'number' && Number.isInteger(activity.durationMinutes) && activity.durationMinutes > 0 ? activity.durationMinutes : undefined;
  const endFromDuration = start !== null && end === null && savedDuration !== undefined;
  if (start !== null && end !== null && end < start) end += 1440;
  if (endFromDuration) end = start! + savedDuration!;
  const duration = savedDuration ?? (start !== null && end !== null && end > start ? end - start : undefined);
  return { start, end, duration, endFromDuration, label: start === null ? 'Time not set' : end === null ? clock(start) + ' · End time not set' : clock(start) + ' – ' + clock(end) };
}
export function dayTimeline(activities: TripMapActivity[]) {
  const budget = activities.filter(activity => activity.budgetOnly === true);
  const stops = activities.filter(activity => !activity.budgetOnly);
  const timeline = stops.slice().sort((a, b) => {
    const first = timelineSchedule(a).start ?? Infinity, second = timelineSchedule(b).start ?? Infinity;
    return first === second ? a.index - b.index : first - second;
  });
  return { timeline, budget, stops };
}

/** Budget allowances and skipped activities never provide a route destination. */
export function dayRouteAvailability(activities: TripMapActivity[], hasOrigin = false) {
  const scheduled = activities.filter(activity => !activity.budgetOnly);
  const active = scheduled.filter(activity => activity.status !== 'skipped');
  const mapped = active.filter(activity => activity.place);
  const available = mapped.length >= 2 || mapped.length === 1 && hasOrigin;
  const message = !scheduled.length
    ? 'This day has no saved places to route. Meal and transport allowances are budget entries, not map stops. Open the day itinerary to retry or add activities, then save your changes.'
    : !active.length
      ? 'All activities for this day are skipped. Restore an activity or add places in the day itinerary before routing.'
      : active.length === 1 && mapped.length === 1 && hasOrigin
        ? 'This day has one mapped stop. Show day route starts from your saved accommodation or destination centre.'
        : active.length === 1 && mapped.length === 1
          ? 'This day has one mapped stop. Use Navigate here for directions from your starting point, or add another place in the day itinerary.'
        : !available
          ? 'A day route needs at least two mapped stops. Select an activity and use Choose an exact place to confirm its location.'
          : 'Choose Show day route for roads and walking paths. Straight-line previews are not directions.';
  return { scheduledCount: scheduled.length, mappedCount: mapped.length, available, message };
}
export function timelineDuration(minutes: number) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? hours + ' hr' + (rest ? ' ' + rest + ' min' : '') : minutes + ' min';
}
export function timelineCost(amount: number | undefined, currency: string | undefined): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return null;
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return String(amount) + ' · Currency not set';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code' }).format(amount).replace(/\u00a0/g, ' '); }
  catch { return String(amount) + ' ' + currency; }
}
/** Only expose a provider leg joining the next chronological activity; never infer skipped transfers. */
export function timelineTravel(route: DayMapRoute | undefined, from: number, to: number | undefined) {
  if (!route || to === undefined) return null;
  const leg = Array.isArray(route.travelLegs) ? route.travelLegs.find(item => item && item.fromActivityIndex === from && item.toActivityIndex === to) : undefined;
  return leg && Number.isFinite(leg.durationSeconds) && leg.durationSeconds >= 0 ? { seconds: leg.durationSeconds, mode: route.route.mode } : null;
}
