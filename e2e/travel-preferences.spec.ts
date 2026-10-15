import { POST } from '../../travelmate-backend-api/src/controllers/itinerary-controller.ts';
import { prisma } from '../../travelmate-backend-api/src/lib/prisma.ts';
import { createSessionToken } from '../../travelmate-backend-api/src/middlewares/auth-middleware.ts';
import { clearProviderCache } from '../../travelmate-backend-api/src/services/cache/provider-cache.ts';
import { destinationReferences, referenceFetcher } from '../../travelmate-backend-api/tests/helpers/multi-destination-references.ts';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { searchGlobalLocationsPage } from '../../travelmate-backend-api/src/services/destination/global-location-search.ts';
import { searchDestinationAreas, selectedAreaParent } from '../../travelmate-backend-api/src/services/destination/destination-areas.ts';
import { resolveDestinationContext } from '../../travelmate-backend-api/src/services/destination/destination-context-service.ts';
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
  
  return { hotels,generations };
}


async function chooseTokyo(page:Page) {
 await page.goto('/dashboard?tab=planner');await page.locator('#destination-search').fill('Tokyo');await page.locator('#destination-suggestions').getByRole('button').filter({hasText:catalogueLocation(1850147,'JP')!.contextLabel}).click();await page.locator('#trip-budget').fill('300000');
 await expect(page.getByRole('button',{name:'Generate my trip',exact:true})).toBeEnabled();
 await expect(page.getByText(/^Rooms and guests/)).toHaveCount(0);await expect(page.getByLabel('Guests nationality')).toHaveCount(0);await expect(page.getByText(/Enter the guests.*nationality/)).toHaveCount(0);
}


// The running UI uses the production POST handler and captured public provider responses.
// Only account/session storage, AI responses and database writes are isolated.
for(const legacyStyle of [null,'budget','balanced','comfort','luxury','family-friendly'])test(`${legacyStyle || 'new trip'}: Balanced generation, historical reopening and regeneration`,async({page,context})=>{
 const evidence=await setup(page,context);let saved:any=null,generated:any=null;const writes:string[]=[];
 const user={id:'worldwide-browser-fixture',name:'World Test Traveler',email:'world@example.test',role:'traveler',accountStatus:'active',emailVerified:true};
 const restore:Array<()=>void>=[];const replace=(o:any,k:string,fn:any)=>{const prior=o[k];o[k]=fn;restore.push(()=>o[k]=prior);};
 const priorKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='fixture-only';
 replace(prisma.user,'findFirst',async()=>user);replace(prisma,'$queryRaw',async()=>[{count:1}]);replace(prisma.listing,'findMany',async()=>[]);
 replace(prisma.itineraryGeneration,'findUnique',async()=>null);replace(prisma.itineraryGeneration,'create',async()=>({id:'generation',attemptId:'attempt'}));replace(prisma.itineraryGeneration,'updateMany',async()=>({count:1}));
 replace(globalThis,'fetch',async(input:any,init:any)=>{
   if(String(input).includes('api.openai.com')){const prompt=JSON.parse(String(init?.body)).messages[1].content;const [,count,start]=prompt.match(/Plan (\d+) days, starting (\d{4}-\d{2}-\d{2})/);return Response.json({choices:[{message:{content:JSON.stringify({days:Array.from({length:Number(count)},(_,i)=>({day:i+1,date:new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10),theme:'Sparse AI fixture',visits:[]}))})}}]});}
   return referenceFetcher(destinationReferences.find(r=>r.anchor.countryCode==='JP')!)(input,init);
 });clearProviderCache();
 try{
 await page.route('**/api/weather**',r=>r.fulfill({status:503,json:{error:'Isolated forecast unavailable.'}}));
 await page.route('**/api/platform**',r=>{
  const path=new URL(r.request().url()).pathname;if(path.endsWith('/photos'))return r.fulfill({status:503,json:{error:'Isolated photos.'}});
  if(path==='/api/platform/trips/preference-fixture')return r.fulfill({json:{trip:saved}});
  if(r.request().method()==='POST'){const body=r.request().postDataJSON();writes.push(body.action);saved={...body,id:'preference-fixture',userId:user.id,status:'active',createdAt:new Date().toISOString()};return r.fulfill({json:{result:saved}});}
  return r.fulfill({json:{user,trips:saved?[saved]:[],notifications:[],listings:[],bookings:[],itineraryVersions:[],itineraryGenerations:[],directory:[],moderation:[],audit:[]}});
 });
 await page.route('**/api/itinerary',async r=>{const body=r.request().postDataJSON();evidence.generations.push(body);const response=await POST(new Request('http://localhost/api/itinerary',{method:'POST',headers:{cookie:`travelmate_session=${createSessionToken(user.id,'traveler')}`,'content-type':'application/json'},body:JSON.stringify(body)}));generated=await response.json();await r.fulfill({status:response.status,json:generated});});
 await chooseTokyo(page);await page.locator('#trip-start-date').fill('2040-01-25');await page.locator('#trip-end-date').fill('2040-01-27');
 await expect(page.getByLabel('Travel style',{exact:true})).toHaveCount(0);await expect(page.locator('#trip-travel-style')).toHaveCount(0);await page.locator('#trip-stay-preference').selectOption('resort');await page.locator('#trip-interests').fill('nature');await page.locator('#trip-preferred-activities').fill('museum');
 const options=await page.locator('#transportation option').evaluateAll(rows=>rows.map(e=>(e as HTMLOptionElement).value));const mode=options.find(o=>/taxi/i.test(o))||options[0];await page.locator('#transportation').selectOption(mode);
 if(legacyStyle===null){
  await page.locator('#trip-interests').evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:'../audit/2026-10-14/balanced-default/form-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('#trip-interests').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'../audit/2026-10-14/balanced-default/form-mobile.png'});await page.setViewportSize({width:1280,height:900});
 }

 await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect.poll(()=>saved,{timeout:30000}).not.toBeNull();
 expect(evidence.generations[0]).toMatchObject({accommodationPreference:'resort',interests:['nature'],preferredActivities:['museum'],transportationPreference:mode});
 expect(generated.preferences).toMatchObject({travelStyle:'balanced',pace:'balanced',accommodation:'resort',interests:['nature'],activities:['museum'],transportation:mode});
 expect(saved.itinerary.preferences).toEqual(generated.preferences);expect(evidence.generations[0]).not.toHaveProperty('travelStyle');expect(evidence.generations[0]).not.toHaveProperty('pace');expect(generated.grounding.total).toBe(0);expect(generated.grounding.unpricedExpenseCount).toBeGreaterThan(0);
 const first=generated.days[0].activities.find((a:any)=>a.place).place.name;
 await expect(page.locator('[data-itinerary-day="1"]:visible')).toContainText('Visit '+first);await expect(page.getByText('Known subtotal · other costs unpriced',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'View Itinerary',exact:true}).first().click();await expect(page.locator('[data-itinerary-day="1"]:visible')).toContainText('Visit '+first);
 if(legacyStyle===null){await page.screenshot({path:'../audit/2026-10-14/balanced-default/balanced-details.png'});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'../audit/2026-10-14/balanced-default/balanced-mobile.png'});await page.setViewportSize({width:1280,height:900});}
 const historical=structuredClone(saved.itinerary);if(legacyStyle){historical.preferences.travelStyle=legacyStyle;historical.preferences.pace='active';saved.itinerary=structuredClone(historical);}
 await page.reload();await page.getByRole('button',{name:'Saved trips',exact:true}).click();await page.getByRole('button',{name:'View itinerary',exact:true}).click();
 await expect(page.locator('[data-itinerary-day="1"]:visible')).toContainText('Visit '+first);await expect(page.getByText('Known subtotal · other costs unpriced',{exact:true})).toBeVisible();await page.reload();await expect(page.locator('[data-itinerary-day="1"]:visible')).toContainText('Visit '+first);
 expect(saved.itinerary).toEqual(historical);
 {
  await page.getByRole('button',{name:'Saved trips',exact:true}).click();await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('button',{name:'Change trip details',exact:true}).click();
  await expect(page.locator('#trip-travel-style')).toHaveCount(0);await expect(page.locator('#trip-stay-preference')).toHaveValue('resort');await expect(page.locator('#trip-interests')).toHaveValue('nature');await expect(page.locator('#trip-preferred-activities')).toHaveValue('museum');await expect(page.locator('#transportation')).toHaveValue(mode);
  await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect.poll(()=>evidence.generations.length).toBe(2);expect(evidence.generations[1]).toMatchObject({accommodationPreference:'resort',interests:['nature'],preferredActivities:['museum'],transportationPreference:mode});await page.getByRole('button',{name:'Update saved trip',exact:true}).click();await expect.poll(()=>writes.includes('update-trip')).toBeTruthy();expect(saved.itinerary.preferences).toEqual(generated.preferences);expect(generated.preferences).toMatchObject({travelStyle:'balanced',pace:'balanced'});expect(evidence.generations[1]).not.toHaveProperty('travelStyle');expect(evidence.generations[1]).not.toHaveProperty('pace');
 }

 }finally{restore.reverse().forEach(fn=>fn());clearProviderCache();if(priorKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=priorKey;}
});
