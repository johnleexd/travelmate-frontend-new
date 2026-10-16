import { readFileSync } from 'node:fs';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { setup, user } from './fixtures/planner-fixture';
import { buildGroundedPlan } from '../../travelmate-backend-api/src/services/itinerary/grounded-plan';
import type { GroundedPlace } from '../../travelmate-backend-api/src/services/itinerary/grounded-places';
import { expenseLedger } from '../lib/generated/expense-ledger';
import type { ItineraryResponse } from '../lib/contracts';

async function historicalTrip(page:Page,context:BrowserContext) {
  const state=await setup(page,context);
  const recorded=JSON.parse(readFileSync(new URL('../../travelmate-backend-api/tests/fixtures/preference-affected-cordova.json',import.meta.url),'utf8'));
  const places=recorded.places.slice(0,2) as GroundedPlace[];
  const plan=buildGroundedPlan({destination:'Cordova, Philippines',anchor:recorded.anchor,startingLocation:'',startDate:'2040-01-25',endDate:'2040-01-25',budget:30000,currency:'PHP',travelers:1,partyType:'solo',rooms:1,source:'catalog',transportation:'legacy road preference',timeZone:'Asia/Manila',places,placeDataStatus:'stale-cache',schedule:[{day:1,date:'2040-01-25',theme:'Museums',visits:places.map((place,index)=>({placeId:place.placeId,startMinutes:600+index*240,durationMinutes:120,participants:1})),scheduleBlocks:[{kind:'meal',startMinutes:720,endMinutes:765,label:'Meal break — venue not selected; meal prices need confirmation.'}]}]});
  plan.days[0].activities.forEach(item=>{if(item.place)item.description=places.find(place=>place.placeId===item.place!.placeId)!.description;});
  plan.days[0].weatherAlert='Heavy rain expected. Allow extra time and consider indoor alternatives.';
  state.saved={id:'preferences-trip',userId:user.id,status:'active',destination:plan.destination,destinationCity:'Cordova',destinationCountry:'Philippines',destinationCountryCode:'PH',latitude:recorded.anchor.latitude,longitude:recorded.anchor.longitude,budget:30000,currency:'PHP',travelers:1,partyType:'solo',startDate:'2040-01-25',endDate:'2040-01-25',interests:['historical interest'],createdAt:'2026-10-16T00:00:00Z',itinerary:plan};
  await page.route('**/api/navigation/next-stop',route=>route.fulfill({json:{...route.request().postDataJSON(),options:[]}}));
  return {state,places,plan};
}
const url='/dashboard?tab=planner&trip=preferences-trip&day=1&from=saved';

for (const source of ['saved','generated'] as const) test(`${source} itinerary photos have no credit caption or dropdown in overview, day details and dialog after refresh`,async({page,context})=>{
  let state: Awaited<ReturnType<typeof setup>>;
  if (source === 'saved') {
    const fixture = await historicalTrip(page,context); state = fixture.state;
    fixture.plan.days[0].activities[0].imageAttribution!.creator = 'No machine-readable author provided. Jinghaishuishou assumed (based on copyright claims).';
    await page.goto(url.replace('&day=1',''));
  } else {
    state = await setup(page,context);
    const photos = JSON.parse(readFileSync(new URL('../tests/fixtures/tokyo-activity-photos.json',import.meta.url),'utf8'));
    const place = {...photos[0].place,imageUrl:photos[0].imageUrl,imageAttribution:photos[0].imageAttribution,description:photos[0].description} as GroundedPlace;
    await page.route('**/api/itinerary',async route=>{
      const body=route.request().postDataJSON();state.generations.push(body);
      return route.fulfill({json:buildGroundedPlan({destination:body.destination,anchor:body.destinationDetails,startingLocation:'',startDate:body.startDate,endDate:body.endDate,budget:body.budget,currency:body.currency,travelers:body.travelers,partyType:body.partyType,rooms:1,transportation:body.transportationPreference,source:'catalog',timeZone:'Asia/Tokyo',places:[place],placeDataStatus:'stale-cache',schedule:[{day:1,date:body.startDate,theme:'Garden visit',visits:[{placeId:place.placeId,startMinutes:600,durationMinutes:120,participants:body.travelers}]}]})});
    });
    await page.goto('/dashboard?tab=planner');
    await page.locator('#trip-start-date').fill('2040-01-25');await page.locator('#trip-end-date').fill('2040-01-25');
    await page.locator('#destination-search').fill('Tokyo');await page.locator('#destination-suggestions').getByRole('button').filter({hasText:'Japan'}).first().click();
    await page.locator('#trip-budget').fill('100000');await page.getByRole('button',{name:'Generate my trip',exact:true}).click();
    await expect(page).toHaveURL(/trip=preferences-trip/);await expect.poll(()=>state.saved).not.toBeNull();
  }
  const original=structuredClone(state.saved), writes=state.writes.length, generations=state.generations.length;
  const photo=page.locator('[data-overview-activity-index="0"] figure');
  await expect(photo.getByRole('img')).toBeVisible();
  await expect(photo.getByText(/Photo:|Photo credits|No machine-readable/)).toHaveCount(0);
  await page.getByRole('button',{name:'View day itinerary',exact:true}).first().click();
  const card=page.locator('[data-day-details] [data-activity-index="0"]');
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    await expect(card.locator('figure').getByRole('img')).toBeVisible();
    await expect(card.locator('figure').getByRole('link')).toHaveCount(0);
    await expect(page.getByText('Photo credits',{exact:true})).toHaveCount(0);
    await expect(page.locator('[data-photo-credits]')).toHaveCount(0);
    const sources=card.locator('[data-activity-details]');await sources.locator('summary').first().click();
    await expect(sources.getByRole('link',{name:/^Photo:/})).toBeVisible();
    await sources.locator('summary').first().click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await card.screenshot({path:`test-results/no-photo-credits-${source}-${width}.png`});await page.reload();
  }
  await page.getByRole('button',{name:'Full details',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByText('Photo credits',{exact:true})).toHaveCount(0);
  await expect(dialog.locator('ol figure').first().getByRole('link')).toHaveCount(0);
  await page.getByRole('button',{name:'Close day details',exact:true}).click();
  expect(state.saved).toEqual(original);expect(state.writes).toHaveLength(writes);expect(state.generations).toHaveLength(generations);
});

test('saved overview keeps one concise cost summary and expands estimate explanations on demand', async ({ page, context }) => {
  const { state, plan } = await historicalTrip(page, context);
  delete plan.grounding;
  delete plan.accommodationEstimate;
  plan.days[0].totalCost = 0;
  plan.days[0].activities.forEach(item => { item.estimatedCost = 0; if (item.priceEvidence) item.priceEvidence.status = 'unavailable'; });
  plan.plannedAccommodation = { name: 'Historical hotel preference', address: 'Saved hotel address', source: 'manual' };
  const original = structuredClone(state.saved), total = expenseLedger(plan as unknown as ItineraryResponse).total;
  await page.goto(url.replace('&day=1',''));
  for (const width of [1440,390]) {
    await page.setViewportSize({ width, height: 1000 });
    const cost = page.getByRole('region',{name:'Trip expense estimate'});
    await expect(cost.getByText('Total estimated cost (partial)',{exact:true})).toBeVisible();
    await expect(cost.getByText('Estimate unavailable',{exact:true})).toBeVisible();
    await expect(cost).toContainText('Budget provisional');
    await expect(cost).not.toContainText('0.00');
    await expect(page.getByText('Saved trip loaded.',{exact:false})).toHaveCount(0);
    await expect(page.getByText('Accommodation planning estimate',{exact:true})).not.toBeVisible();
    await expect(page.getByText('Historical hotel preference',{exact:true}).first()).toBeVisible();
    await expect(page.getByText('For planning purposes only. Actual prices may vary.',{exact:true}).filter({visible:true})).toHaveCount(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:`test-results/overview-cleanup-${width}.png`});
    await page.getByText('Trip budget & sources',{exact:true}).click();
    await expect(page.getByText('Estimate calculation basis',{exact:true})).toBeVisible();
    await page.getByText('Estimate calculation basis',{exact:true}).click();
    await expect(page.getByText('Historical estimates are preserved;', {exact:false})).toBeVisible();
    await page.reload();
  }
  expect(state.saved).toEqual(original); expect(state.writes).toHaveLength(0); expect(state.generations).toHaveLength(0);
  expect(expenseLedger(state.saved!.itinerary as unknown as ItineraryResponse).total).toBe(total);
});

test('saved noisy descriptions stay concise while full text, warnings, costs and source links remain available',async({page,context})=>{
  const {state,places,plan}=await historicalTrip(page,context);
  const original=structuredClone(state.saved), total=expenseLedger(plan as unknown as ItineraryResponse).total;
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1100});
  await page.goto(url);
  const day=page.locator('[data-day-details]'),card=day.locator('[data-activity-index="0"]');
  await expect(card.getByText('Outside selected destination',{exact:true})).toBeVisible();
  await expect(card.getByText('Location unconfirmed',{exact:true})).toBeVisible();
  await expect(card.getByText('Hours unverified',{exact:true})).toBeVisible();
  await expect(card.getByText('Route unverified',{exact:true})).toBeVisible();
  await expect(card.getByText('planned',{exact:true})).not.toBeVisible();
  await expect(card.getByText('Suggested duration:',{exact:false})).toHaveCount(0);
  const short=card.locator('[data-short-description]');
  await expect(short).not.toContainText(/straight-line|minutes each way|Address:|Suggested \d+-minute/);
  expect((await short.textContent())!.length).toBeLessThanOrEqual(180);
  const line=await short.evaluate(element=>({height:element.getBoundingClientRect().height,line:parseFloat(getComputedStyle(element).lineHeight)}));
  expect(line.height).toBeLessThanOrEqual(line.line*2+1);
  expect(await day.getByText(/Local time \(Asia\/Manila\)/).count()).toBe(1);
  await expect(day.getByText('Rain risk. Check weather details.',{exact:true})).toBeVisible();
  const details=card.locator('[data-activity-details]');
  await expect(details.locator('p').filter({hasText:places[0].description}).first()).not.toBeVisible();
  const toggle=details.locator('summary').first();await toggle.focus();await toggle.press('Enter');
  await expect(details.locator('p').filter({hasText:places[0].description}).first()).toBeVisible();
  await expect(details.getByRole('link',{name:places[0].name,exact:true})).toHaveAttribute('href',places[0].sourceUrl);
  await expect(details.getByRole('link',{name:places[0].imageAttribution!.license,exact:true})).toHaveAttribute('href',places[0].imageAttribution!.licenseUrl!);
  await details.getByText('Estimate basis',{exact:true}).click();
  await expect(details.getByText(/TravelMate planning-v1/)).toBeVisible();
  await expect(details).toContainText('Scheduling buffer:');
  await toggle.press('Enter');
  const transport=day.locator('[data-next-stop]').first();
  await expect(transport.locator('[data-route-summary]')).toHaveText('Check route and local transport options.');
  await expect(transport.getByText(/Fare unavailable/)).not.toBeVisible();
  await transport.getByText('Route details',{exact:true}).click();
  await expect(transport.getByText(/Fare unavailable/)).toBeVisible();
  await transport.getByText('Route details',{exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await day.screenshot({path:'test-results/itinerary-cleanup-desktop.png'});
  await page.reload();
  await expect(page.locator('[data-day-details] [data-activity-index="0"]').getByText('Outside selected destination',{exact:true})).toBeVisible();
  expect(state.saved).toEqual(original);expect(state.writes).toHaveLength(0);expect(state.generations).toHaveLength(0);
  expect(expenseLedger(state.saved!.itinerary as unknown as ItineraryResponse).total).toBe(total);
  expect(errors).toEqual([]);
});

test('mobile cards, overview, details dialog, map, visited and editing controls keep working',async({page,context})=>{
  const {state,places}=await historicalTrip(page,context);
  const historical=structuredClone(state.saved);
  let recorded=0;
  await page.route('**/api/platform',async route=>{
    if(route.request().method()==='POST'&&route.request().postDataJSON().action==='record-visit'){
      expect(route.request().postDataJSON()).toMatchObject({tripId:'preferences-trip',activityIndex:0,placeId:places[0].placeId});
      recorded++;return route.fulfill({json:{result:{alreadyRecorded:false}}});
    }
    return route.fallback();
  });
  await page.setViewportSize({width:390,height:1000});await page.goto(url);
  const card=page.locator('[data-day-details] [data-activity-index="0"]');
  await card.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await card.screenshot({path:'test-results/itinerary-cleanup-mobile.png'});
  await expect(card.getByRole('button',{name:`Edit Visit ${places[0].name}`,exact:true})).toBeVisible();
  const map=card.getByRole('link',{name:/on Google Maps/});
  expect(new URL((await map.getAttribute('href'))!).hostname).toBe('www.google.com');
  await context.route('https://www.google.com/maps/**',route=>route.fulfill({body:'Maps link reached.'}));
  const popupPromise=context.waitForEvent('page');await map.click();
  const popup=await popupPromise;await popup.waitForLoadState();
  expect(popup.url()).toBe(await map.getAttribute('href'));await popup.close();
  await card.getByRole('button',{name:'Mark as visited',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Record a visit'})).toBeVisible();
  await page.getByRole('dialog',{name:'Record a visit'}).getByRole('button',{name:'Mark as visited',exact:true}).click();
  await expect(card.getByRole('status')).toHaveText('Visit saved to your personal history.');expect(recorded).toBe(1);
  await page.getByRole('button',{name:'Full details',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('ol [data-activity-details]')).toHaveCount(2);
  await expect(dialog.locator('[data-activity-text]').first().getByText('Outside selected destination',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Next activity',exact:true}).click();
  await expect(dialog.getByText('Activity 2 of 2',{exact:true})).toBeVisible();
  await dialog.locator('[data-activity-details]').first().locator('summary').first().click();
  await expect(dialog.locator('[data-activity-details]').first()).toContainText(places[0].description);
  await page.getByRole('button',{name:'Close day details',exact:true}).click();
  await page.locator('[data-itinerary-back="explicit-overview"]').click();
  const overview=page.locator('[data-overview-activity-index="0"]');
  await expect(overview.getByText('Outside selected destination',{exact:true})).toBeVisible();
  await expect(overview.locator('[data-expense-estimate]').first()).toBeVisible();
  await expect(overview.getByRole('button',{name:`Edit Visit ${places[0].name}`,exact:true})).toBeVisible();
  await expect(overview.locator('[data-short-description]')).not.toContainText('straight-line');
  await overview.getByRole('button',{name:`Edit Visit ${places[0].name}`,exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('textbox',{name:'Description',exact:true})).toHaveValue(places[0].description);
  await page.getByRole('button',{name:'Close activity editor',exact:true}).click();
  await overview.getByRole('button',{name:`Move Visit ${places[0].name} later`,exact:true}).click();
  await expect(page.locator('[data-overview-activity-index="0"] h4').first()).toHaveText(`Visit ${places[1].name}`);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:`Remove Visit ${places[0].name}`,exact:true}).click();
  await expect(page.locator('[data-overview-activity-index]')).toHaveCount(1);
  expect(state.writes).toHaveLength(0);expect(state.generations).toHaveLength(0);
  expect(state.saved).toEqual(historical);
});
