import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const countries=JSON.parse(readFileSync(new URL('../public/discovery/countries-10m.v5.1.2.json',import.meta.url),'utf8')) as {id:string;code:string}[];

test('the complete selector exposes microstates and islands without restoring globe markers',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.locator('#discovery').scrollIntoViewIfNeeded();
  const picker=page.getByRole('combobox',{name:'Discover a country or territory'}),canvas=page.locator('#discovery canvas');
  await expect(picker).toBeEnabled();await expect(picker.locator('option')).toHaveCount(countries.length+1);
  for(const code of ['NR','TV','VA','MC','MT','SG','MV','KI','UM','XK']){
    const id=countries.find(c=>c.code===code)!.id;await picker.selectOption(id);await expect(canvas).toHaveAttribute('data-selected-country',id);
    await expect(canvas).toHaveAttribute('data-lines','0');await expect(canvas).toHaveAttribute('data-points','0');
  }
  await expect(page.locator('[data-pin], [data-country-tooltip], #destination-preview-title')).toHaveCount(0);
});

test('desktop columns and small-screen stacking have no overflow or navigation overlap',async({page})=>{
  for(const width of [1920,1440,1024,900,768,390,320]){
    await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
    await page.locator('#discovery').evaluate(e=>e.scrollIntoView({block:'start'}));await expect(page.locator('#discovery canvas')).toHaveAttribute('data-ready','true');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const intro=(await page.locator('#discovery-heading').locator('..').boundingBox())!,canvas=(await page.locator('#discovery canvas').boundingBox())!;
    if(width<=900)expect(canvas.y).toBeGreaterThan(intro.y+intro.height);else expect(canvas.x).toBeGreaterThan(intro.x+intro.width);
    const header=(await page.locator('header').first().boundingBox())!,label=(await page.getByText('Explore the World · Interactive Travel Discovery',{exact:true}).boundingBox())!;
    expect(label.y).toBeGreaterThan(header.y+header.height);
    await page.locator('#discovery').screenshot({path:'../audit/2026-10-15/globe-worldwide/width-'+width+'.png',style:'nextjs-portal {visibility:hidden!important}'});
  }
});
