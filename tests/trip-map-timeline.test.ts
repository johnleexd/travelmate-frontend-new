import assert from 'node:assert/strict';
import test from 'node:test';
import { dayTimeline, timelineCost, timelineSchedule, timelineTravel } from '../lib/trip-map-timeline.ts';
import type { TripMapActivity, DayMapRoute } from '../lib/trip-navigation.ts';
const activity = (index: number, time: string, budgetOnly = false): TripMapActivity => ({ index, title: 'Saved activity ' + index, time, budgetOnly, description: '', place: null, locationStatus: 'Choose an exact place' });
test('chronological presentation preserves saved indices and data; allowances are separate', () => {
  const saved = [activity(0, 'Daily allowance', true), activity(1, '1:00 PM'), activity(2, '09:00'), activity(3, 'Flexible'), activity(4, '9 AM'), activity(5, '', true)];
  const before = JSON.stringify(saved), { timeline, budget, stops } = dayTimeline(saved);
  assert.deepEqual(timeline.map(item => item.index), [2, 4, 1, 3]); assert.deepEqual(budget.map(item => item.index), [0, 5]);
  assert.deepEqual(stops.map(item => item.index), [1, 2, 3, 4]); assert.equal(JSON.stringify(saved), before);
});
test('saved ranges and durations provide local endpoints without defaulting missing times', () => {
  assert.equal(timelineSchedule({ time: '9:00 AM – 10:30 AM' }).duration, 90);
  assert.equal(timelineSchedule({ time: '09:00', durationMinutes: 60 }).label, '9:00 AM – 10:00 AM');
  assert.equal(timelineSchedule({ time: '09:00', durationMinutes: 60 }).endFromDuration, true);
  assert.equal(timelineSchedule({ time: '11 PM - 1 AM' }).label, '11:00 PM – 1:00 AM (+1 day)');
  assert.equal(timelineSchedule({ time: '11:00 AM' }).label, '11:00 AM · End time not set');
  for (const time of ['', 'Flexible', 'Morning', 'Daily allowance', '25:00']) assert.equal(timelineSchedule({ time }).label, 'Time not set');
  assert.equal(timelineSchedule({ time: '', durationMinutes: 60 }).end, null);
  assert.equal(timelineSchedule({ time: '09:00' }).duration, undefined);
});
test('destination clock labels do not depend on the browser or process timezone', () => {
  const before = process.env.TZ;
  try { process.env.TZ = 'America/Los_Angeles'; const first = timelineSchedule({ time: '09:00', durationMinutes: 60 });
    process.env.TZ = 'Asia/Tokyo'; assert.deepEqual(timelineSchedule({ time: '09:00', durationMinutes: 60 }), first);
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});
test('zero costs and original currencies remain explicit; absent prices/currencies are not invented', () => {
  assert.equal(timelineCost(0, 'PHP'), 'PHP 0.00'); assert.equal(timelineCost(90000, 'JPY'), 'JPY 90,000');
  assert.equal(timelineCost(undefined, 'PHP'), null); assert.equal(timelineCost(NaN, 'PHP'), null); assert.equal(timelineCost(123, undefined), '123 · Currency not set');
});
test('only provider durations joining the next chronological stop are displayed', () => {
  const route = { route: { mode: 'walking' }, travelLegs: [{ fromActivityIndex: 1, toActivityIndex: 3, durationSeconds: 660 }] } as DayMapRoute;
  assert.deepEqual(timelineTravel(route, 1, 3), { seconds: 660, mode: 'walking' });
  assert.equal(timelineTravel(route, 1, 2), null); assert.equal(timelineTravel(undefined, 1, 3), null);
  assert.equal(timelineTravel({ ...route, travelLegs: [] }, 1, 3), null);
});
