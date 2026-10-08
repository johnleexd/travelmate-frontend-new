import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationFeedbackId, notificationCategory, notificationDateGroup, notificationTarget } from '../lib/admin-notifications.ts';

test('notification categories use persisted metadata and support legacy appeals', () => {
  assert.equal(notificationCategory({ href: '/admin/dashboard?category=feedback', title: 'Updated rating' }), 'feedback');
  assert.equal(notificationCategory({ href: '/admin/dashboard', title: 'Suspension appeal received' }), 'appeals');
  assert.equal(notificationTarget({ href: 'https://example.com', title: 'Report submitted' }), 'reports');
  assert.equal(notificationTarget({ href: '/admin/dashboard?category=system', title: 'Generation failed' }), 'health');
});
test('notification date groups respect Philippine dates at midnight', () => {
  const now = new Date('2026-10-07T17:00:00Z');
  assert.equal(notificationDateGroup('2026-10-07T16:30:00Z', now), 'Today');
  assert.equal(notificationDateGroup('2026-10-07T15:30:00Z', now), 'Yesterday');
  assert.equal(notificationDateGroup('2026-10-05T00:00:00Z', now), 'Earlier');
});

test('feedback links retain the exact record ID and legacy links still open history', () => {
  assert.equal(notificationFeedbackId({ href: '/admin/dashboard?category=feedback&feedbackId=record%2F123', title: 'New feedback received' }), 'record/123');
  assert.equal(notificationFeedbackId({ href: '/admin/dashboard?category=reports&feedbackId=other', title: 'Report' }), undefined);
  assert.equal(notificationFeedbackId({ href: '/admin/dashboard?category=feedback', title: 'Old feedback notification' }), undefined);
});
