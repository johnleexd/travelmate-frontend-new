import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { budgetFixture } from '../tests/fixtures/budget-review-plan';
import { calculateExpense, expenseLedger } from '../lib/generated/expense-ledger';
import type { ItineraryResponse } from '../lib/contracts';
import type { PartyType } from '../lib/domain';
import { formatMoney } from '../lib/domain';

async function setup(page: Page, context: BrowserContext, plan: ItineraryResponse) {
  const user = { id: 'party-budget-owner', name: 'Budget verification', email: 'budget@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
  const trip = { id: 'party-budget-trip', userId: user.id, destination: plan.destination, currency: plan.currency, budget: plan.totalBudget, partyType: plan.partyType, travelers: plan.travelers, interests: [], startDate: plan.days[0].date, endDate: plan.days.at(-1)!.date, itinerary: plan, status: 'active', createdAt: '2026-10-16T00:00:00Z' };
  await context.addCookies([{ name: 'travelmate_session', value: 'local-ui-verification', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/_next/image?*', route => route.abort());
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/platform/trips/party-budget-trip') return route.fulfill({ json: { trip } });
    if (path === '/api/platform') return route.fulfill({ json: { user, trips: [{ ...trip, itinerary: null }], tripsPage: { total: 1, hasMore: false }, notifications: [], directory: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
    return route.fulfill({ json: { user, notifications: [], locations: [], photos: [], quotes: [] } });
  });
  await page.goto('/dashboard?tab=bookings&trip=party-budget-trip');
  return page.getByRole('dialog', { name: plan.destination, exact: true });
}
function partyPlan(mode: PartyType, count: number) {
  const plan = budgetFixture(); plan.partyType = mode; plan.travelers = count;
  for (const day of plan.days) for (const item of day.activities) {
    const p = item.priceEvidence!; p.participants = count;
    item.estimatedCost = calculateExpense(p.unitAmount,p.quantity,count,p.unit,plan.currency);
  }
  for(const item of plan.selectedTravelCosts!.activities) { item.travelers=count; item.total=item.unitCost*count; }
  plan.selectedTravelCosts!.total=plan.selectedTravelCosts!.flight!.total+plan.selectedTravelCosts!.activities.reduce((sum,item)=>sum+item.total,0)+plan.selectedTravelCosts!.preTrip!.total;
  plan.days.forEach((day,index)=>{ day.totalCost=day.activities.reduce((sum,item)=>sum+item.estimatedCost,0)+(index<2?1200:0); });
  return plan;
}
for(const [mode,count,label] of [['solo',1,'Solo'],['couple',2,'Couple'],['family',4,'Family'],['friends',5,'Friends / barkada']] as const) {
  test(`${mode}: saved cards, traveler breakdown, review and reload use the same amounts`,async({page,context},info)=>{
    const plan=partyPlan(mode,count), ledger=expenseLedger(plan), dialog=await setup(page,context,plan);
    const party=dialog.getByRole('region',{name:'Travel party cost breakdown'});
    await expect(party).toContainText(`${label} · ${count} ${count===1?'traveler':'travelers'}`);
    await expect(party).toContainText(formatMoney(ledger.total!,plan.currency));
    const cost=dialog.locator('[data-expense-estimate]').first();
    await expect(cost).toContainText(`${count} ${count===1?'traveler':'travelers'}`);
    await expect(cost).not.toContainText('/ group');
    const included=dialog.locator('[data-expense-estimate]').filter({hasText:'Included once in selected activity costs'}).first();
    await expect(included.locator('strong')).toHaveCount(0);
    await expect(included).toContainText(`for ${count} traveler(s)`);
    if(count>1){await expect(cost).toContainText('estimated per person');if(mode!=='couple')await party.getByText('Estimated traveler breakdown',{exact:true}).click();await expect(party.getByText(`Traveler ${count}:`,{exact:false})).toBeVisible();}
    await dialog.getByRole('button',{name:'Review budget',exact:true}).click();
    await expect(page.locator('[data-budget-amount="cost"]')).toHaveText(formatMoney(ledger.total!,plan.currency));
    await page.reload();await expect(page.locator('[data-budget-amount="cost"]')).toHaveText(formatMoney(ledger.total!,plan.currency));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`${mode}-budget.png`),fullPage:true});
  });
}
test('legacy ambiguous prices retain activities and request budget clarification',async({page,context})=>{
  const plan=partyPlan('family',4);delete plan.days[0].activities[0].priceEvidence;
  const dialog=await setup(page,context,plan);
  await expect(dialog.getByRole('heading',{name:plan.days[0].activities[0].title,exact:true}).first()).toBeVisible();
  await expect(dialog.locator('[data-expense-estimate]').first()).toContainText('Cost basis unavailable');
  await expect(dialog.getByRole('region',{name:'Travel party cost breakdown'})).toContainText('Budget refresh or clarification needed');
  await expect(dialog.getByText('Estimated traveler breakdown',{exact:true})).toHaveCount(0);
});
test('changing family/friends count preserves recorded costs and requests a refreshed plan',async({page,context})=>{
  const plan=partyPlan('family',4),total=expenseLedger(plan).total!,dialog=await setup(page,context,plan);
  await dialog.getByRole('button',{name:'Review budget',exact:true}).click();
  await page.getByRole('button',{name:'Edit trip budget',exact:true}).click();
  await page.locator('#trip-party-type').selectOption('friends');
  await expect(page.locator('#trip-travelers')).toHaveValue('4');
  await page.locator('#trip-travelers').fill('5');
  await page.getByRole('navigation',{name:'Traveler workspace'}).getByRole('button',{name:'Budget review',exact:true}).click();
  const party=page.getByRole('region',{name:'Travel party cost breakdown'});
  await expect(party).toContainText('Family · 4 travelers');
  await expect(party).toContainText('Traveling mode or traveler count has changed');
  await expect(page.locator('[data-budget-amount="cost"]')).toHaveText(formatMoney(total,plan.currency));
  await expect(party.getByText('Estimated traveler breakdown',{exact:true})).toHaveCount(0);
});
test('real Kyoto saved record shows its recorded Solo allowance without changing totals',async({page,context},info)=>{
  const path='.cache/party-budget-trip.json';test.skip(!existsSync(path),'Optional local read-only database verification record is unavailable.');
  const plan=JSON.parse(readFileSync(path,'utf8')) as ItineraryResponse;
  const before=JSON.stringify(plan),dialog=await setup(page,context,plan);
  await expect(dialog.locator('[data-expense-estimate]').first()).toContainText('1 traveler');
  await expect(dialog.locator('[data-expense-estimate]').first()).not.toContainText('/ group');
  await expect(dialog.getByRole('region',{name:'Travel party cost breakdown'})).toContainText(formatMoney(expenseLedger(plan).total!,plan.currency));
  expect(JSON.stringify(plan)).toBe(before);
  await dialog.screenshot({path:info.outputPath('real-kyoto-party-budget.png')});
});
