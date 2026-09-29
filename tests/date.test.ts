import assert from 'node:assert/strict';
import test from 'node:test';
import { regenerationDraftDates } from '../lib/date.ts';

test('regeneration moves past saved dates forward without changing trip length', () => {
  assert.deepEqual(regenerationDraftDates('2026-09-16', '2026-09-22', '2026-09-29'), {
    startDate: '2026-09-29', endDate: '2026-10-05', movedForward: true,
  });
});

test('regeneration keeps future saved dates', () => {
  assert.deepEqual(regenerationDraftDates('2026-10-16', '2026-10-22', '2026-09-29'), {
    startDate: '2026-10-16', endDate: '2026-10-22', movedForward: false,
  });
});
