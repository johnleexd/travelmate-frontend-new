import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeMapUrl } from '../lib/place-map.ts';
import { validateActivitySchedule, rescheduleActivities } from '../lib/activity-schedule.ts';
import { validateActivitySchedule as serverValidate } from '../../travelmate-backend-api/src/services/itinerary/activity-schedule.ts';

test('maps use verified coordinates or qualified names without misusing provider IDs', () => {
  const precise = new URL(placeMapUrl({ name: 'Eiffel Tower', destination: 'Paris, France', latitude: 48.8584, longitude: 2.2945 }));
  assert.equal(precise.searchParams.get('query'), '48.8584,2.2945'); assert.equal(precise.searchParams.get('api'), '1');
  const fallback = new URL(placeMapUrl({ name: 'Museum & Gallery', destination: 'Tokyo, Japan', latitude: NaN }));
  assert.equal(fallback.searchParams.get('query'), 'Museum & Gallery, Tokyo, Japan');
  assert.equal(fallback.searchParams.has('query_place_id'), false);
});
test('browser and backend schedule checks agree, including flexible allowances and reorder timing', () => {
  const activities = [{ title: 'Museum', time: '09:00', durationMinutes: 60 }, { title: 'Meals', time: 'Daily allowance' }, { title: 'Park', time: '10:30', durationMinutes: 45 }];
  assert.deepEqual(validateActivitySchedule(activities), serverValidate(activities));
  assert.throws(() => validateActivitySchedule([{ ...activities[0] }, { ...activities[2], time: '09:30' }]), /overlaps/);
  assert.deepEqual(rescheduleActivities([activities[2], activities[0]]).map(a => a.time), ['09:00', '10:00']);
});
