import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {setup} from './fixtures/planner-fixture';
import {indexedDestination} from '../../travelmate-backend-api/src/services/destination/destination-index';
import {getExchangeRate,clearExchangeRateCache} from '../../travelmate-backend-api/src/services/currency/exchange-rate-service';
import {expenseLedger} from '../lib/generated/expense-ledger';
import type {ItineraryResponse} from '../lib/contracts';
import {formatMoney} from '../lib/domain';
const evidence=JSON.parse(readFileSync(new URL('../../travelmate-backend-api/tests/fixtures/currency-provider-snapshot.json',import.meta.url),'utf8'));
const destinations=[[3688689,'CO','COP','1000000.25'],[1701668,'PH','PHP','30000.50'],[1850147,'JP','JPY','300000'],[1791247,'CN','CNY','3000.25'],[5128581,'US','USD','1000.25'],[2988507,'FR','EUR','1000.25'],[3871336,'CL','CLP','1000000'],[285787,'KW','KWD','10.123'],[290340,'BH','BHD','10.123']] as const;
async function fixture(page:Page,context:BrowserContext,failure=false){
  const state=await setup(page,context),rates:string[]=[];clearExchangeRateCache();
  await page.route('**/api/locations?**',route=>{const q=(new URL(route.request().url()).searchParams.get('q')??'').toLowerCase();const places=[...destinations.map(([id,country])=>indexedDestination(id,country)!),indexedDestination(3646738,'VE')!,indexedDestination(3703443,'PA')!];return route.fulfill({json:{locations:places.filter(place=>place.label.toLowerCase().includes(q)),total:places.length,nextOffset:null}});});
  await page.route('**/api/accommodations?**',route=>route.fulfill({json:{configured:true,status:'ready',accommodations:[],nearbyAccommodations:[],providerAccommodations:[]}}));
  await page.route('**/api/destination-context/exchange-rate?**',async route=>{
    const params=new URL(route.request().url()).searchParams,base=params.get('base')!,quote=params.get('quote')!;rates.push(`${base}:${quote}`);
    const row=evidence.results.find((r:{base:string;quote:string})=>r.base===base&&r.quote===quote);
    if(failure||!row||row.status!==200)return route.fulfill({status:502,json:{error:'Conversion unavailable'}});
    const result=await getExchangeRate(base,quote,async()=>Response.json(row.payload));return route.fulfill({json:result});
  });
  return {state,rates};
}
async function select(page:Page,id:number,country:string){
  const city=indexedDestination(id,country)!;
  await page.locator('#destination-search').fill(city.name);await page.locator('#destination-suggestions').getByRole('button').filter({hasText:city.country}).first().click();
  return city;
}
for(const [id,country,currency,budget] of destinations)test(`${country}/${currency} budgets generate, save, reopen and retain ISO precision independently of rates`,async({page,context})=>{
  const {state}=await fixture(page,context);
  await page.goto('/dashboard?tab=planner');await select(page,id,country);
  await expect(page.locator('#trip-currency')).toHaveValue(currency);
  const digits=['JPY','CLP'].includes(currency)?0:['KWD','BHD'].includes(currency)?3:2;
  await expect(page.locator('#trip-budget')).toHaveAttribute('step',String(10**-digits));
  await page.locator('#trip-start-date').fill('2040-01-25');await page.locator('#trip-end-date').fill('2040-01-25');await page.locator('#trip-budget').fill(budget);
  await expect(page.getByText('Currency & rate details',{exact:true})).toBeVisible();
  if(currency==='COP'){
    await page.setViewportSize({width:1440,height:1100});await page.getByText('Currency & rate details',{exact:true}).click();
    await expect(page.getByRole('link',{name:'ISO 4217 / SIX',exact:true})).toHaveAttribute('href',/six-group.com/);
    await expect(page.getByRole('link',{name:'Unicode CLDR 48',exact:true})).toHaveAttribute('href',/unicode-org\/cldr-json/);
    await expect(page.getByText(/1 COP ≈ [0-9.,]+ PHP\. Rate date:/)).toBeVisible();
    await page.locator('#trip-currency').evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
    await page.screenshot({path:'test-results/world-currency-cop-planner-desktop.png'});
    await page.getByText('Currency & rate details',{exact:true}).click();
  }
  await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect(page).toHaveURL(/trip=preferences-trip/);await expect.poll(()=>state.saved).not.toBeNull();
  expect(state.saved!.currency).toBe(currency);expect(state.saved!.budget).toBe(Number(budget));expect(state.generations[0]).toMatchObject({currency,budget:Number(budget)});
  const original=structuredClone(state.saved),total=expenseLedger(state.saved!.itinerary as unknown as ItineraryResponse).total;
  await page.reload();await expect(page.getByRole('heading',{name:'Your trip itinerary',exact:true})).toBeVisible();
  await page.getByText('Trip planning settings',{exact:true}).click();await expect(page.locator('#trip-currency')).toHaveValue(currency);await expect(page.locator('#trip-budget')).toHaveValue(String(Number(budget)));
  await page.locator('#trip-reference-currency').selectOption('');await expect(page.getByText('Conversion unavailable',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Budget review',exact:true}).click();await expect(page.locator('[data-budget-amount="budget"]')).toHaveText(formatMoney(Number(budget),currency));expect(state.saved).toEqual(original);expect(expenseLedger(state.saved!.itinerary as unknown as ItineraryResponse).total).toBe(total);
  if(currency==='COP'){await page.setViewportSize({width:390,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'test-results/world-currency-cop-mobile.png',fullPage:true});}
});
test('destination and budget currency changes require fresh amounts, while display changes never relabel stored money',async({page,context})=>{
  const {state,rates}=await fixture(page,context,true);await page.goto('/dashboard?tab=planner');await select(page,3688689,'CO');await page.locator('#trip-budget').fill('1000000');
  await expect(page.getByText('Conversion unavailable',{exact:true}).first()).toBeVisible();await page.locator('#trip-reference-currency').selectOption('USD');await expect(page.locator('#trip-budget')).toHaveValue('1000000');await expect(page.locator('#trip-currency')).toHaveValue('COP');
  await select(page,1850147,'JP');await expect(page.locator('#trip-budget')).toHaveValue('');await expect(page.locator('#trip-currency')).toHaveValue('JPY');
  await page.locator('#trip-budget').fill('300000');await page.locator('#trip-currency').selectOption('KWD');await expect(page.locator('#trip-budget')).toHaveValue('');await expect(page.locator('#trip-budget')).toHaveAttribute('step','0.001');
  await page.locator('#trip-reference-currency').selectOption('');const before=rates.length;await page.locator('#trip-budget').fill('123.456');await page.locator('#trip-currency').selectOption('BHD');await expect(page.locator('#trip-budget')).toHaveValue('');expect(rates).toHaveLength(before);expect(state.writes).toHaveLength(0);
});
test('provider-uncovered VED permits generation with user estimates and survives save/reopen and editing',async({page,context})=>{
  const {state}=await fixture(page,context);await page.goto('/dashboard?tab=planner');await select(page,3646738,'VE');await page.locator('#trip-currency').selectOption('VED');await page.locator('#trip-budget').fill('1000000.25');
  await page.locator('#trip-start-date').fill('2040-01-25');await page.locator('#trip-end-date').fill('2040-01-25');
  await expect(page.getByText('Conversion unavailable',{exact:true}).first()).toBeVisible();
  await page.getByText('Budget details (optional)',{exact:true}).click();await page.getByText('Expense assumptions (optional)',{exact:true}).click();await page.locator('[name="expense-foodDailyPerPerson"]').fill('123.45');await page.locator('[name="expense-transportFare"]').fill('321.23');await page.locator('[name="expense-contingencyPercent"]').fill('0');
  await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect(page).toHaveURL(/trip=preferences-trip/);await expect.poll(()=>state.saved).not.toBeNull();expect(state.saved!.currency).toBe('VED');expect(expenseLedger(state.saved!.itinerary as unknown as ItineraryResponse).total).toBe(444.68);
  await page.reload();await page.getByText('Trip planning settings',{exact:true}).click();await expect(page.locator('#trip-currency')).toHaveValue('VED');await expect(page.locator('#trip-budget')).toHaveValue('1000000.25');
  await page.getByText('Budget details (optional)',{exact:true}).click();await page.getByText('Expense assumptions (optional)',{exact:true}).click();await page.locator('[name="expense-foodDailyPerPerson"]').fill('234.56');await page.getByRole('button',{name:'Update saved trip',exact:true}).click();
  await expect.poll(()=>expenseLedger(state.saved!.itinerary as unknown as ItineraryResponse).total).toBe(555.79);expect(state.generations).toHaveLength(1);
});
test('multiple-currency destinations require an explicit choice instead of picking the first currency',async({page,context})=>{
  await fixture(page,context);await page.goto('/dashboard?tab=planner');await select(page,3703443,'PA');await expect(page.locator('#trip-currency')).toHaveValue('');await expect(page.getByText('Destination currencies: PAB, USD. Choose one for your budget.',{exact:true})).toBeVisible();await page.locator('#trip-currency').selectOption('PAB');await expect(page.locator('#trip-currency')).toHaveValue('PAB');
});

test('three-decimal food, shared transport, accommodation nights, activity edits and Budget review keep matching after save and refresh',async({page,context})=>{
  const {state}=await fixture(page,context);await page.goto('/dashboard?tab=planner');await select(page,285787,'KW');
  await page.locator('#trip-reference-currency').selectOption('');await page.getByRole('combobox',{name:'Traveling as',exact:true}).selectOption('friends');
  await page.locator('#trip-start-date').fill('2040-01-25');await page.locator('#trip-end-date').fill('2040-01-27');await page.locator('#trip-budget').fill('6');
  await page.getByText('Budget details (optional)',{exact:true}).click();await page.getByText('Expense assumptions (optional)',{exact:true}).click();
  for(const [name,value] of Object.entries({rooms:'2',nightlyRoomEstimate:'1.234',foodDailyPerPerson:'0.111',transportFare:'0.222',fees:'0.123',contingencyPercent:'0'}))await page.locator(`[name="expense-${name}"]`).fill(value);
  await page.getByRole('button',{name:'Generate my trip',exact:true}).click();await expect(page).toHaveURL(/trip=preferences-trip/);await expect.poll(()=>state.saved).not.toBeNull();
  await page.getByRole('button',{name:'Budget review',exact:true}).click();await expect(page.locator('[data-budget-amount="cost"]')).toHaveText('KWD 6.724');await expect(page.locator('[data-budget-amount="remaining"]')).toHaveText('KWD 0.724');await expect(page.getByText('Amount over budget',{exact:true})).toBeVisible();
  await expect(page.locator('[data-budget-category="accommodation"]')).toContainText('KWD 4.936');await expect(page.locator('[data-budget-category="food"]')).toContainText('KWD 0.999');await expect(page.locator('[data-budget-category="transportation"]')).toContainText('KWD 0.666');
  await page.getByRole('button',{name:'Back to itinerary',exact:true}).click();await page.getByRole('button',{name:'View day itinerary',exact:true}).first().click();await page.getByRole('button',{name:'Add activity',exact:true}).click();
  const editor=page.getByRole('dialog');await editor.getByLabel('Activity title',{exact:true}).fill('User-entered visit');await expect(editor.getByLabel('Estimated group cost (KWD)',{exact:true})).toHaveAttribute('step','0.001');await editor.getByLabel('Estimated group cost (KWD)',{exact:true}).fill('0.123');await editor.getByRole('button',{name:'Add activity',exact:true}).click();
  await page.getByRole('button',{name:'Update saved trip',exact:true}).click();await expect.poll(()=>expenseLedger(state.saved!.itinerary as unknown as ItineraryResponse).total).toBe(6.847);await page.reload();
  await page.getByRole('button',{name:'Budget review',exact:true}).click();await expect(page.locator('[data-budget-amount="cost"]')).toHaveText('KWD 6.847');expect(state.saved!.itinerary.days[0].activities.some(item=>item.estimatedCost===0.123)).toBe(true);expect(state.generations).toHaveLength(1);
  await page.screenshot({path:'test-results/world-currency-three-decimal.png',fullPage:true});
});

test('destination-context failure does not remove the shared local-currency definition',async({page,context})=>{
  await fixture(page,context,true);await page.route('**/api/destination-context?**',route=>route.fulfill({status:503,json:{error:'Context unavailable'}}));await page.goto('/dashboard?tab=planner');await select(page,3688689,'CO');await expect(page.locator('#trip-currency')).toHaveValue('COP');await expect(page.locator('#trip-currency')).toBeEnabled();
});
