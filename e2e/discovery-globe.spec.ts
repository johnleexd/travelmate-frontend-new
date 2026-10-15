import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { countryAt, indexCountries, type Country } from '../lib/discovery-countries';
import { discoveryCountryFlag } from '../lib/discovery-country-flags';
import type { CountryPhotoManifest } from '../lib/discovery-country-photos';

const countries = JSON.parse(readFileSync(new URL('../public/discovery/countries-10m.v5.1.2.json', import.meta.url), 'utf8')) as Country[];
const index = indexCountries(countries);
const manifest = () => JSON.parse(readFileSync(new URL('../public/discovery/country-photos.v2.json', import.meta.url), 'utf8')) as CountryPhotoManifest;
const canvasSelector = '#discovery canvas';

async function openGlobe(page: Page, reduced = true) {
  if (reduced) await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.locator('#discovery').scrollIntoViewIfNeeded();
  await expect(page.locator(canvasSelector)).toHaveAttribute('data-ready','true',{timeout:30000});
  await expect(page.getByRole('combobox',{name:'Discover a country or territory'})).toBeEnabled();
}
async function focusCountry(page: Page, country: Country) {
  await page.getByRole('combobox',{name:'Discover a country or territory'}).selectOption(country.id);
  await expect.poll(()=>page.locator(canvasSelector).evaluate((e,center)=>e.dataset.state==='paused' && Math.abs(Number(e.dataset.latitude)-center[1])<.02 && Math.abs(((Number(e.dataset.longitude)-center[0]+180)%360+360)%360-180)<.02,country.center)).toBe(true);
}
function countryPoint(country: Country): [number,number] {
  const [x,y]=country.center;
  if(countryAt(index,y,x)?.code===country.code)return [y,x];
  for(const target of index.smallTargets.filter(t=>t.country.code===country.code)) {
    if(countryAt(index,target.latitude,target.longitude)?.code===country.code)return [target.latitude,target.longitude];
  }
  for(const polygon of country.polygons){
    const ring=polygon[0];
    const x=ring.reduce((s,p)=>s+p[0],0)/ring.length,y=ring.reduce((s,p)=>s+p[1],0)/ring.length;
    if(countryAt(index,y,x)?.code===country.code)return[y,x];
    for(let i=0;i<ring.length-1;i++){
      const px=(ring[i][0]+ring[i+1][0])*.4995+x*.001;
      const py=(ring[i][1]+ring[i+1][1])*.4995+y*.001;
      if(countryAt(index,py,px)?.code===country.code)return[py,px];
    }
  }
  throw new Error('No physical test point for '+country.code);
}
async function hoverLocation(page: Page, lat: number, lon: number) {
  const canvas=page.locator(canvasSelector), box=(await canvas.boundingBox())!;
  const metrics=await canvas.evaluate(e=>({lat:Number(e.dataset.latitude),lon:Number(e.dataset.longitude),distance:Number(e.dataset.distance)}));
  const point=(lat:number,lon:number)=>new THREE.Vector3(Math.cos(lat*Math.PI/180)*Math.cos(lon*Math.PI/180),Math.sin(lat*Math.PI/180),-Math.cos(lat*Math.PI/180)*Math.sin(lon*Math.PI/180));
  const camera=new THREE.PerspectiveCamera(42,1,.1,20);
  camera.position.copy(point(metrics.lat,metrics.lon).multiplyScalar(metrics.distance));camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const p=point(lat,lon).project(camera);
  await page.mouse.move(box.x+(p.x+1)*box.width/2,box.y+(1-p.y)*box.height/2);
}

test('every country and island has a code-owned photo or an explicit unresolved coverage record',async({page})=>{
  test.setTimeout(240000);
  const catalog=manifest();
  expect(catalog.countries).toHaveLength(countries.length);
  expect(catalog.isoCodes.filter(code=>catalog.countries.find(c=>c.code===code)?.status!=='ready')).toEqual([]);
  await openGlobe(page);
  const card=page.locator('[data-country-photo]'),canvas=page.locator(canvasSelector);
  const failures:string[]=[];
  for(const country of countries){
    await focusCountry(page,country);
    await hoverLocation(page,...countryPoint(country));
    try {
      await expect(canvas).toHaveAttribute('data-hovered-country',country.code,{timeout:1500});
      const entry=catalog.countries.find(c=>c.code===country.code)!;
      if(entry.status==='ready'){
        await expect(card).toBeVisible({timeout:3000});
        await expect(card.locator('[data-photo-country]')).toHaveAttribute('data-photo-country',country.code);
        await expect(card.locator('[data-photo-country]')).toHaveAttribute('alt',/.+/);
        await expect(card.locator('[data-country-name]')).toHaveText(country.name);
        await expect(card).toHaveAttribute('data-country',country.code);
        const expectedFlag=discoveryCountryFlag(country.code);
        if(expectedFlag){
          await expect(card.locator('[data-flag-country]')).toHaveAttribute('data-flag-country',country.code);
          await expect(card.locator('[data-flag-country]')).toHaveAttribute('src',expectedFlag);
          expect(await card.locator('[data-flag-country]').evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        }else await expect(card.locator('[data-flag-country]')).toHaveCount(0);
        expect(await card.innerText()).toBe(country.name);
      }else{
        await expect(card).toBeHidden();
        expect(catalog.unresolved.some(c=>c.code===country.code)).toBe(true);
      }
      await expect(canvas).toHaveAttribute('data-outlined-country',country.code);
      expect(Number(await canvas.getAttribute('data-outline-segments'))).toBeGreaterThan(0);
      await expect(canvas).toHaveAttribute('data-lines','0');
      await expect(canvas).toHaveAttribute('data-points','0');
    }catch(error){failures.push(country.code+': '+String(error).slice(0,240));}
  }
  expect(failures).toEqual([]);
});

test('border and compact photo-name-flag card preserve layout and remove themselves on exit',async({page})=>{
  await page.setViewportSize({width:1440,height:1080});await openGlobe(page);
  const country=countries.find(c=>c.code==='PH')!;
  await focusCountry(page,country);await hoverLocation(page,14.6,120.98);
  const card=page.locator('[data-country-photo]'),canvas=page.locator(canvasSelector);
  await expect(card).toBeVisible();
  await expect(page.locator('[data-pin], [data-country-tooltip], #destination-preview-title, #discovery [role="tooltip"]')).toHaveCount(0);
  await expect(page.locator('#discovery')).not.toContainText('Illustrative flight paths');
  const frame=(await canvas.boundingBox())!,photo=(await card.boundingBox())!,intro=(await page.locator('#discovery-heading').boundingBox())!;
  expect(frame.width).toBeGreaterThan(500);expect(frame.x).toBeGreaterThan(intro.x+intro.width+30);
  expect(photo.x).toBeGreaterThanOrEqual(frame.x);expect(photo.y).toBeGreaterThanOrEqual(frame.y);
  expect(photo.x+photo.width).toBeLessThanOrEqual(frame.x+frame.width);expect(photo.y+photo.height).toBeLessThanOrEqual(frame.y+frame.height);
  expect(await card.evaluate(e=>getComputedStyle(e).pointerEvents)).toBe('none');
  await page.locator('#discovery').screenshot({path:'../audit/2026-10-15/globe-hover-identity/desktop-hover.png'});
  await page.mouse.move(2,2);await expect(card).toBeHidden();
  await expect(canvas).toHaveAttribute('data-outlined-country','');
  await expect(canvas).toHaveAttribute('data-outline-segments','0');
  expect(await canvas.boundingBox()).toEqual(frame);
  await page.getByText('Image and map credits',{exact:true}).click();
  await expect(page.locator('footer')).toContainText('Country photo coverage:');
  await expect(page.locator('footer a[href*="creativecommons.org/licenses/"]').first()).toBeVisible();
});

test('unresolved non-ISO area remains selectable and is reported without substituting an image',async({page})=>{
  await openGlobe(page);
  const country=countries.find(c=>c.code==='WD-Q620634')!;
  await focusCountry(page,country);await hoverLocation(page,...countryPoint(country));
  await expect(page.locator(canvasSelector)).toHaveAttribute('data-hovered-country',country.code);
  await expect(page.locator(canvasSelector)).toHaveAttribute('data-photo-status','unresolved');
  await expect(page.locator('[data-country-photo]')).toBeHidden();
  await page.getByText('Image and map credits',{exact:true}).click();
  await expect(page.locator('footer')).toContainText('Unresolved photographs: Bir Tawil');
  await expect(page.locator('footer')).toContainText('264 of 265 geographic areas');
});

test('stationary hover follows rotation, and cards never block drag or country selection',async({page})=>{
  await openGlobe(page);await focusCountry(page,countries.find(c=>c.code==='PH')!);await hoverLocation(page,14.6,120.98);
  const canvas=page.locator(canvasSelector),card=page.locator('[data-country-photo]');await expect(card).toBeVisible();
  await page.emulateMedia({reducedMotion:'no-preference'});await expect(canvas).toHaveAttribute('data-state','rotating');
  const before=Number(await canvas.getAttribute('data-longitude'));
  await expect(canvas).not.toHaveAttribute('data-hovered-country','PH',{timeout:12000});
  await expect(card).toBeHidden();expect(Number(await canvas.getAttribute('data-longitude'))).toBeGreaterThan(before+.1);
  await page.emulateMedia({reducedMotion:'reduce'});await focusCountry(page,countries.find(c=>c.code==='AU')!);await hoverLocation(page,-25.28,133.78);
  await expect(card).toBeVisible();await page.mouse.down();await expect(card).toBeHidden();await expect(canvas).toHaveAttribute('data-outlined-country','');
  const start=Number(await canvas.getAttribute('data-longitude'));
  const box=(await canvas.boundingBox())!;await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5,{steps:8});await page.mouse.up();
  await expect.poll(async()=>Math.abs(Number(await canvas.getAttribute('data-longitude'))-start)).toBeGreaterThan(5);
  await focusCountry(page,countries.find(c=>c.code==='JP')!);
  await page.getByRole('combobox',{name:'Discover a country or territory'}).selectOption('');await hoverLocation(page,35.7,139.7);await page.mouse.down();await page.mouse.up();
  await expect(page.getByRole('combobox',{name:'Discover a country or territory'})).toHaveValue('JPN');
});

test('same-country cached fallback survives primary failure and late responses never replace a new hover',async({page})=>{
  const france=manifest().countries.find(c=>c.code==='FR')!;expect(france.photos.length).toBeGreaterThan(1);
  await page.route('**'+france.photos[0].src,route=>route.abort());
  await openGlobe(page);await focusCountry(page,countries.find(c=>c.code==='FR')!);await hoverLocation(page,46.7,2.55);
  const card=page.locator('[data-country-photo]');await expect(card).toBeVisible();await expect(card.locator('[data-photo-country]')).toHaveAttribute('src',france.photos[1].src);
  await page.mouse.move(2,2);await expect(card).toBeHidden();
  await page.route('**/discovery/country-photos/*.webp',async route=>{if(route.request().url().includes('/BR-'))await new Promise(resolve=>setTimeout(resolve,700));await route.continue();});
  await focusCountry(page,countries.find(c=>c.code==='BR')!);await hoverLocation(page,-15.8,-47.9);
  await focusCountry(page,countries.find(c=>c.code==='KE')!);await hoverLocation(page,-1.29,36.82);
  await expect(card).toBeVisible();await expect(card.locator('[data-photo-country]')).toHaveAttribute('data-photo-country','KE');
  await expect(card.locator('[data-country-name]')).toHaveText(countries.find(c=>c.code==='KE')!.name);
  await expect(card.locator('[data-flag-country]')).toHaveAttribute('data-flag-country','KE');
  await expect(page.locator(canvasSelector)).toHaveAttribute('data-outlined-country','KE');
  await page.waitForTimeout(900);await expect(card.locator('[data-photo-country]')).toHaveAttribute('data-photo-country','KE');
});

test('rotation pause/resume, offscreen suspension, zoom and reduced motion remain usable',async({page})=>{
  await openGlobe(page,false);const canvas=page.locator(canvasSelector);await page.mouse.move(2,2);
  await expect(canvas).toHaveAttribute('data-state','rotating');const start=Number(await canvas.getAttribute('data-longitude'));
  await expect.poll(async()=>Number(await canvas.getAttribute('data-longitude'))).toBeGreaterThan(start+.3);
  await page.getByRole('button',{name:'Pause rotation',exact:true}).click();await expect(canvas).toHaveAttribute('data-state','paused');
  const paused=await canvas.getAttribute('data-longitude');await page.waitForTimeout(400);expect(await canvas.getAttribute('data-longitude')).toBe(paused);
  await page.getByRole('button',{name:'Resume rotation',exact:true}).click();await expect(canvas).toHaveAttribute('data-state','rotating');
  await page.emulateMedia({reducedMotion:'reduce'});await expect(canvas).toHaveAttribute('data-state','paused');
  for(let i=0;i<5;i++)await page.getByRole('button',{name:'Zoom in globe'}).click();await expect(canvas).toHaveAttribute('data-distance','2.90');
  for(let i=0;i<8;i++)await page.getByRole('button',{name:'Zoom out globe'}).click();await expect(canvas).toHaveAttribute('data-distance','4.10');
  await page.locator('#top').scrollIntoViewIfNeeded();await expect(canvas).toHaveAttribute('data-rendering','false');
});

test('country or WebGL failure remains explicit without fabricated photos',async({page})=>{
  await page.route('**/discovery/countries-10m.v5.1.2.json',route=>route.abort());await page.goto('/');await page.locator('#discovery').scrollIntoViewIfNeeded();
  await expect(page.getByText('Country discovery unavailable. Please try again later.')).toBeVisible();await expect(page.locator('[data-country-photo]')).toBeHidden();
  await page.unroute('**/discovery/countries-10m.v5.1.2.json');
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind:string,...args:unknown[]){if(/webgl/i.test(kind))return null;return original.apply(this,[kind,...args] as Parameters<typeof original>);} as typeof original;});
  await page.reload();await page.locator('#discovery').scrollIntoViewIfNeeded();await expect(page.getByText('Interactive globe unavailable in this browser.')).toBeVisible();
  await page.getByRole('combobox',{name:'Discover a country or territory'}).selectOption('NRU');await expect(page.getByRole('combobox',{name:'Discover a country or territory'})).toHaveValue('NRU');
});

test('mobile stacks within the viewport, keeps islands selectable and preserves touch drag/scroll',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try{
    const page=await context.newPage();await openGlobe(page,false);const canvas=page.locator(canvasSelector);await expect(canvas).toHaveAttribute('data-quality','reduced');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('combobox',{name:'Discover a country or territory'}).selectOption('TUV');await expect(canvas).toHaveAttribute('data-selected-country','TUV');
    await canvas.scrollIntoViewIfNeeded();const box=(await canvas.boundingBox())!,cdp=await context.newCDPSession(page);const before=await page.evaluate(()=>scrollY);
    const x=box.x+box.width/2,y=box.y+box.height*.75;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*25}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before+50);
    await canvas.scrollIntoViewIfNeeded();const h=(await canvas.boundingBox())!,lon=Number(await canvas.getAttribute('data-longitude'));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:h.x+h.width*.4,y:h.y+h.height*.5}]});
    for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:h.x+h.width*.4+i*12,y:h.y+h.height*.5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(async()=>Math.abs(Number(await canvas.getAttribute('data-longitude'))-lon)).toBeGreaterThan(10);
    await page.locator('#discovery').screenshot({path:'../audit/2026-10-15/globe-hover-identity/mobile.png'});
  }finally{await context.close();}
});
