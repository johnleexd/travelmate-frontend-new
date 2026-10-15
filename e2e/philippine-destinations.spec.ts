import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { searchGlobalLocationsPage } from '../../travelmate-backend-api/src/services/destination/global-location-search.ts';
import { searchDestinationAreas, selectedAreaParent } from '../../travelmate-backend-api/src/services/destination/destination-areas.ts';
import { resolveDestinationContext } from '../../travelmate-backend-api/src/services/destination/destination-context-service.ts';
import { validateDestinationAnchor } from '../../travelmate-backend-api/src/services/itinerary/grounded-places.ts';

const cases=[['Moalboal','0702233000',9.91667,123.43333],['Badian','0702207000',9.85,123.43333],['Oslob','0702235000',9.51667,123.4],['Bantayan','0702209000',11.2,123.73333],['Naga','0702234000',10.25,123.71667]] as const;
const noProvider:typeof fetch=async()=>{throw Error('Known catalogue records require no provider request.');};

async function setup(page:Page,context:BrowserContext) {
  await page.route('**/_next/image?**',r=>new URL(r.request().url()).searchParams.get('url')?.startsWith('http')?r.fulfill({status:404}):r.continue());
  await context.addCookies([{name:'travelmate_session',value:'psgc-browser-fixture',domain:'localhost',path:'/'}]); await page.emulateMedia({reducedMotion:'reduce'});
  const user={id:'psgc-browser-fixture',name:'PSGC Test Traveler',email:'psgc@example.test',role:'traveler',accountStatus:'active',emailVerified:true};
  const hotels:URLSearchParams[]=[],generations:Record<string,unknown>[]=[],areaRequests:URLSearchParams[]=[];
  await page.route('**/api/platform**',route=>route.fulfill({json:{user,trips:[],notifications:[],listings:[],bookings:[],itineraryVersions:[],itineraryGenerations:[],directory:[],moderation:[],audit:[]}}));
  await page.route('**/api/locations?**',async route=>route.fulfill({json:await searchGlobalLocationsPage(new URL(route.request().url()).searchParams.get('q')||'',Number(new URL(route.request().url()).searchParams.get('offset')||0),noProvider)}));
  await page.route('**/api/locations/areas?**',async route=>{const p=new URL(route.request().url()).searchParams;areaRequests.push(p);return route.fulfill({json:await searchDestinationAreas(selectedAreaParent(Number(p.get('parentId')),p.get('countryCode')||''),p.get('query')||'',Number(p.get('offset')||0),noProvider,p.get('hierarchy')==='true')});});
  await page.route('**/api/destination-context?**',route=>{const p=new URL(route.request().url()).searchParams;return route.fulfill({json:resolveDestinationContext(p.get('countryCode')||'',p.get('city')||'')});});
  await page.route('**/api/destination-context/exchange-rate?**',route=>route.fulfill({status:503,json:{error:'Not used in this test.'}}));
  await page.route('**/api/accommodations?**',route=>{hotels.push(new URL(route.request().url()).searchParams);return route.fulfill({json:{configured:false,accommodations:[],nearbyAccommodations:[],providerAccommodations:[],status:'no-results',message:'No hotel inventory in this test.'}});});
  await page.route('**/api/itinerary',async route=>{const body=route.request().postDataJSON();const accepted=await validateDestinationAnchor(body.destination,body.destinationDetails,body.latitude,body.longitude,noProvider);generations.push({...body,destinationDetails:accepted});return route.fulfill({status:503,json:{error:'Location validated. Isolated test does not create a stored trip.'}});});
  await page.route('**/api/weather?**',route=>route.fulfill({status:503,json:{error:'Not used in this test.'}}));
  await page.goto('/dashboard?tab=planner');await expect(page.getByRole('heading',{name:'Start a new trip',exact:true})).toBeVisible();
  return {hotels,generations,areaRequests};
}

async function province(page:Page) {
  await page.getByRole('combobox',{name:'Destination',exact:true}).fill('Cebu');
  await expect(page.locator('#destination-suggestions')).toContainText('Cebu City, Cebu, Philippines — City (independent city)');
  await page.getByRole('button',{name:/Cebu.*Philippines — Province/}).click();
  await expect(page.getByRole('combobox',{name:'City or town within selected destination',exact:true})).toHaveAttribute('placeholder','Search all available places within this area');
  await expect(page.locator('[data-area-state]')).toContainText('20 of 53 available matches shown.');
}

for(const [name,code,latitude,longitude] of cases) test(`${name}: official province search, zero hotels, and generation keep the same PSGC identity`,async({page,context})=>{
  const requests=await setup(page,context);await province(page);await page.locator('#trip-budget').fill('30000');
  await page.getByRole('combobox',{name:'City or town within selected destination',exact:true}).fill(name);
  const choice=page.locator('#destination-area-options').getByRole('button',{name:`Choose ${name}`,exact:true}).filter({has:page.getByText(`${name}, Cebu, Philippines — ${name==='Naga'?'City':'Municipality'}`,{exact:true})});
  await expect(choice).toContainText('Cebu, Philippines');await choice.click();
  await expect(page.locator('#destination-status')).toContainText(`Confirmed: ${name}, Cebu, Philippines`);
  await expect(page.getByText('No stays found. Try a nearby area or enter a hotel manually.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Generate my trip',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect.poll(()=>requests.generations.length).toBe(1);
  expect(requests.generations[0].destinationDetails).toMatchObject({id:1_000_000_000_000+Number(code),provider:'psgc',providerId:code,administrativeCode:code,provinceCode:'0702200000',latitude,longitude});
  const hotel=requests.hotels.find(p=>p.get('locationProviderId')===code)!;expect(hotel).toBeTruthy();
  expect(hotel.get('locationId')).toBe(String(1_000_000_000_000+Number(code)));expect(hotel.get('provinceCode')).toBe('0702200000');expect(hotel.get('latitude')).toBe(String(latitude));expect(hotel.get('longitude')).toBe(String(longitude));
});

test('all Cebu pages are distinct; keyboard selection and direct Cebu City search stay separate from province browsing',async({page,context})=>{
  await setup(page,context);await province(page);
  await page.getByRole('button',{name:'Load more',exact:true}).click();await expect(page.locator('#destination-area-options').getByRole('option')).toHaveCount(40);
  await page.getByRole('button',{name:'Load more',exact:true}).click();await expect(page.locator('#destination-area-options').getByRole('option')).toHaveCount(53);await expect(page.getByRole('button',{name:'Load more',exact:true})).toHaveCount(0);
  const query=page.getByRole('combobox',{name:'City or town within selected destination',exact:true});await query.fill('Moalboal');await expect(page.locator('#destination-area-options').getByRole('option').first()).toContainText('Municipality');await query.press('ArrowDown');await query.press('Enter');await expect(page.locator('#destination-status')).toContainText('Moalboal, Cebu, Philippines — Municipality');
  await page.getByRole('combobox',{name:'Destination',exact:true}).fill('Cebu City');await page.locator('#destination-suggestions').getByRole('button').filter({hasText:'Cebu City, Cebu, Philippines — City (independent city)'}).click();await expect(page.locator('#destination-area-search')).toHaveCount(0);await expect(page.locator('#destination-status')).toContainText('independent city');
});
