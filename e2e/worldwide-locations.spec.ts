import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { searchGlobalLocationsPage } from '../../travelmate-backend-api/src/services/destination/global-location-search.ts';
import { searchDestinationAreas, selectedAreaParent } from '../../travelmate-backend-api/src/services/destination/destination-areas.ts';
import { resolveDestinationContext } from '../../travelmate-backend-api/src/services/destination/destination-context-service.ts';
import { validateDestinationAnchor } from '../../travelmate-backend-api/src/services/itinerary/grounded-places.ts';
import { globalCatalogueAvailable, catalogueLocation, catalogueCountry, searchCatalogueCountries } from '../../travelmate-backend-api/src/services/destination/global-catalogue.ts';
import { administrativeCandidate, administrativeRecord } from '../../travelmate-backend-api/src/services/destination/philippine-catalogue.ts';
const offline:typeof fetch=async()=>{throw Error('This test uses actual imported location records, without private accounts or external hotel/photo providers.');};
const cases=[['Cordova','0702220000','PH'],['小布施町, 日本','7417105','JP'],['Hadong-eup, South Korea','8690241','KR'],['Labuan Bajo, Indonesia','1638868','ID'],['Hana, Hawaii, USA','5855471','US'],['Èze, France','3019174','FR'],['Rothenburg ob der Tauber, Germany','2844056','DE'],['Lacock, United Kingdom','2645072','GB']] as const;
async function resumeDirectSearch(page: Page) {
 const close=page.getByRole('button',{name:'Close destination browser',exact:true});
 if(await close.isVisible()) await close.click();
 await page.locator('#destination-search').focus();
}
async function setup(page:Page,context:BrowserContext) {
  await context.addCookies([{name:'travelmate_session',value:'worldwide-browser-fixture',domain:'localhost',path:'/'}]);
  await page.route('**/_next/image?**',r=>new URL(r.request().url()).searchParams.get('url')?.startsWith('http')?r.fulfill({status:404}):r.continue());
  const user={id:'worldwide-browser-fixture',name:'World Test Traveler',email:'world@example.test',role:'traveler',accountStatus:'active',emailVerified:true};
  const hotels:URLSearchParams[]=[],generations:Record<string,unknown>[]=[];
  await page.route('**/api/platform**',r=>r.fulfill({json:{user,trips:[],notifications:[],listings:[],bookings:[],itineraryVersions:[],itineraryGenerations:[],directory:[],moderation:[],audit:[]}}));
  await page.route('**/api/locations?**',async r=>{const p=new URL(r.request().url()).searchParams;await r.fulfill({json:p.get('kind')==='countries'?searchCatalogueCountries(p.get('q')||'',Number(p.get('offset')||0)):await searchGlobalLocationsPage(p.get('q')||'',Number(p.get('offset')||0),offline)});});
  await page.route('**/api/locations/areas?**',async r=>{const p=new URL(r.request().url()).searchParams;await r.fulfill({json:await searchDestinationAreas(selectedAreaParent(Number(p.get('parentId')),p.get('countryCode')||''),p.get('query')||'',Number(p.get('offset')||0),offline,p.get('hierarchy')==='true')});});
  await page.route('**/api/destination-context?**',r=>{const p=new URL(r.request().url()).searchParams;return r.fulfill({json:resolveDestinationContext(p.get('countryCode')||'',p.get('city')||'')});});
  await page.route('**/api/destination-context/exchange-rate?**',r=>r.fulfill({status:503,json:{error:'Isolated test.'}}));
  await page.route('**/api/accommodations?**',r=>{hotels.push(new URL(r.request().url()).searchParams);return r.fulfill({json:{configured:false,accommodations:[],nearbyAccommodations:[],providerAccommodations:[],status:'no-results',message:'No hotels in this isolated fixture.'}});});
  await page.route('**/api/itinerary',async r=>{const body=r.request().postDataJSON();generations.push(await validateDestinationAnchor(body.destination,body.destinationDetails,body.latitude,body.longitude,offline));await r.fulfill({status:503,json:{error:'Production location validation passed; fixture stops before AI generation and database writes.'}});});
  return { hotels,generations };
}
for(const [query,providerId,countryCode]of cases)test(`${countryCode}: ${query} uses full catalogue identity for generation and zero-hotel selection`,async({page,context})=>{
  expect(globalCatalogueAvailable(),'Provision the full catalogue with locations:build before running worldwide UI verification').toBeTruthy();
  const { hotels,generations } = await setup(page,context);
  await page.goto('/dashboard?tab=planner'); await page.getByRole('combobox',{name:'Destination',exact:true}).fill(query);
  const official=countryCode==='PH'?administrativeRecord(1_000_000_000_000+Number(providerId)):undefined;
  const place=official?administrativeCandidate(official):catalogueLocation(Number(providerId),countryCode)!;
  const option=page.locator('#destination-suggestions').getByRole('button').filter({hasText:place.contextLabel}); await expect(option).toHaveCount(1); await option.click();
  await expect(page.locator('#destination-status')).toContainText(place.contextLabel);await page.locator('#trip-budget').fill('30000');
  await expect(page.getByRole('button',{name:'Generate my trip',exact:true})).toBeEnabled();
  await expect.poll(()=>hotels.some(p=>p.get('locationProviderId')===providerId&&p.get('countryCode')===countryCode)).toBeTruthy();
  await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect.poll(()=>generations.length).toBe(1);
  expect(generations[0]).toMatchObject({providerId,countryCode}); expect(generations[0].locationPath).toBeTruthy();
});
test('Cebu parent browsing includes Cordova and 50 official municipalities/cities plus three recorded independent-city associations; global main search pages fetch new records',async({page,context})=>{
  await setup(page,context); await page.goto('/dashboard?tab=planner');
  await page.getByRole('combobox',{name:'Destination',exact:true}).fill('Cebu');
  await page.locator('#destination-suggestions').getByRole('button').filter({hasText:'Philippines — Province'}).click();
  await expect(page.locator('#destination-area-options').getByRole('option')).toHaveCount(20);
  await page.getByRole('button',{name:'Load more',exact:true}).click();await expect(page.locator('#destination-area-options').getByRole('option')).toHaveCount(40); await expect(page.getByRole('button',{name:'Choose Cordova',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Load more',exact:true}).click();await expect(page.locator('#destination-area-options').getByRole('option')).toHaveCount(53);
  await resumeDirectSearch(page);
  await page.getByRole('combobox',{name:'Destination',exact:true}).fill('Springfield');
  await expect(page.locator('#destination-suggestions').getByRole('option')).toHaveCount(20);
  await page.getByRole('button',{name:'Load more destinations',exact:true}).click(); await expect(page.locator('#destination-suggestions').getByRole('option')).toHaveCount(40);
  await page.getByRole('button',{name:'Load more destinations',exact:true}).click(); await expect(page.locator('#destination-suggestions').getByRole('option')).toHaveCount(60);
});
test('full worldwide identity fits the preserved desktop and mobile planner layout',async({page,context})=>{
  await setup(page,context);await page.goto('/dashboard?tab=planner');
  await page.getByRole('combobox',{name:'Destination',exact:true}).fill('小布施町, 日本');
  await expect(page.locator('#destination-suggestions')).toContainText('Town (Machi / Chō)');
  await page.locator('#destination-suggestions').scrollIntoViewIfNeeded();
  await page.screenshot({path:'../audit/2026-10-14/worldwide-locations/desktop-worldwide.png'});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#destination-suggestions')).toContainText('Obuse Machi');
  await expect(page.locator('#destination-suggestions')).not.toContainText('7417105');
  await page.locator('#destination-suggestions').scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:'../audit/2026-10-14/worldwide-locations/mobile-worldwide.png'});
  await page.locator('#destination-suggestions').getByRole('button').filter({hasText:catalogueLocation(7417105)!.contextLabel}).click();
  await expect(page.locator('#destination-status')).toContainText('Confirmed: Obuse Machi');
});

const browsingCases=[['JP','Tokyo',1850147],['JP','Kyoto',1857910],['JP','小布施町',7417105],['KR','Hadong-eup',8690241],['ID','Labuan Bajo',1638868],['US','Marfa',5525775],['BR','Paraty',3455036],['FR','Èze',3019174],['DE','Rothenburg ob der Tauber',2844056],['GB','Lacock',2645072],['ZA','Dullstroom',1007476],['KE','Nanyuki',184433],['MA','Chefchaouen',2553455],['NZ','Arrowtown',6206253],['AU','Bellingen',2176295]] as const;
for(const[code,query,id]of browsingCases)test(`country browsing ${code} → ${query} stays scoped and forwards the exact selected place`,async({page,context})=>{
  const {hotels,generations}=await setup(page,context),country=catalogueCountry(code)!,place=catalogueLocation(id,code)!;
  await page.goto('/dashboard?tab=planner');await page.getByRole('combobox',{name:'Destination',exact:true}).fill(country.name);
  const matches=page.getByRole('listbox',{name:'Places matching this name'});await expect(matches.getByRole('option').first()).toContainText(country.contextLabel);
  await matches.getByRole('option').first().getByRole('button').click();
  await expect(page.getByText(`Places within ${country.label}`,{exact:true})).toBeVisible();
  await expect(page.locator('#destination-area-options').getByRole('option').first()).toBeVisible();
  await page.locator('#destination-area-search').fill(query);
  const option=page.locator('#destination-area-options').getByRole('button',{name:`Choose ${place.name}`,exact:true}).filter({hasText:place.placeType});
  await expect(option).toHaveCount(1);await option.click();
  await expect(page.getByText(`Places within ${country.label}`,{exact:true})).toHaveCount(0);
  await expect(page.locator('#destination-status')).toContainText(place.contextLabel);
  await expect(page.locator('#destination-area-options')).toHaveCount(0);await expect(page.locator('#destination-status')).not.toContainText(String(id));
  // Existing planning currencies are PHP/USD/EUR/JPY. Other countries need an
  // explicit supported planning currency; geography must remain selectable.
  await expect.poll(()=>page.locator('#trip-currency').evaluate((el:HTMLSelectElement)=>!!el.value || !el.disabled)).toBeTruthy();
  if(await page.locator('#trip-currency').isEnabled())await page.locator('#trip-currency').selectOption('USD');
  await page.locator('#trip-budget').fill('30000');await expect(page.getByRole('button',{name:'Generate my trip',exact:true})).toBeEnabled();
  await expect.poll(()=>hotels.some(p=>p.get('locationProviderId')===String(id)&&p.get('countryCode')===code&&Number(p.get('latitude'))===place.latitude&&Number(p.get('longitude'))===place.longitude)).toBeTruthy();
  await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect.poll(()=>generations.length).toBe(1);expect(generations[0]).toMatchObject({id,countryCode:code,latitude:place.latitude,longitude:place.longitude});
});

test('Philippines → Cebu → Cordova, back, change and clear reset child selections and pages',async({page,context})=>{
  await setup(page,context);await page.goto('/dashboard?tab=planner');await page.getByRole('combobox',{name:'Destination',exact:true}).fill('Philippines');
  await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await page.locator('#destination-area-search').fill('Cebu');await page.getByRole('button',{name:'Choose Cebu',exact:true}).click();
  await expect(page.getByText('Places within Cebu, Philippines',{exact:true})).toBeVisible();await expect(page.locator('#destination-area-search')).toHaveValue('');
  await page.getByRole('button',{name:'Load more',exact:true}).click();await expect(page.getByRole('button',{name:'Choose Cordova',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Choose Cordova',exact:true}).click();await expect(page.locator('#destination-status')).toContainText('Cordova, Cebu, Philippines — Municipality');
  await expect(page.locator('#destination-area-search')).toHaveCount(0);await resumeDirectSearch(page);await page.getByRole('button',{name:'Browse by country',exact:true}).click();await page.locator('#destination-country-search').fill('Philippines');await page.locator('#destination-country-options').getByRole('option').first().getByRole('button').click();await expect(page.locator('#destination-area-search')).toHaveValue('');await expect(page.locator('#destination-status')).toContainText('Confirmed: Cordova');
  await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('#destination-area-search')).toHaveCount(0);await expect(page.locator('#destination-country-search')).toHaveValue('');
  await resumeDirectSearch(page);await page.locator('#destination-search').fill('Japan');await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await expect(page.getByText('Places within Japan',{exact:true})).toBeVisible();await expect(page.locator('#destination-area-options')).not.toContainText('Cordova');await expect(page.locator('#destination-area-search')).toHaveValue('');
});

test('Japan prefecture narrowing searches descendants and leaves no stale foreign or prior-area results',async({page,context})=>{
  await setup(page,context);await page.goto('/dashboard?tab=planner');await page.locator('#destination-search').fill('Japan');
  await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await expect(page.locator('#destination-area-options').getByRole('option').first()).toBeVisible();
  await page.locator('#destination-area-search').fill('Nagano');await page.getByRole('button',{name:'Choose Nagano-ken',exact:true}).click();
  await expect(page.locator('#destination-area-search')).toHaveValue('');await expect(page.getByText('Places within Nagano-ken, Japan',{exact:true})).toBeVisible();
  await page.locator('#destination-area-search').fill('小布施町');await expect(page.getByRole('button',{name:'Choose Obuse Machi',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Choose Obuse Machi',exact:true}).click();await expect(page.locator('#destination-status')).toContainText('Nagano-ken, Japan');
  await expect(page.locator('#destination-area-search')).toHaveCount(0);await resumeDirectSearch(page);await page.locator('#destination-search').fill('Japan');await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();await page.locator('#destination-area-search').fill('Nagano');await page.getByRole('button',{name:'Choose Nagano-ken',exact:true}).click();
  await page.locator('#destination-area-search').fill('Kyoto');await expect(page.locator('#destination-area-options')).toHaveCount(0);
  await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('#destination-area-search')).toHaveValue('');await expect(page.locator('#destination-area-options').getByRole('option').first()).toBeVisible();
  await page.locator('#destination-area-search').scrollIntoViewIfNeeded();await page.screenshot({path:'../audit/2026-10-14/country-browsing/desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('#destination-area-options').scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'../audit/2026-10-14/country-browsing/mobile.png'});
});

for(const[code,id]of [['US',5525775],['FR',3019174],['ZA',1007476],['NZ',6206253]] as const)test(`${code}: country → source region → small place preserves verified membership`,async({page,context})=>{
  await setup(page,context);const root=catalogueCountry(code)!,place=catalogueLocation(id)!,region=place.locationPath!.find(p=>p.level===1)!;
  await page.goto('/dashboard?tab=planner');await page.locator('#destination-search').fill(root.name);await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  const regionPlace=catalogueLocation(region.id)!;
  await page.locator('#destination-area-search').fill(region.name);await page.getByRole('button',{name:`Choose ${region.name}`,exact:true}).filter({hasText:regionPlace.contextLabel}).click();
  await expect(page.locator('#destination-area-search')).toHaveValue('');await expect(page.getByText(`Places within ${catalogueLocation(region.id)!.label}`,{exact:true})).toBeVisible();
  await page.locator('#destination-area-search').fill(place.name);await page.locator('#destination-area-options').getByRole('button',{name:`Choose ${place.name}`,exact:true}).filter({hasText:place.placeType}).click();await expect(page.locator('#destination-status')).toContainText(place.contextLabel);
});

test('a delayed country response cannot attach old children after changing or clearing the country',async({page,context})=>{
  await setup(page,context);let release!:()=>void,started=false,finished=false;
  await page.route('**/api/locations/areas?**',async r=>{const p=new URL(r.request().url()).searchParams,id=Number(p.get('parentId')),code=p.get('countryCode')!;if(code==='JP'){started=true;await new Promise<void>(resolve=>{release=resolve;});}const result=await searchDestinationAreas(selectedAreaParent(id,code),p.get('query')||'',Number(p.get('offset')||0),offline);if(code==='JP')finished=true;if(!r.request().failure())await r.fulfill({json:result});});
  await page.goto('/dashboard?tab=planner');await resumeDirectSearch(page);await page.locator('#destination-search').fill('Japan');await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();await expect.poll(()=>started).toBeTruthy();
  await page.getByRole('button',{name:'Back',exact:true}).click();await resumeDirectSearch(page);await page.locator('#destination-search').fill('France');await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();await expect(page.locator('#destination-area-options').getByRole('option').first()).toBeVisible();
  release();await expect.poll(()=>finished).toBeTruthy();await expect(page.getByText('Places within France',{exact:true})).toBeVisible();await expect(page.locator('#destination-area-options')).not.toContainText('Tokyo');
  await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('#destination-area-options')).toHaveCount(0);await expect(page.locator('#destination-status')).not.toContainText('France');
});
