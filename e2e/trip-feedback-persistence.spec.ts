import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../travelmate-backend-api/src/lib/prisma.ts';
import { createSessionToken } from '../../travelmate-backend-api/src/middlewares/auth-middleware.ts';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test.afterAll(() => prisma.$disconnect());

test('saved-trip stars persist and the same updated feedback appears in the real admin table', async ({ page, context }) => {
  test.setTimeout(90_000);
  const suffix = randomUUID();
  const users: string[] = [];
  let tripId: string | undefined;
  try {
    const owner = await prisma.user.create({ data: { name: 'Rating Test Traveler', email: `rating-owner-${suffix}@example.test`, role: 'traveler', emailVerified: true } }); users.push(owner.id);
    const admin = await prisma.user.create({ data: { name: 'Rating Test Admin', email: `rating-admin-${suffix}@example.test`, role: 'admin', emailVerified: true } }); users.push(admin.id);
    const itinerary = { destination: 'Tokyo', totalBudget: 1000, currency: 'JPY', source: 'mock', days: [{ day: 1, date: '2040-01-01', theme: 'Explore Tokyo', imageUrl: '', totalCost: 100, activities: [{ time: '09:00', title: 'Museum visit', description: 'Visit a local museum.', estimatedCost: 100, category: 'activity', icon: 'map' }] }], budgetSummary: { accommodation: 0, food: 0, activities: 100, transport: 0, reserve: 100, dailyAverage: 100, total: 200 } };
    const trip = await prisma.trip.create({ data: { userId: owner.id, destination: 'Tokyo', startDate: new Date('2040-01-01'), endDate: new Date('2040-01-01'), budget: 1000, currency: 'JPY', travelers: 1, itinerary } }); tripId = trip.id;
    await mockPlanningLookups(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const signIn = async (user: typeof owner) => context.addCookies([{ name: 'travelmate_session', value: createSessionToken(user.id, user.role), domain: 'localhost', path: '/' }]);
    await signIn(owner);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
    await page.getByRole('button', { name: 'Rate this trip', exact: true }).click();
    const form = page.getByRole('form', { name: 'Feedback for Tokyo' });
    await form.getByRole('radio', { name: '4 stars', exact: true }).check();
    await form.getByLabel('Category', { exact: true }).selectOption('route_efficiency');
    const comment = `Route feedback ${suffix}`;
    await form.getByLabel('Feedback comment').fill(comment);
    await form.getByRole('button', { name: 'Submit Feedback', exact: true }).click();
    await expect(form.getByRole('status')).toContainText('Your feedback is saved', { timeout: 20_000 });
    const initial = await prisma.feedback.findUniqueOrThrow({ where: { userId_itineraryId: { userId: owner.id, itineraryId: trip.id } } });
    expect(initial.rating).toBe(4);
    // View the saved itinerary, reopen its own feedback, and update it.
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('button', { name: 'Rate this trip', exact: true }).click();
    await expect(form.getByRole('radio', { name: '4 stars', exact: true })).toBeChecked();
    await expect(form.getByLabel('Feedback comment')).toHaveValue(comment);
    await form.getByRole('radio', { name: '2 stars', exact: true }).check();
    await form.getByRole('button', { name: 'Update Feedback', exact: true }).click();
    await expect(form.getByRole('status')).toContainText('Your feedback is saved', { timeout: 20_000 });
    const rows = await prisma.feedback.findMany({ where: { userId: owner.id, itineraryId: trip.id } });
    expect(rows).toHaveLength(1); expect(rows[0].id).toBe(initial.id); expect(rows[0].rating).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/trip-rating-mobile.png', fullPage: true });
    await signIn(admin);
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/admin/dashboard');
    await page.getByRole('button', { name: 'User Feedback', exact: true }).click();
    const row = page.getByRole('row').filter({ hasText: comment });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByRole('img', { name: '2 out of 5 stars' })).toBeVisible();
    await expect(row).toContainText('Rating Test Traveler');
    await expect(row).toContainText('Route Efficiency');
    await expect(row).toContainText('Not analyzed');
    await expect(row).toContainText(initial.id);
    await expect(row).toContainText(trip.id);
    await page.screenshot({ path: 'test-results/trip-rating-admin.png', fullPage: true });
  } finally {
    await prisma.feedback.deleteMany({ where: { userId: { in: users } } });
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: users } } });
    if (tripId) await prisma.trip.deleteMany({ where: { id: tripId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  }
});
