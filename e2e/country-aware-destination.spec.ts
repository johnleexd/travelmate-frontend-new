import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { searchGlobalLocationsPage } from '../../travelmate-backend-api/src/services/destination/global-location-search.ts';
import { searchDestinationAreas, selectedAreaParent } from '../../travelmate-backend-api/src/services/destination/destination-areas.ts';
import { resolveDestinationContext } from '../../travelmate-backend-api/src/services/destination/destination-context-service.ts';
import { validateDestinationAnchor } from '../../travelmate-backend-api/src/services/itinerary/grounded-places.ts';
import { globalCatalogueAvailable, catalogueLocation, catalogueCountry, searchCatalogueCountries } from '../../travelmate-backend-api/src/services/destination/global-catalogue.ts';
const offline:typeof fetch=async()=>{throw Error('This test uses actual imported location records, without private accounts or external hotel/photo providers.');};
async function setup(page:Page,context:BrowserContext) {
  expect(globalCatalogueAvailable(),'Provision the actual imported global catalogue before source-backed browser verification.').toBeTruthy();
  await context.addCookies([{name:'travelmate_session',value:'worldwide-browser-fixture',domain:'localhost',path:'/'}]);
  await page.route('**/_next/image?**',r=>new URL(r.request().url()).searchParams.get('url')?.startsWith('http')?r.fulfill({status:404}):r.continue());
  const user={id:'worldwide-browser-fixture',name:'World Test Traveler',email:'world@example.test',role:'traveler',accountStatus:'active',emailVerified:true};
  const hotels:URLSearchParams[]=[],generations:Record<string,unknown>[]=[];
  await page.route('**/api/platform**',r=>r.fulfill({json:{user,trips:[],notifications:[],listings:[],bookings:[],itineraryVersions:[],itineraryGenerations:[],directory:[],moderation:[],audit:[]}}));
  await page.route('**/api/locations?**',async r=>{const p=new URL(r.request().url()).searchParams;await r.fulfill({json:p.get('kind')==='countries'?searchCatalogueCountries(p.get('q')||'',Number(p.get('offset')||0)):await searchGlobalLocationsPage(p.get('q')||'',Number(p.get('offset')||0),offline,p.get('countryCode')||undefined)});});
  await page.route('**/api/locations/areas?**',async r=>{const p=new URL(r.request().url()).searchParams;await r.fulfill({json:await searchDestinationAreas(selectedAreaParent(Number(p.get('parentId')),p.get('countryCode')||''),p.get('query')||'',Number(p.get('offset')||0),offline,p.get('hierarchy')==='true')});});
  await page.route('**/api/destination-context?**',r=>{const p=new URL(r.request().url()).searchParams;return r.fulfill({json:resolveDestinationContext(p.get('countryCode')||'',p.get('city')||'')});});
  await page.route('**/api/destination-context/exchange-rate?**',r=>r.fulfill({status:503,json:{error:'Isolated test.'}}));
  await page.route('**/api/accommodations?**',r=>{hotels.push(new URL(r.request().url()).searchParams);return r.fulfill({json:{configured:false,accommodations:[],nearbyAccommodations:[],providerAccommodations:[],status:'no-results',message:'No hotels in this isolated fixture.'}});});
  await page.route('**/api/itinerary',async r=>{const body=r.request().postDataJSON();generations.push(await validateDestinationAnchor(body.destination,body.destinationDetails,body.latitude,body.longitude,offline));await r.fulfill({status:503,json:{error:'Production location validation passed; fixture stops before AI generation and database writes.'}});});
  return { hotels,generations };
}

async function checkSelection(page:Page,place:NonNullable<ReturnType<typeof catalogueLocation>>, evidence:Awaited<ReturnType<typeof setup>>) {
  await expect(page.locator('#destination-status')).toContainText(place.contextLabel);
  await expect(page.locator('[data-destination-open]')).toHaveAttribute('data-destination-open','false');
  await expect(page.locator('#destination-suggestions')).toHaveCount(0); await expect(page.locator('#destination-area-search')).toHaveCount(0);
  await expect(page.locator('#destination-search')).toBeVisible(); await expect(page.getByRole('dialog',{name:'Browse destinations by country'})).toHaveCount(0);
  await page.locator('#trip-budget').fill('30000');
  if (!resolveDestinationContext(place.countryCode,place.name).currency) await page.locator('#trip-currency').selectOption('USD');
  await expect.poll(()=>evidence.hotels.some(p=>p.get('locationProviderId')===place.providerId && p.get('latitude')===String(place.latitude) && p.get('longitude')===String(place.longitude))).toBeTruthy();
  await expect(page.getByRole('button',{name:'Generate my trip',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Generate my trip',exact:true}).click(); await expect.poll(()=>evidence.generations.length).toBe(1);
  expect(evidence.generations[0]).toMatchObject({providerId:place.providerId,countryCode:place.countryCode,latitude:place.latitude,longitude:place.longitude});
}

for(const [query,code] of [['Japan','JP'],['日本','JP'],['Philippines','PH'],['United States','US'],['USA','US']] as const)test(`exact ${query} returns only ${code} destinations and country SVG`,async({page,context})=>{
 const evidence=await setup(page,context);await page.goto('/dashboard?tab=planner');await page.locator('#destination-search').fill(query);
 const country=catalogueCountry(code)!;const data=await searchGlobalLocationsPage(query,0,offline);
 expect(data.countryScope?.countryCode).toBe(code);expect(data.locations.every(p=>p.countryCode===code)).toBeTruthy();expect(data.locations.some(p=>p.placeType!=='Country')).toBeTruthy();
 await expect(page.locator('[data-country-filter]')).toHaveAttribute('data-country-filter',code);await expect(page.locator('[data-country-filter]')).toContainText(`${country.name} only`);
 await expect(page.locator('#destination-suggestions [role=option]')).toHaveCount(data.locations.length);
 for(const place of data.locations)await expect(page.locator('#destination-suggestions')).toContainText(place.contextLabel);
 await expect(page.locator(`#destination-suggestions [data-country-flag=${code}]`)).toBeVisible();await expect(page.locator(`#destination-suggestions [data-country-flag=${code}]`)).toHaveAttribute('src',`/flags/${code.toLowerCase()}.svg`);await expect.poll(()=>page.locator(`#destination-suggestions [data-country-flag=${code}]`).evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Load more destinations',exact:true}).click();await expect(page.locator('#destination-suggestions [role=option]')).toHaveCount(40);
 if(code==='JP'&&query==='Japan'){
 await page.locator('#destination-search').evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:'../audit/2026-10-14/country-aware-destination/japan-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('#destination-search').evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:'../audit/2026-10-14/country-aware-destination/japan-mobile.png'});await page.setViewportSize({width:1280,height:720});
 await page.locator('#destination-search').fill('Tokyo');const place=catalogueLocation(1850147,'JP')!;await page.locator('#destination-suggestions').getByRole('button').filter({hasText:place.contextLabel}).click();await expect(page.locator('[data-destination-confirmed]')).toBeVisible();await checkSelection(page,place,evidence);
 }
});

test('country browsing retains scope after closing; cities remain direct choices and clearing restores global search',async({page,context})=>{
 const evidence=await setup(page,context);await page.goto('/dashboard?tab=planner');await page.locator('#destination-search').fill('Japan');await page.locator('#destination-suggestions').getByRole('button').filter({hasText:'Japan — Country'}).click();await expect(page.locator('#destination-area-search')).toBeVisible();await page.getByRole('button',{name:'Close destination browser'}).click();
 for(const query of ['Osaka','Kyoto','Chofu']){await page.locator('#destination-search').fill(query);const result=await searchGlobalLocationsPage(query,0,offline,'JP');await expect(page.locator('#destination-suggestions [role=option]')).toHaveCount(result.locations.length);expect(result.locations.every(p=>p.countryCode==='JP')).toBeTruthy();await expect(page.locator('[data-country-filter]')).toHaveAttribute('data-country-filter','JP');}
 const place=catalogueLocation(1864514,'JP')!;await page.locator('#destination-suggestions').getByRole('button').filter({hasText:place.contextLabel}).click();await checkSelection(page,place,evidence);
 await page.getByRole('button',{name:'Clear country filter'}).click();await expect(page.locator('[data-country-filter]')).toHaveCount(0);await page.locator('#destination-search').fill('Cordova');await expect(page.locator('#destination-suggestions')).toContainText('Cordova, Cebu, Philippines — Municipality');
});

test('changing Japan to Philippines clears stale rows and rejects a delayed Japanese response',async({page,context})=>{
 await setup(page,context);await page.goto('/dashboard?tab=planner');let release:()=>void=()=>{};const held=new Promise<void>(r=>release=r);let started=false;
 await page.route('**/api/locations?**',async r=>{const p=new URL(r.request().url()).searchParams;if(p.get('q')!=='Japan')return r.fallback();started=true;await held;try{await r.fulfill({json:await searchGlobalLocationsPage('Japan',0,offline)});}catch{}});
 await page.locator('#destination-search').fill('Japan');await expect.poll(()=>started).toBeTruthy();await page.locator('#destination-search').fill('Philippines');await expect(page.locator('[data-country-filter]')).toHaveAttribute('data-country-filter','PH');release();await page.waitForTimeout(400);await expect(page.locator('#destination-suggestions')).not.toContainText('Japan');
 await page.locator('#destination-search').fill('Cordova');await expect(page.locator('#destination-suggestions')).toContainText('Cordova, Cebu, Philippines — Municipality');await expect(page.locator('#destination-suggestions')).not.toContainText('United States');
 await page.locator('#destination-search').fill('Japan');await expect(page.locator('[data-country-filter]')).toHaveAttribute('data-country-filter','JP');await expect(page.locator('#destination-suggestions')).not.toContainText('Philippines');
});

test('mobile icons fit and a missing flag falls back to a globe with country name',async({page,context})=>{
 await setup(page,context);await page.setViewportSize({width:390,height:844});await page.route('**/flags/jp.svg',r=>r.fulfill({status:404}));await page.goto('/dashboard?tab=planner');await page.locator('#destination-search').fill('Japan');await expect(page.locator('[data-country-filter] [data-country-globe=JP]')).toBeVisible();await expect(page.locator('[data-country-filter]')).toContainText('Japan only');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);expect(await page.locator('#destination-search').evaluate(e=>parseFloat(getComputedStyle(e).paddingLeft))).toBeGreaterThanOrEqual(36);
 await page.locator('#destination-search').evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:'../audit/2026-10-14/country-aware-destination/mobile-icons.png'});
 await page.locator('#destination-search').fill('Philippines');await expect(page.locator('[data-country-filter] [data-country-flag=PH]')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#destination-suggestions')).toHaveCount(0);await expect(page.locator('[data-country-filter]')).toContainText('Philippines only');
});
