import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currencyStep, formatMoney, hasValidCurrencyPrecision, sumMoney } from '../lib/domain.ts';
import { convertCurrency, isCurrencyCode } from '../lib/currency-conversion.ts';
import { upsertActivity } from '../lib/itinerary-editor.ts';
import type { ExchangeRateQuote, ItineraryResponse } from '../lib/contracts.ts';
test('global planning currencies and currency-specific precision do not depend on conversion coverage',()=>{
  for(const code of ['COP','PHP','JPY','CNY','USD','EUR','VED','BHD','KWD','XCG'])assert.equal(isCurrencyCode(code),true);
  assert.equal(currencyStep('KWD'),0.001);assert.equal(currencyStep('JPY'),1);
  assert.equal(hasValidCurrencyPrecision(12.345,'BHD'),true);assert.equal(hasValidCurrencyPrecision(12.3456,'BHD'),false);
  assert.equal(sumMoney([0.123,0.456,0.789],'KWD'),1.368);assert.match(formatMoney(1.234,'BHD'),/BHD\s*1\.234/);
});
test('equivalents use captured provider rates, preserve source amounts and reject absent or mismatched quotes',()=>{
  const snapshot=JSON.parse(readFileSync(new URL('../../travelmate-backend-api/tests/fixtures/currency-provider-snapshot.json',import.meta.url),'utf8'));
  const payload=snapshot.results.find((row:{base:string})=>row.base==='COP').payload;
  const rate={...payload,asOf:payload.date} as ExchangeRateQuote;
  assert.equal(convertCurrency(1000000.25,'COP','PHP',{COP:rate}),19760);
  assert.equal(convertCurrency(1000000.25,'COP','COP',{}),1000000.25);
  assert.equal(convertCurrency(1000000.25,'COP','USD',{COP:rate}),null);
  assert.equal(convertCurrency(1000000.25,'VED','PHP',{}),null);
});
test('manual activity editing keeps three-decimal group costs instead of truncating them to cents',()=>{
  const plan={destination:'Kuwait City',currency:'KWD',totalBudget:10.123,travelers:3,partyType:'friends',days:[{day:1,date:'2040-01-25',theme:'Test',totalCost:0.123,activities:[{title:'User activity',time:'10:00 AM',durationMinutes:60,travelMinutes:0,description:'Entered by user',estimatedCost:0.123,category:'activity',icon:'map'}]}],budgetSummary:{total:10.123,reserve:0}} as ItineraryResponse;
  const original=JSON.stringify(plan), draft={...plan.days[0].activities[0],estimatedCost:0.111};
  const edited=upsertActivity(plan,0,0,draft);
  assert.equal(edited.days[0].activities[0].estimatedCost,0.111);assert.equal(edited.budgetSummary.plannedSpend,0.111);assert.equal(JSON.stringify(plan),original);
  assert.throws(()=>upsertActivity(plan,0,0,{...draft,estimatedCost:0.1111}),/precision/);
});
