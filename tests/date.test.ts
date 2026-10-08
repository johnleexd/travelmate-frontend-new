import assert from 'node:assert/strict';
import test from 'node:test';
import { addCalendarDays, regenerationDraftDates } from '../lib/date.ts';

test('regeneration moves past saved dates forward without changing trip length', () => {
  assert.deepEqual(regenerationDraftDates('2026-09-16', '2026-09-22', '2026-09-29'), {
    startDate: '2026-09-29', endDate: '2026-10-05', movedForward: true,
  });
});

for (const days of [1, 14, 21, 28, 31]) {
  test(`regeneration preserves all ${days} inclusive days across months`, () => {
    const start = '2026-01-25';
    const end = addCalendarDays(start, days - 1);
    const moved = regenerationDraftDates(start, end, '2026-10-25');
    assert.equal(moved.endDate, addCalendarDays('2026-10-25', days - 1));
    assert.equal((Date.parse(moved.endDate) - Date.parse(moved.startDate)) / 86_400_000 + 1, days);
  });
}

test('regeneration keeps future saved dates', () => {
  assert.deepEqual(regenerationDraftDates('2026-10-16', '2026-10-22', '2026-09-29'), {
    startDate: '2026-10-16', endDate: '2026-10-22', movedForward: false,
  });
});
