import { expect, test } from '@playwright/test';
import { searchDestinationIndex } from '../../travelmate-backend-api/src/services/destination/destination-index.ts';
import { searchDestinationAreas } from '../../travelmate-backend-api/src/services/destination/destination-areas.ts';
import { resolveDestinationContext } from '../../travelmate-backend-api/src/services/destination/destination-context-service.ts';
import { readFileSync } from 'node:fs';
import type { DestinationAreasResponse, LocationSuggestion } from '../lib/contracts';

test('missing island boundary has no 502, unsupported currency stays editable and planner fields have IDs/names', async ({ page, context }) => {
  const island = searchDestinationIndex('Kono-som')[0];
  const empty = await searchDestinationAreas(island,'',0,async () => Response.json([]));
  await context.addCookies([{ name:'travelmate_session', value:'coverage-fixture', domain:'localhost', path:'/' }]);
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.route('**/api/platform**', route => route.fulfill({ json:{ user:{id:'coverage-test',name:'Coverage tester',email:'coverage@example.test',role:'traveler',accountStatus:'active',emailVerified:true},trips:[],directory:[],notifications:[],listings:[],bookings:[],moderation:[],audit:[],itineraryVersions:[],itineraryGenerations:[] } }));
  await page.route('**/api/locations?**', route => route.fulfill({ json:{locations:searchDestinationIndex(new URL(route.request().url()).searchParams.get('q') || '')} }));
  await page.route('**/api/destination-context?**', route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json:resolveDestinationContext(params.get('countryCode') || '',params.get('city') || '') });
  });
  const statuses:number[] = [];
  page.on('response', response => { if (response.url().includes('/api/locations/areas?')) statuses.push(response.status()); });
  await page.route('**/api/locations/areas?**', route => route.fulfill({ json:empty }));
  await page.route('**/api/accommodations?**', route => route.fulfill({ json:{configured:false,accommodations:[],nearbyAccommodations:[],status:'no-results',message:'No provider results in this isolated test.'} }));
  await page.route('**/api/destination-context/exchange-rate?**', route => route.fulfill({ status:503,json:{error:'Reference conversion unavailable in this isolated test.'} }));
  await page.goto('/dashboard'); await page.getByRole('button',{name:'Plan a trip',exact:true}).click();
  const destination = page.getByRole('combobox',{name:'Destination',exact:true});
  await destination.fill('Kono-som'); await page.locator('#destination-suggestions').getByRole('button').first().click();
  await expect(page.locator('#destination-area-status')).toContainText('No unique boundary');
  await expect(page.locator('#destination-area-status')).toContainText('Destination field');
  await expect(page.locator('[data-area-state]')).toHaveAttribute('data-area-state','empty');
  await expect(page.getByText('Local currency KPW is not supported for planning. Choose a supported planning currency.',{exact:true})).toBeVisible();
  const currency = page.locator('#trip-currency');
  await currency.selectOption('USD'); await expect(currency).toBeEnabled();
  await expect(page.getByText('USD (US dollar) selected for planning.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Refresh options',exact:true}).click();
  await expect(currency).toBeEnabled(); await expect(currency).toHaveValue('USD');
  await currency.selectOption('EUR'); await expect(currency).toHaveValue('EUR');
  expect(statuses).toEqual([200]);
  const unnamed = await page.locator('input,select,textarea').evaluateAll(elements => elements.filter(element => !element.id && !element.getAttribute('name')).map(element => element.outerHTML));
  expect(unnamed).toEqual([]);
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`../audit/2026-10-11/destination-coverage/planner-${width}.png`,fullPage:true});
  }
  await destination.fill('Tokyo, Japan'); await page.locator('#destination-suggestions').getByRole('button').first().click();
  await expect(currency).toHaveValue('JPY'); await expect(currency).toBeDisabled();
  await expect(page.locator('[data-area-state]')).toHaveCount(0);
});

test('Usedom captured fallback towns render without API errors; selecting a town keeps the planner working',async ({page,context})=>{
  // Public provider capture from the shared service with the primary failure
  // simulated and the real lz4 instance used. No account or trip data is recorded.
  const evidence:{parent:LocationSuggestion;result:DestinationAreasResponse} = JSON.parse(readFileSync(new URL('./fixtures/usedom-areas.json',import.meta.url),'utf8'));
  const failures:string[] = [], stays:URL[] = [];
  page.on('response',response=>{ if(response.url().includes('/api/') && response.status() >= 400) failures.push(response.url()); });
  await context.addCookies([{name:'travelmate_session',value:'coverage-test',domain:'localhost',path:'/'}]);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/api/platform**',route=>route.fulfill({json:{user:{id:'coverage-test',name:'Coverage tester',email:'coverage@example.test',role:'traveler',accountStatus:'active',emailVerified:true},trips:[],directory:[],notifications:[],listings:[],bookings:[],moderation:[],audit:[],itineraryVersions:[],itineraryGenerations:[]}}));
  await page.route('**/api/locations?**',route=>route.fulfill({json:{locations:searchDestinationIndex(new URL(route.request().url()).searchParams.get('q') || '')}}));
  await page.route('**/api/destination-context?**',route=>{ const params = new URL(route.request().url()).searchParams; return route.fulfill({json:resolveDestinationContext(params.get('countryCode') || '',params.get('city') || '')}); });
  await page.route('**/api/locations/areas?**',route=>route.fulfill({json:{...evidence.result,expiresAt:new Date(Date.now()+86_400_000).toISOString()}}));
  await page.route('**/api/destination-context/exchange-rate?**',route=>{
    const params = new URL(route.request().url()).searchParams, fetchedAt = new Date().toISOString(), expiresAt = new Date(Date.now()+21_600_000).toISOString();
    return route.fulfill({json:{base:params.get('base'),quote:params.get('quote'),rate:1,asOf:fetchedAt.slice(0,10),fetchedAt,refreshAfter:expiresAt,source:'frankfurter',sourceUrl:'https://frankfurter.dev/',disclaimer:'Isolated browser test rate, not live pricing.',freshness:{source:'exchange-rates',status:'live',isStale:false,fetchedAt,expiresAt,staleUntil:expiresAt,policy:'Fixture'}}});
  });
  await page.route('**/api/accommodations?**',route=>{
    stays.push(new URL(route.request().url()));
    return route.fulfill({json:{configured:false,accommodations:[],nearbyAccommodations:[],status:'no-results',message:'No mapped stays in this isolated fixture.'}});
  });
  await page.goto('/dashboard'); await page.getByRole('button',{name:'Plan a trip',exact:true}).click();
  await page.getByRole('combobox',{name:'Destination',exact:true}).fill(evidence.parent.name);
  await page.locator('#destination-suggestions').getByRole('button').first().click();
  const choices = page.getByRole('listbox',{name:'Suggested cities in this area',exact:true});
  await expect(choices.getByRole('option')).toHaveCount(evidence.result.areas.length);
  await expect(page.locator('[data-area-state]')).toHaveAttribute('data-area-state','ready');
  await expect(page.locator('#trip-currency')).toHaveValue('EUR');
  expect(stays).toHaveLength(0);
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await choices.scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`../audit/2026-10-11/api-recovery/usedom-${width}.png`});
  }
  const town = evidence.result.areas[0];
  await choices.getByRole('button',{name:`Choose ${town.name}`,exact:true}).click();
  await expect(page.locator('#destination-status')).toHaveText(`Confirmed: ${town.label}`);
  await expect.poll(()=>stays.length).toBe(1);
  expect(stays[0].searchParams.get('countryCode')).toBe(town.countryCode);
  expect(Number(stays[0].searchParams.get('latitude'))).toBe(town.latitude);
  const unnamed = await page.locator('input,select,textarea').evaluateAll(elements=>elements.filter(element=>!element.id&&!element.getAttribute('name')).map(element=>element.outerHTML));
  expect(unnamed).toEqual([]); expect(failures).toEqual([]);
});
