import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { searchDestinationIndex } from '../../travelmate-backend-api/src/services/destination/destination-index.ts';
import { resolveDestinationContext } from '../../travelmate-backend-api/src/services/destination/destination-context-service.ts';
import type { DestinationAreasResponse, LocationSuggestion, AreaComparisonResponse, AccommodationSearchResponse, NearbyAccommodation } from '../lib/contracts';

type Evidence = { query: string; parent: LocationSuggestion; pages: DestinationAreasResponse[]; comparison?: AreaComparisonResponse | { error: string } };
const evidence: { results: Evidence[] } = JSON.parse(readFileSync(new URL('./fixtures/destination-areas.json',import.meta.url),'utf8'));
const staysEvidence: Array<{resolution: {location: LocationSuggestion}; stays: AccommodationSearchResponse & {nearbyAccommodations: NearbyAccommodation[]}}> = JSON.parse(readFileSync(new URL('./fixtures/manual-destinations.json',import.meta.url),'utf8')).results;
const rowFor = (id: number) => evidence.results.find(row => row.parent?.id === id)!;

async function setup(page: Page, context: BrowserContext) {
  await context.addCookies([{name:'travelmate_session',value:'area-test',domain:'localhost',path:'/'}]); await page.emulateMedia({reducedMotion:'reduce'});
  const user = {id:'area-test',name:'Area Test',email:'areas@example.test',role:'traveler',accountStatus:'active',emailVerified:true};
  await page.route('**/api/platform**',route => route.fulfill({json:{user,directory:[user],trips:[],listings:[],bookings:[],moderation:[],audit:[],itineraryGenerations:[],itineraryVersions:[],notifications:[],reviews:[],promotions:[],blockedDates:[],transactions:[],ownerDocuments:[],metrics:{},integrations:{}}}));
  await page.route('**/api/locations?**',route => route.fulfill({json:{locations:searchDestinationIndex(new URL(route.request().url()).searchParams.get('q') || '')}}));
  await page.route('**/api/destination-context?**',route => {const params = new URL(route.request().url()).searchParams;return route.fulfill({json:resolveDestinationContext(params.get('countryCode') || '',params.get('city') || '')});});
  await page.route('**/api/destination-context/exchange-rate?**',route => {const params = new URL(route.request().url()).searchParams;const now = Date.now(),expiresAt = new Date(now+6*60*60_000).toISOString();return route.fulfill({json:{base:params.get('base'),quote:params.get('quote'),rate:0.4,asOf:'2026-10-06',fetchedAt:new Date(now).toISOString(),refreshAfter:expiresAt,source:'frankfurter',sourceUrl:'https://frankfurter.dev/',disclaimer:'Fixture reference.',freshness:{source:'exchange-rates',status:'live',isStale:false,fetchedAt:new Date(now).toISOString(),expiresAt,staleUntil:expiresAt,policy:'Fixture'}}});});
  const areaRequests: URL[] = [], comparisons: URL[] = [], stays: URL[] = [];
  await page.route('**/api/locations/areas?**',async route => {
    const url = new URL(route.request().url()); areaRequests.push(url); const row = rowFor(Number(url.searchParams.get('parentId')));
    if (!row) return route.fulfill({status:502,json:{error:'Geographic fixture not available.'}});
    const query = url.searchParams.get('query')?.toLowerCase() || ''; const offset = Number(url.searchParams.get('offset'));
    const all = row.pages.flatMap(page => page.areas); const filtered = all.filter(city => city.name.toLowerCase().includes(query));
    const payload = query ? {...row.pages[0],areas:filtered.slice(offset,offset+20),total:filtered.length,nextOffset:null,status:filtered.length?'ready':'empty',message:filtered.length?'Choose a city to search accommodation.':'No verified cities or towns were found in this area.'} : row.pages[offset / 20];
    await route.fulfill({json:payload});
  });
  await page.route('**/api/locations/areas/compare?**',route => {
    const url = new URL(route.request().url()); comparisons.push(url); const row = rowFor(Number(url.searchParams.get('parentId')));
    if (row.comparison && 'profiles' in row.comparison) return route.fulfill({json:row.comparison});
    // Deterministic mapped-response fixture exercises ranking even when the
    // public map service lacks capacity. It is not live geographic evidence.
    const ids = url.searchParams.get('cityIds')!.split(',').map(Number);
    return route.fulfill({json:{parentId:row.parent.id,countryCode:row.parent.countryCode,profiles:ids.map((cityId,index)=>({cityId,foodPlaces:index+1,culturePlaces:index+2,naturePlaces:index})),fetchedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+6*60*60_000).toISOString(),sourceUrl:'https://www.openstreetmap.org/copyright',radiusKm:1,disclaimer:'Mapped sample, not complete inventories. Prices and affordability are not confirmed.'}});
  });
  await page.route('**/api/accommodations?**',route => {
    const url = new URL(route.request().url()); stays.push(url); const city = url.searchParams.get('destination')!.split(',')[0];
    const row = staysEvidence.find(row => row.resolution?.location?.name === city);
    return route.fulfill({json:row?.stays || {configured:false,accommodations:[],nearbyAccommodations:[],status:'no-results',message:'No mapped stays in this browser fixture.'}});
  });
  await page.goto('/dashboard'); await page.getByRole('button',{name:'Plan a trip',exact:true}).click();
  return {areaRequests,comparisons,stays};
}
async function selectArea(page: Page, row: Evidence) {
  await page.getByRole('combobox',{name:'Destination',exact:true}).fill(row.query);
  const options = page.locator('#destination-suggestions').getByRole('option');
  await options.filter({hasText:row.parent.contextLabel}).first().getByRole('button').click();
  await expect(page.locator('#destination-status')).toHaveText(`Confirmed: ${row.parent.label}`);
}
for (const query of ['Honshū Island, Japan','Bali, Indonesia','France','Philippines','Scotland, United Kingdom','Central Visayas, Philippines','Île-de-France, France']) {
  test(`${query}: verified suggestions appear without typing and selecting a city loads its accommodations`,async ({page,context}) => {
    const row = evidence.results.find(row => row.query === query)!; expect(row.pages[0].status).toBe('ready');
    const requests = await setup(page,context); await selectArea(page,row);
    await expect(page.getByRole('combobox',{name:'City or town within selected destination',exact:true})).toHaveValue('');
    const list = page.getByRole('listbox',{name:'Suggested cities in this area',exact:true});
    await expect(list.getByRole('option')).toHaveCount(row.pages[0].areas.length);
    await expect(list.getByRole('option').first()).toContainText(row.pages[0].areas[0].description);
    expect(requests.stays).toHaveLength(0); expect(requests.areaRequests).toHaveLength(1);
    const city = row.pages[0].areas[0];
    await list.getByRole('button',{name:`Choose ${city.name}`,exact:true}).click();
    await expect.poll(()=>requests.stays.length).toBe(1);
    const request = requests.stays[0]; expect(request.searchParams.get('countryCode')).toBe(city.countryCode);
    expect(Number(request.searchParams.get('latitude'))).toBe(city.latitude); expect(Number(request.searchParams.get('longitude'))).toBe(city.longitude);
    await expect(page.locator('#destination-status')).toHaveText(`Confirmed: ${city.label}`);
    if(query === 'Central Visayas, Philippines') await expect(page.getByLabel('Accommodation',{exact:true}).locator('option[value^="mapped:"]')).toHaveCount(staysEvidence.find(row=>row.resolution?.location?.name==='Cebu City')!.stays.nearbyAccommodations.length);
  });
}
test('Honshū search, pagination, idle time and budget edits use cached results; Kyoto loads real captured mapped stays',async ({page,context}) => {
  const row = evidence.results[0]; const requests = await setup(page,context); await selectArea(page,row);
  const list = page.getByRole('listbox',{name:'Suggested cities in this area'}); await expect(list.getByRole('option')).toHaveCount(20);
  await page.waitForTimeout(2500); await page.getByRole('spinbutton',{name:/^Solo trip budget/}).fill('80000'); await page.waitForTimeout(1500); expect(requests.areaRequests).toHaveLength(1);
  await page.getByRole('button',{name:'Show more cities and towns',exact:true}).click(); await expect(list.getByRole('option')).toHaveCount(40);
  const search = page.getByRole('combobox',{name:'City or town within selected destination',exact:true}); await search.fill('Kyoto');
  await expect(list.getByRole('option')).toHaveCount(1); await expect(list).toContainText('Kyoto');
  await search.fill(''); await expect(list.getByRole('option')).toHaveCount(20); expect(requests.areaRequests).toHaveLength(3);
  await search.fill('Kyoto'); await expect(list.getByRole('option')).toHaveCount(1); expect(requests.areaRequests).toHaveLength(3);
  await search.press('ArrowDown'); await search.press('Enter'); await expect(page.locator('#destination-status')).toContainText('Confirmed: Kyoto');
  await expect(page.getByLabel('Accommodation',{exact:true}).locator('option[value^="mapped:"]')).toHaveCount(staysEvidence.find(row=>row.resolution?.location?.name==='Kyoto')!.stays.nearbyAccommodations.length);
});
test('Help me choose compares budget and mapped interests without choosing a city or looping',async ({page,context}) => {
  const requests = await setup(page,context); await selectArea(page,evidence.results[0]);
  await page.getByRole('spinbutton',{name:/^Solo trip budget/}).fill('80000');
  await page.getByRole('button',{name:'Help me choose',exact:true}).click();
  const section = page.getByRole('region',{name:'Compare suggested areas',exact:true});
  await expect(section.getByText(/Your budget allows JPY/)).toBeVisible(); await expect(section.getByText(/Mapped sample within 1 km:/).first()).toBeVisible();
  await expect(section).toContainText('no city is selected automatically'); await expect(page.locator('#destination-status')).toContainText('Confirmed: Honshū Island'); expect(requests.stays).toHaveLength(0);
  await page.getByLabel('Interests',{exact:true}).fill('culture'); await page.getByRole('spinbutton',{name:/^Solo trip budget/}).fill('90000');
  await page.waitForTimeout(2500); expect(requests.areaRequests).toHaveLength(1); expect(requests.comparisons).toHaveLength(1); expect(requests.stays).toHaveLength(0);
  await page.getByRole('button',{name:'Close comparison',exact:true}).click(); await page.getByRole('button',{name:'Help me choose',exact:true}).click();
  await expect(section.getByText(/Mapped sample within/).first()).toBeVisible(); expect(requests.comparisons).toHaveLength(1);
  await page.setViewportSize({width:390,height:844}); expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'../audit/2026-10-06/destination-area-comparison-mobile.png',fullPage:true});
});
test('loading, empty and provider errors are distinct; stale responses cannot replace another area',async ({page,context}) => {
  await setup(page,context); let release!:()=>void, started = false;
  await page.route('**/api/locations/areas?**',async route => {
    const id = Number(new URL(route.request().url()).searchParams.get('parentId'));
    if(id === evidence.results[0].parent.id) { started=true; await new Promise<void>(resolve=>{release=resolve;}); }
    await route.fulfill({json:rowFor(id).pages[0]}).catch(()=>{});
  });
  await selectArea(page,evidence.results[0]); await expect.poll(()=>started).toBe(true); await expect(page.locator('[data-area-state="loading"]')).toBeVisible();
  await selectArea(page,evidence.results.find(row=>row.query==='France')!); await expect(page.getByRole('listbox',{name:'Suggested cities in this area'})).toContainText('Paris');
  release(); await page.waitForTimeout(400); await expect(page.getByRole('listbox',{name:'Suggested cities in this area'})).not.toContainText('Tokyo');
  const region=evidence.results.find(row=>row.query==='Scotland, United Kingdom')!;
  await page.route('**/api/locations/areas?**',route=>route.fulfill({json:{...region.pages[0],areas:[],total:0,nextOffset:null,status:'empty',message:'No verified cities or towns were found in this area.'}}));
  await selectArea(page,region); await expect(page.locator('[data-area-state="empty"]')).toBeVisible(); await expect(page.getByText('No verified cities or towns were found in this area.')).toBeVisible();
  await page.route('**/api/locations/areas?**',route=>route.fulfill({status:502,json:{error:'Area boundary provider unavailable.'}}));
  await selectArea(page,evidence.results.find(row=>row.query==='Bali, Indonesia')!); await expect(page.locator('[data-area-state="error"]')).toBeVisible(); await expect(page.getByRole('button',{name:'Retry area suggestions',exact:true})).toBeVisible();
});
test('interest-provider errors leave geographic choices usable without invented affordability',async ({page,context}) => {
  const requests=await setup(page,context); await page.route('**/api/locations/areas/compare?**',route=>route.fulfill({status:502,json:{error:'Mapped interest information is temporarily unavailable.'}}));
  await selectArea(page,evidence.results[0]); await page.getByRole('button',{name:'Help me choose',exact:true}).click();
  const section=page.getByRole('region',{name:'Compare suggested areas'}); await expect(section.getByText('Mapped interest information is temporarily unavailable.')).toBeVisible();
  await expect(section).toContainText('Accommodation affordability is not confirmed'); expect(requests.stays).toHaveLength(0);
  await section.getByRole('button',{name:/Choose .* and find stays/}).first().click(); await expect.poll(()=>requests.stays.length).toBe(1);
});
