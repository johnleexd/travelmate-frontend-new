import assert from 'node:assert/strict';
import test from 'node:test';
import { createDestinationAreaClient } from '../services/destination-area-client.ts';

const START = Date.parse('2026-10-06T12:00:00Z');
const parent = {id:1862185,countryCode:'JP'};
function data(now = START) {
  return {parentId:parent.id,countryCode:'JP',areas:[{id:1850147,name:'Tokyo',region:'Tokyo',country:'Japan',countryCode:'JP',latitude:35.6895,longitude:139.6917,label:'Tokyo, Japan',placeType:'Capital city',contextLabel:'Capital city',provider:'geonames',providerId:'1850147',description:'Capital city in Japan.',membership:'boundary'}],total:1,nextOffset:null,status:'ready',message:'Choose a city.',fetchedAt:new Date(now).toISOString(),expiresAt:new Date(now+24*60*60_000).toISOString(),sourceUrls:['https://www.geonames.org/']};
}
test('area requests share an in-flight fetch and aborting one consumer does not affect another', async () => {
  let calls = 0; let release!: (value: Response)=>void;
  const client = createDestinationAreaClient(async ()=>{calls++;return new Promise(resolve=>{release=resolve;});},()=>START);
  const controller = new AbortController(); const first = client.search(parent,'',0,controller.signal); const second = client.search(parent);
  controller.abort(); await assert.rejects(first,{name:'AbortError'}); release(Response.json(data()));
  await second; await client.search(parent); assert.equal(calls,1);
});
test('parent/query/page caches stay separate and expiry permits one new request', async () => {
  let now=START;const calls:string[]=[];
  const client=createDestinationAreaClient(async input=>{calls.push(String(input));return Response.json(data(now));},()=>now);
  await client.search(parent); await client.search(parent); await client.search(parent,'Kyoto'); await client.search(parent,'',20); assert.equal(calls.length,3);
  now+=24*60*60_000;await client.search(parent);assert.equal(calls.length,4);
});
test('429 uses negative caching and Retry-After without background retries', async () => {
  let now=START;let calls=0;
  const client=createDestinationAreaClient(async ()=>{calls++;return Response.json({error:'Area requests limited.'},{status:429,headers:{'Retry-After':'120'}});},()=>now);
  await assert.rejects(client.search(parent),/limited/);now+=60_001;await assert.rejects(client.search(parent));assert.equal(calls,1);
  now+=60_000;await assert.rejects(client.search(parent));assert.equal(calls,2);
});
test('wrong-parent, foreign-country and invalid coordinates cannot be displayed as suggestions', async () => {
  for(const bad of [{...data(),parentId:999},{...data(),countryCode:'KR'},{...data(),areas:[{...data().areas[0],countryCode:'KR'}]},{...data(),areas:[{...data().areas[0],latitude:NaN}]}]) {
    const client=createDestinationAreaClient(async ()=>Response.json(bad),()=>START);await assert.rejects(client.search(parent),/validat|invalid/);
  }
});
test('comparisons cache city sets independent of order and cannot include unrelated city IDs', async () => {
  let calls=0;
  const payload={parentId:parent.id,countryCode:'JP',profiles:[{cityId:1,foodPlaces:3,culturePlaces:1,naturePlaces:2},{cityId:2,foodPlaces:1,culturePlaces:0,naturePlaces:2}],fetchedAt:new Date(START).toISOString(),expiresAt:new Date(START+6*60*60_000).toISOString(),sourceUrl:'https://www.openstreetmap.org/copyright',radiusKm:1,disclaimer:'Mapped sample; prices unavailable.'};
  const client=createDestinationAreaClient(async ()=>{calls++;return Response.json(payload);},()=>START);
  await client.compare(parent,[1,2]);await client.compare(parent,[2,1]);assert.equal(calls,1);
  await assert.rejects(client.compare(parent,[3]),/invalid mapped/);
});
