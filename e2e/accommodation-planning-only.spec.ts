import { buildGroundedPlan } from '../../travelmate-backend-api/src/services/itinerary/grounded-plan.ts';
import { plannedAccommodationSchema } from '../../travelmate-backend-api/src/services/destination/planned-accommodation.ts';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { searchGlobalLocationsPage } from '../../travelmate-backend-api/src/services/destination/global-location-search.ts';
import { searchDestinationAreas, selectedAreaParent } from '../../travelmate-backend-api/src/services/destination/destination-areas.ts';
import { resolveDestinationContext } from '../../travelmate-backend-api/src/services/destination/destination-context-service.ts';
import { validateDestinationAnchor } from '../../travelmate-backend-api/src/services/itinerary/grounded-places.ts';
import { globalCatalogueAvailable, catalogueLocation, searchCatalogueCountries } from '../../travelmate-backend-api/src/services/destination/global-catalogue.ts';
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
  await page.route('**/api/itinerary',async r=>{const body=r.request().postDataJSON();await validateDestinationAnchor(body.destination,body.destinationDetails,body.latitude,body.longitude,offline);generations.push(body);await r.fulfill({status:503,json:{error:'Production location validation passed; fixture stops before AI generation and database writes.'}});});
  return { hotels,generations };
}


async function chooseTokyo(page:Page) {
 await page.goto('/dashboard?tab=planner');await page.locator('#destination-search').fill('Tokyo');await page.locator('#destination-suggestions').getByRole('button').filter({hasText:catalogueLocation(1850147,'JP')!.contextLabel}).click();await page.locator('#trip-budget').fill('300000');
 await expect(page.getByRole('button',{name:'Generate my trip',exact:true})).toBeEnabled();
 await expect(page.getByText(/^Rooms and guests/)).toHaveCount(0);await expect(page.getByLabel('Guests nationality')).toHaveCount(0);await expect(page.getByText(/Enter the guests.*nationality/)).toHaveCount(0);
}

test('20 itinerary travelers can generate without selecting a hotel, rooms or nationality',async({page,context})=>{
 const evidence=await setup(page,context);await chooseTokyo(page);await page.locator('#trip-party-type').selectOption('friends');await page.locator('#trip-travelers').fill('20');
 await expect.poll(()=>evidence.hotels.some(p=>p.get('adults')==='20')).toBeTruthy();const request=evidence.hotels.find(p=>p.get('adults')==='20')!;
 expect(request.get('mode')).toBe('suggestions');expect(request.get('quotes')).toBe('false');expect(request.has('occupancy')).toBeFalsy();expect(request.has('guestNationality')).toBeFalsy();
 await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect.poll(()=>evidence.generations.length).toBe(1);
 expect(evidence.generations[0]).toMatchObject({travelers:20,partyType:'friends'});for(const field of ['rooms','occupancy','guestNationality','plannedAccommodation','selectedAccommodationQuote','externalAccommodation','accommodationListingId'])expect(evidence.generations[0][field]).toBeUndefined();
});

test('hotel photos, details and optional selection work while stale sandbox prices and quote tokens are ignored',async({page,context})=>{
 const evidence=await setup(page,context);let checks=0;
 await page.route('**/api/accommodations/revalidate',r=>{checks++;return r.fulfill({status:409,json:{error:'Quote validation should never run in this planning flow.'}});});
 await page.route('https://static.cupid.travel/planning-only-fixture/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#355d54"/><rect x="180" y="40" width="280" height="320" fill="#d7ba7c"/></svg>'}));
 await page.route('**/api/accommodations?**',r=>r.fulfill({json:{configured:true,status:'ready',accommodations:[],nearbyAccommodations:[],providerEnvironment:'sandbox',providerStatus:'ready',providerMessage:'Hotel suggestions only. Prices and availability are unconfirmed; hotel selection is optional.',providerAccommodations:[{id:'liteapi:lp123',propertyId:'lp123',name:'Tokyo Property Fixture',nameSource:'provider-english',address:'Tokyo, Japan',type:'Hotel',latitude:35.68,longitude:139.76,distanceKm:1,rating:4,amenities:['WiFi','Breakfast'],environment:'sandbox',availability:'available',photos:[{reference:'lp123:exterior',url:'https://static.cupid.travel/planning-only-fixture/exterior.svg',caption:'Exterior',attribution:{creator:'Fixture provider photograph',license:'Provider content terms',sourceUrl:'https://static.cupid.travel/planning-only-fixture/exterior.svg'}}],quoteToken:'stale-test-token',quote:{provider:'liteapi',propertyId:'lp123',currency:'JPY',roomType:'Test room',nightlyAverage:987654,total:1975308,isLive:false,occupancy:[],priceBreakdown:[],payableAtProperty:[],checkedAt:new Date().toISOString()}}]}}));
 await chooseTokyo(page);await page.getByRole('button',{name:'Browse accommodations',exact:true}).click();const modal=page.getByRole('dialog',{name:'Browse accommodations',exact:true});
 await expect(modal.getByRole('img',{name:'Tokyo Property Fixture accommodation'})).toBeVisible();await expect(modal.getByRole('link',{name:'Fixture provider photograph'})).toBeVisible();await expect(modal.getByText('Stays near Tokyo · Hotel selection is optional.',{exact:true})).toBeVisible();
 await expect(modal).not.toContainText(/987.?654|1.?975.?308|Total stay:|Checking room quote/);await expect(modal.getByLabel(/Minimum nightly price/)).toHaveCount(0);await expect(modal.getByText('Price and availability unconfirmed',{exact:true})).toBeVisible();
 await modal.getByRole('button',{name:'Select accommodation: Tokyo Property Fixture',exact:true}).click();const preference=page.getByRole('region',{name:'Accommodation preference'});await expect(preference.getByRole('img',{name:'Tokyo Property Fixture accommodation'})).toBeVisible();await preference.getByRole('button',{name:'Details',exact:true}).click();await expect(preference.getByRole('list',{name:'Selected hotel amenities'})).toContainText(/wifi/i);
 await page.setViewportSize({width:390,height:844});await preference.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'../audit/2026-10-14/accommodation-planning-only/mobile-selected-hotel.png'});await page.setViewportSize({width:1280,height:900});await preference.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:'../audit/2026-10-14/accommodation-planning-only/desktop-selected-hotel.png'});
 await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect.poll(()=>evidence.generations.length).toBe(1);expect(evidence.generations[0].plannedAccommodation).toMatchObject({name:'Tokyo Property Fixture',source:'provider',sourceId:'liteapi:lp123',latitude:35.68,longitude:139.76,rating:4,amenities:['WiFi','Breakfast']});expect(plannedAccommodationSchema.parse(evidence.generations[0].plannedAccommodation).photos?.[0].attribution.creator).toBe('Fixture provider photograph');expect(evidence.generations[0].selectedAccommodationQuote).toBeUndefined();expect(evidence.generations[0].externalAccommodation).toBeUndefined();expect(checks).toBe(0);
 await page.getByRole('button',{name:'Choose accommodation later'}).click();await page.getByRole('button',{name:'Retry generation',exact:true}).click();await expect.poll(()=>evidence.generations.length).toBe(2);expect(evidence.generations[1].plannedAccommodation).toBeUndefined();
});

test('failed accommodation search does not block itinerary generation',async({page,context})=>{
 const evidence=await setup(page,context);await page.route('**/api/accommodations?**',r=>r.fulfill({status:502,json:{error:'Suggestion provider is temporarily unavailable.'}}));await chooseTokyo(page);await expect(page.getByText('Could not load stays. Refresh or enter a hotel manually.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect.poll(()=>evidence.generations.length).toBe(1);expect(evidence.generations[0].plannedAccommodation).toBeUndefined();
});


test('unpriced hotel photo and details survive generation, fixture saving, reopening and refresh',async({page,context})=>{
 await setup(page,context);const user={id:'worldwide-browser-fixture',name:'World Test Traveler',email:'world@example.test',role:'traveler',accountStatus:'active',emailVerified:true};let saved:Record<string,unknown>|null=null;
 const workspace=()=>({user,trips:saved?[saved]:[],notifications:[],listings:[],bookings:[],itineraryVersions:[],itineraryGenerations:[],directory:[],moderation:[],audit:[]});
 await page.route('**/api/platform**',async r=>{
 const url=new URL(r.request().url());if(url.pathname.endsWith('/photos'))return r.fulfill({status:503,json:{error:'Photo recovery is isolated.'}});
 if(url.pathname==='/api/platform/trips/suggested-hotel-fixture')return r.fulfill({json:{trip:saved}});
 if(r.request().method()==='POST'){const body=r.request().postDataJSON();saved={...body,id:'suggested-hotel-fixture',userId:user.id,status:'active',createdAt:new Date().toISOString()};return r.fulfill({json:{result:saved}});}return r.fulfill({json:workspace()});
 });
 await page.route('**/api/weather**',r=>r.fulfill({status:503,json:{error:'Weather is isolated.'}}));
 const photo={reference:'lp999:exterior',url:'https://static.cupid.travel/planning-only-save-fixture/exterior.svg',caption:'Exterior',attribution:{creator:'Fixture hotel photographer',license:'Provider content terms',sourceUrl:'https://static.cupid.travel/planning-only-save-fixture/exterior.svg'}};
 await page.route('https://static.cupid.travel/planning-only-save-fixture/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#355d54"/></svg>'}));
 await page.route('**/api/accommodations?**',r=>r.fulfill({json:{configured:true,status:'ready',accommodations:[],nearbyAccommodations:[],providerAccommodations:[{id:'liteapi:lp999',propertyId:'lp999',name:'Saved hotel preference fixture',nameSource:'provider-english',address:'Tokyo, Japan',type:'Hotel',latitude:35.68,longitude:139.76,distanceKm:1,rating:4,amenities:['WiFi'],photos:[photo],environment:'sandbox',availability:'price-unavailable'}]}}));
 await page.route('**/api/itinerary',async r=>{
 const body=r.request().postDataJSON(),anchor=await validateDestinationAnchor(body.destination,body.destinationDetails,body.latitude,body.longitude,offline);
 const count=Math.round((Date.parse(body.endDate)-Date.parse(body.startDate))/86400000)+1;
 const plan=buildGroundedPlan({destination:body.destination,anchor,startingLocation:'',startDate:body.startDate,endDate:body.endDate,budget:body.budget,currency:body.currency,travelers:body.travelers,partyType:body.partyType,rooms:Math.ceil(body.travelers/2),places:[],placeDataStatus:'unavailable',schedule:Array.from({length:count},(_,i)=>({day:i+1,date:new Date(Date.parse(body.startDate)+i*86400000).toISOString().slice(0,10),theme:'Controlled fixture: no sightseeing resolved',visits:[],planningStatus:'incomplete' as const})),source:'catalog',transportation:'walking'});
 plan.plannedAccommodation=plannedAccommodationSchema.parse(body.plannedAccommodation);await r.fulfill({json:plan});
 });
 await chooseTokyo(page);await page.getByRole('button',{name:'Browse accommodations',exact:true}).click();await page.getByRole('button',{name:'Select accommodation: Saved hotel preference fixture',exact:true}).click();await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect.poll(()=>saved).not.toBeNull();
 expect((saved!.itinerary as {plannedAccommodation:unknown}).plannedAccommodation).toMatchObject({name:'Saved hotel preference fixture',photos:[photo],latitude:35.68,longitude:139.76});
 await expect(page.getByText(/Saved to your trips\./)).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saved trips',exact:true}).click();await page.getByRole('button',{name:'View itinerary',exact:true}).click();
 await expect(page.getByRole('img',{name:'Saved hotel preference fixture accommodation',exact:true})).toBeVisible();await page.getByText('View details',{exact:true}).click();await expect(page.getByRole('list',{name:'Planned hotel amenities'})).toContainText('wifi');await expect(page.getByRole('link',{name:'View on map',exact:true})).toHaveAttribute('href',/35.68.*139.76/);
 await expect(page.getByText('Price and availability unconfirmed.',{exact:true}).first()).toBeVisible();await page.reload();await expect(page.getByRole('img',{name:'Saved hotel preference fixture accommodation',exact:true})).toBeVisible();
 await page.getByRole('img',{name:'Saved hotel preference fixture accommodation',exact:true}).evaluate(e=>e.closest('section')?.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:'../audit/2026-10-14/accommodation-planning-only/reopened-hotel.png'});
});
