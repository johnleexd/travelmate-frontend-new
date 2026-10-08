import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { searchDestinationIndex } from '../../travelmate-backend-api/src/services/destination/destination-index.ts';
import type { LocationSuggestion, AccommodationSearchResponse, DestinationContext, NearbyAccommodation } from '../lib/contracts';
import { destinationAreas } from '../../travelmate-backend-api/src/services/destination/location-resolution.ts';
import { resolveDestinationContext } from '../../travelmate-backend-api/src/services/destination/destination-context-service.ts';
import { searchDestinationAreas, selectedAreaParent } from '../../travelmate-backend-api/src/services/destination/destination-areas.ts';

// Real public-provider responses captured by check-manual-destinations.mjs.
// API playback isolates authentication/database writes and public API capacity.
type EvidenceRow = { query: string; resolution: { location: LocationSuggestion; candidates: LocationSuggestion[]; areas: LocationSuggestion[]; message: string }; context: DestinationContext; stays: AccommodationSearchResponse & { nearbyAccommodations: NearbyAccommodation[] } };
const evidence: { results: EvidenceRow[] } = JSON.parse(readFileSync(new URL('./fixtures/manual-destinations.json', import.meta.url),'utf8'));
const cases = evidence.results;
const queryRow = (query: string) => cases.find(row => row.query.toLowerCase() === query.toLowerCase() || row.resolution?.location?.label.toLowerCase() === query.toLowerCase() || row.resolution?.location?.name.toLowerCase() === query.toLowerCase())!;
async function setup(page: Page, context: BrowserContext) {
  await context.addCookies([{name:'travelmate_session',value:'browser-test',domain:'localhost',path:'/'}]);
  await page.emulateMedia({reducedMotion:'reduce'});
  const user={id:'traveler',name:'Manual Destination Test',email:'manual@example.test',role:'traveler',accountStatus:'active',emailVerified:true};
  await page.route('**/api/platform**',route=>route.fulfill({json:{user,directory:[user],trips:[],listings:[],bookings:[],moderation:[],audit:[],itineraryGenerations:[],itineraryVersions:[],notifications:[],reviews:[],promotions:[],blockedDates:[],transactions:[],ownerDocuments:[],metrics:{},integrations:{}}}));
  await page.route('**/api/locations?**',route=>{
    const query=new URL(route.request().url()).searchParams.get('q') || '';
    const row=queryRow(query);
    return route.fulfill({json:{locations:row ? [row.resolution.location] : searchDestinationIndex(query)}});
  });
  await page.route('**/api/locations/resolve?**',async route=>{
    await new Promise(resolve=>setTimeout(resolve,300));
    const query=new URL(route.request().url()).searchParams.get('q') || '';
    const row=queryRow(query);
    const place=searchDestinationIndex(query)[0];
    return route.fulfill({json:row?.resolution || {location:place || null,candidates:place?[place]:[],areas:place?destinationAreas(place):[],message:place?'':'No validated location found.'}});
  });
  await page.route('**/api/destination-context?**',route=>{const url=new URL(route.request().url());return route.fulfill({json:resolveDestinationContext(url.searchParams.get('countryCode') || '',url.searchParams.get('city') || '')});});
  await page.route('**/api/destination-context/exchange-rate**',route=>route.fulfill({status:503,json:{error:'Exchange rates isolated.'}}));
  await page.route('**/api/locations/areas?**',async route=>{const params=new URL(route.request().url()).searchParams; const parent=selectedAreaParent(Number(params.get('parentId')),params.get('countryCode')!); return route.fulfill({json:await searchDestinationAreas(parent,params.get('query') || '',Number(params.get('offset') || 0))});});
  const requests: URL[]=[];
  await page.route('**/api/accommodations?**',route=>{
    const url=new URL(route.request().url()); requests.push(url);
    const row=queryRow(url.searchParams.get('destination') || '');
    if(!row) return route.fulfill({status:502,json:{error:'No provider evidence for this test destination.'}});
    return route.fulfill({json:row.stays});
  });
  await page.goto('/dashboard'); await page.getByRole('button',{name:'Plan a trip',exact:true}).click();
  return requests;
}

for(const query of ['Cordova, Cebu Philippines','Cebu City, Philippines','Baguio, Philippines','Kyoto, Japan','Paris, France','Barcelona, Spain']) {
  test(`${query}: manual and suggestion paths show the same real mapped stays and currency`,async ({page,context})=>{
    const row=queryRow(query); expect(row?.stays?.status,JSON.stringify(row?.stays?.message)).toBe('ready');
    expect(row.stays.nearbyAccommodations.length).toBeGreaterThan(0);
    const requests=await setup(page,context);
    const input=page.getByRole('combobox',{name:'Destination',exact:true}); const picker=page.getByLabel('Accommodation',{exact:true});
    const ids: string[][]=[];
    for(const path of ['manual','suggestion']) {
      await input.fill(''); await input.fill(query);
      await expect(page.locator('#destination-suggestions').getByRole('option').first()).toContainText(row.resolution.location.name);
      const before=requests.length;
      if(path==='manual') {
        await page.getByRole('button',{name:/^Use .* manually$/}).click();
        await expect(page.locator('#destination-status')).not.toContainText('Confirmed:');
        expect(requests.length).toBe(before);
      } else await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
      await expect(page.locator('#destination-status')).toHaveText(`Confirmed: ${row.resolution.location.label}`);
      await expect(page.getByRole('combobox',{name:/^Destination currency/})).toHaveValue(row.context.currency!);
      await expect(picker.locator('option[value^="mapped:"]')).toHaveCount(row.stays.nearbyAccommodations.length);
      const request=requests.at(-1)!; expect(request.searchParams.get('countryCode')).toBe(row.resolution.location.countryCode);
      expect(Number(request.searchParams.get('latitude'))).toBe(row.resolution.location.latitude);
      expect(Number(request.searchParams.get('longitude'))).toBe(row.resolution.location.longitude);
      expect(request.searchParams.get('currency')).toBe(row.context.currency);
      ids.push(await picker.locator('option[value^="mapped:"]').evaluateAll(options=>options.map(option=>(option as HTMLOptionElement).value)));
      await expect(picker.locator('option[value^="mapped:"]').first()).toContainText(row.stays.nearbyAccommodations[0].name);
      await expect(picker.locator('option[value^="mapped:"]').first()).not.toContainText('/night');
    }
    expect(ids[0]).toEqual(ids[1]);
    await page.setViewportSize({width:390,height:844}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(query.startsWith('Cordova')) await page.screenshot({path:'test-results/manual-cordova-stays.png',fullPage:true});
  });
}

test('country and region choices offer area narrowing instead of searching a national centroid',async ({page,context})=>{
  const requests=await setup(page,context); const input=page.getByRole('combobox',{name:'Destination',exact:true});
  for(const query of ['Japan','Central Visayas']) {
    await input.fill(''); await input.fill(query); await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
    await expect(page.getByLabel('Accommodation',{exact:true})).toBeDisabled();
    await expect(page.getByLabel('City or town within selected destination',{exact:true})).toBeVisible();
    await expect(page.getByRole('listbox',{name:'Suggested cities in this area',exact:true})).toBeVisible();
    expect(requests.length).toBe(0);
  }
  await page.getByRole('listbox',{name:'Suggested cities in this area',exact:true}).getByRole('button',{name:'Choose Cebu City',exact:true}).click();
  await expect(page.getByLabel('Accommodation',{exact:true}).locator('option[value^="mapped:"]')).toHaveCount(queryRow('Cebu City, Philippines').stays.nearbyAccommodations.length);
});

test('old map responses cannot replace a new destination; empty, error and failed-resolution states differ',async ({page,context})=>{
  await setup(page,context); const input=page.getByRole('combobox',{name:'Destination',exact:true}); const picker=page.getByLabel('Accommodation',{exact:true});
  let release: (()=>void)|undefined; let slowStarted=false;
  await page.route('**/api/accommodations?**',async route=>{
    const destination=new URL(route.request().url()).searchParams.get('destination') || '';
    if(destination.startsWith('Cordova')) { slowStarted=true; await new Promise<void>(resolve=>{release=resolve;}); }
    await route.fulfill({json:queryRow(destination).stays}).catch(()=>{});
  });
  await input.fill('Cordova, Cebu Philippines'); await page.getByRole('button',{name:/^Use .* manually$/}).click();
  await expect.poll(()=>slowStarted).toBe(true); await expect(page.getByText('Loading relevant accommodation...')).toBeVisible();
  await input.fill('Kyoto, Japan'); await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await expect(picker.locator('option[value^="mapped:"]')).toHaveCount(queryRow('Kyoto, Japan').stays.nearbyAccommodations.length);
  release?.(); await page.waitForTimeout(500);
  await expect(page.locator('#destination-status')).toContainText('Confirmed: Kyoto');
  await expect(picker.locator('option[value^="mapped:"]').first()).toContainText(queryRow('Kyoto, Japan').stays.nearbyAccommodations[0].name);
  await page.route('**/api/accommodations?**',route=>route.fulfill({json:{configured:false,accommodations:[],nearbyAccommodations:[],status:'no-results',message:'No mapped stays were found within 30 km of this location.'}}));
  await page.getByRole('button',{name:'Refresh stays',exact:true}).click();
  await expect(page.locator('[data-stay-state="no-results"]')).toBeVisible(); await expect(picker.locator('option[value^="mapped:"]')).toHaveCount(0);
  await page.route('**/api/accommodations?**',route=>route.fulfill({json:{configured:false,accommodations:[],nearbyAccommodations:[],status:'provider-error',message:'Accommodation provider error. Retry the search.'}}));
  await page.getByRole('button',{name:'Refresh stays',exact:true}).click(); await expect(page.locator('[data-stay-state="provider-error"]')).toBeVisible();
  await page.route('**/api/locations/resolve?**',route=>route.fulfill({status:502,json:{error:'Location resolution provider unavailable.'}}));
  await input.fill('Unknown hamlet, France'); await expect(page.getByRole('button',{name:/^Use .* manually$/})).toBeVisible(); await page.getByRole('button',{name:/^Use .* manually$/}).click();
  await expect(page.locator('#destination-status')).toContainText('provider unavailable'); await expect(page.locator('#destination-status')).not.toContainText('Confirmed:'); await expect(picker).toBeDisabled();
});
