import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

type Photo={src:string;alt:string;place:string;sourceUrl:string;evidence:string;licenseUrl:string;sourceDimensions:[number,number];crop:{left:number;top:number;width:number;height:number};focus:[number,number]};
type Entry={code:string;name:string;status:string;photos:Photo[]};
const catalog=JSON.parse(readFileSync(new URL('../public/discovery/country-photos.v2.json',import.meta.url),'utf8')) as {curationVersion:number;isoCodes:string[];countries:Entry[];unresolved:{code:string}[]};
const plan=JSON.parse(readFileSync(new URL('../scripts/discovery-photo-curation.json',import.meta.url),'utf8')) as {countries:Record<string,{excludePhotos?:{file:string;reason:string}[]}>};

test('every country retains an exact-code editorial plan and verified destination photo coverage',()=>{
 assert.equal(catalog.curationVersion,1);
 for(const c of catalog.countries){
  assert.ok(plan.countries[c.code],c.code+' review plan');
  assert.ok(c.photos.length||catalog.unresolved.some(gap=>gap.code===c.code),c.code+' explicit coverage');
  for(const p of c.photos){
   assert.ok(p.src.startsWith('/discovery/country-photos/'+c.code+'-'),c.code+' image ownership');
   assert.ok(p.place&&p.alt.endsWith(' — '+c.name),c.code+' meaningful source-specific alt text');
   assert.ok(p.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
   assert.match(p.evidence,/^https:\/\/(www.wikidata.org\/wiki\/Q|commons.wikimedia.org\/wiki\/File:)/);
   assert.ok(p.licenseUrl.startsWith('https://creativecommons.org/'));
   const key=decodeURIComponent(p.sourceUrl.split('/File:')[1]).replaceAll('_',' ').toLowerCase();
   assert.ok(!plan.countries[c.code].excludePhotos?.some(rejected=>rejected.file.replaceAll('_',' ').toLowerCase()===key),c.code+' rejected editorial choices stay excluded');
   assert.doesNotMatch(decodeURIComponent(p.sourceUrl).split('/File:')[1].replaceAll('_',' '),/\b(flag|flags|map|maps|logo|seal|stamps|Dannebrog|harta|Divisi.n Pol.tica|collage|montage)\b/i);
  }
 }
 for(const code of catalog.isoCodes)assert.equal(catalog.countries.find(c=>c.code===code)?.status,'ready',code+' ISO coverage');
});

test('all displayed photos and same-country alternatives are optimized uniform crops without source upscaling',async()=>{
 for(const c of catalog.countries)for(const p of c.photos){
  const file=new URL('../public'+p.src,import.meta.url),image=await sharp(fileURLToPath(file)).metadata();
  assert.equal(image.format,'webp',p.src);assert.equal(image.width,432,p.src);assert.equal(image.height,270,p.src);
  assert.ok(statSync(file).size<150000,p.src+' bounded image transfer');
  const [width,height]=p.sourceDimensions;
  assert.ok(width>=432&&height>=270,p.src+' sufficient native resolution');
  assert.ok(p.crop.left>=0&&p.crop.top>=0&&p.crop.left+p.crop.width<=width&&p.crop.top+p.crop.height<=height,p.src+' valid crop');
  assert.ok(p.crop.width>=432&&p.crop.height>=270,p.src+' no crop enlargement');
  assert.ok(p.focus.every(n=>n>=0&&n<=1),p.src+' normalized subject position');
 }
});
