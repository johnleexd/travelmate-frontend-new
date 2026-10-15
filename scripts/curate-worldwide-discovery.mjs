// Reviewed, reproducible photo choices. Run after prepare-worldwide-discovery.mjs.
// Provider responses and originals are cached; only a complete snapshot is published.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, execFile } from 'node:child_process';
import sharp from 'sharp';
import { countryAt, indexCountries } from '../lib/discovery-countries.ts';

const audit = path.resolve('../audit/2026-10-15/globe-photo-curation');
const cache = path.resolve('../audit/2026-10-15/globe-worldwide/provider-cache');
fs.mkdirSync(audit, {recursive:true}); fs.mkdirSync(cache, {recursive:true});
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const atomic = (file, value) => {fs.writeFileSync(file+'.tmp', JSON.stringify(value));fs.renameSync(file+'.tmp',file);};
const hash = value => createHash('sha256').update(value).digest('hex');
const plain = value => typeof value === 'string' ? value.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/\s+/g,' ').trim() : '';
const claims = (entity, property) => (entity?.claims?.[property]||[]).filter(c=>c.rank!=='deprecated'&&!c.qualifiers?.P582).map(c=>c.mainsnak?.datavalue?.value).filter(v=>v!==undefined);
function json(host, params) {
  const url=host+'/w/api.php?'+new URLSearchParams({format:'json',...params});
  const file=path.join(cache,hash(url)+'.json');
  if(!fs.existsSync(file)){
    execFileSync('curl.exe',['-fsSL','--retry','1','--retry-max-time','20','--max-time','30','-A','TravelMate/1.0 destination-photo-curation','-o',file+'.partial',url],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    fs.renameSync(file+'.partial',file);
  }
  const data=read(file);if(data.error)throw new Error(JSON.stringify(data.error));return data;
}
const entities={}, metadata=new Map();
for(const file of fs.readdirSync(cache).filter(f=>f.endsWith('.json'))){
  const data=read(path.join(cache,file));Object.assign(entities,data.entities||{});
  for(const page of Object.values(data.query?.pages||{}))if(page.imageinfo?.[0])metadata.set(page.title.replaceAll('_',' '),page);
  for(const redirect of [...(data.query?.redirects||[]),...(data.query?.normalized||[])].reverse())if(metadata.has(redirect.to))metadata.set(redirect.from.replaceAll('_',' '),metadata.get(redirect.to));
}
const manifestPath='public/discovery/country-photos.v2.json';
const before=read(manifestPath), countries=read('public/discovery/countries-10m.v5.1.2.json'), index=indexCountries(countries);
const plan=read('scripts/discovery-photo-curation.json');
if(countries.some(c=>!plan.countries[c.code]))throw new Error('Every geographic identity must have a reviewed photo plan');
// Batch exact English article identities instead of issuing a search per country.
// Failed/disambiguated identities are rejected below, never guessed from labels.
const unresolvedQueries=[...new Set(Object.values(plan.countries).flatMap(c=>(c.landmarks||[]).filter(l=>!l.id).map(l=>l.query)))];
const resolvedQueries=new Map();
for(let offset=0;offset<unresolvedQueries.length;offset+=30){
  const titles=unresolvedQueries.slice(offset,offset+30);
  const response=json('https://en.wikipedia.org',{action:'query',titles:titles.join('|'),redirects:'1',prop:'pageprops',ppprop:'wikibase_item'}).query||{};
  const pages=new Map(Object.values(response.pages||{}).filter(p=>p.pageprops?.wikibase_item).map(p=>[p.title,p.pageprops.wikibase_item]));
  for(const redirect of [...(response.redirects||[]),...(response.normalized||[])].reverse())if(pages.has(redirect.to))pages.set(redirect.from,pages.get(redirect.to));
  for(const [title,id] of pages)resolvedQueries.set(title.toLowerCase(),id);
  console.log('Landmark identity batch',Math.min(offset+30,unresolvedQueries.length),'/',unresolvedQueries.length);
}
for(const review of Object.values(plan.countries))for(const landmark of review.landmarks||[])if(!landmark.id)landmark.id=resolvedQueries.get(landmark.query.toLowerCase());
const ids=[...new Set(Object.values(plan.countries).flatMap(c=>(c.landmarks||[]).map(l=>l.id)))].filter(id=>/^Q\d+$/.test(id||'')&&!entities[id]);
for(let offset=0;offset<ids.length;offset+=35)Object.assign(entities,json('https://www.wikidata.org',{action:'wbgetentities',ids:ids.slice(offset,offset+35).join('|'),props:'claims|labels',languages:'en'}).entities);
const candidates=[], identityRejected=[];
for(const country of countries){
  const review=plan.countries[country.code];
  for(const landmark of review.landmarks||[]){
    const entity=entities[landmark.id];
    const member=claims(entity,'P17').some(v=>v.id===country.wikidataId);
    const administered=claims(entity,'P131').some(v=>v.id===country.wikidataId);
    const coordinate=claims(entity,'P625')[0];
    const within=coordinate&&countryAt(index,coordinate.latitude,coordinate.longitude)?.code===country.code;
    // Match the entity's country claim or its physical location against our exact hit geometry.
    if(!member&&!administered&&!within){identityRejected.push({code:country.code,id:landmark.id,label:entity?.labels?.en?.value,reason:'Country membership and physical location did not match'});continue;}
    for(const file of claims(entity,'P18'))if(typeof file==='string')candidates.push({code:country.code,file,evidence:`https://www.wikidata.org/wiki/${landmark.id}#${member?'P17':administered?'P131':'P625'}`,origin:'reviewed-landmark',place:entity.labels?.en?.value||landmark.place,focus:landmark.focus||[.5,.5]});
  }
  for(const choice of review.photos||[])candidates.push({code:country.code,...choice,origin:'reviewed-destination'});
  for(const capital of claims(entities[country.wikidataId],'P36')){
    const entity=entities[capital.id];
    if(!claims(entity,'P17').some(v=>v.id===country.wikidataId))continue;
    for(const file of claims(entity,'P18'))if(typeof file==='string')candidates.push({code:country.code,file,evidence:`https://www.wikidata.org/wiki/${capital.id}#P17`,origin:'verified-capital',place:entity.labels?.en?.value||country.name,focus:[.5,.48]});
  }
}
const fileKey=file=>file.replaceAll('_',' ').toLowerCase();
const preference=candidate=>{
  const choices=plan.countries[candidate.code].preferredFiles||[];
  const found=choices.findIndex(file=>fileKey(file)===fileKey(candidate.file));
  return found<0?choices.length:found;
};
candidates.sort((a,b)=>preference(a)-preference(b));
const files=[...new Set(candidates.map(c=>'File:'+c.file.replaceAll('_',' ')))];
const missing=files.filter(f=>!metadata.has(f));
for(let offset=0;offset<missing.length;offset+=20){
  const data=json('https://commons.wikimedia.org',{action:'query',titles:missing.slice(offset,offset+20).join('|'),prop:'imageinfo',iiprop:'url|extmetadata|mime|size',iiurlwidth:'1280',redirects:'1'});
  for(const page of Object.values(data.query?.pages||{}))if(page.imageinfo?.[0])metadata.set(page.title.replaceAll('_',' '),page);
  for(const redirect of [...(data.query?.redirects||[]),...(data.query?.normalized||[])].reverse())if(metadata.has(redirect.to))metadata.set(redirect.from.replaceAll('_',' '),metadata.get(redirect.to));
  console.log('New photo metadata',Math.min(offset+20,missing.length),'/',missing.length);
}
const rejected=[], changed=[], pending=new Map();
function download(url){
  const file=path.join(cache,hash(url)+'.image');
  const isPhoto=file=>{const data=fs.readFileSync(file).subarray(0,16);return data[0]===255&&data[1]===216&&data[2]===255||data.subarray(1,4).toString()==='PNG'||data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP';};
  if(fs.existsSync(file)){if(isPhoto(file))return Promise.resolve(file);fs.unlinkSync(file);}
  if(pending.has(file))return pending.get(file);
  const canonical=new URL(url);canonical.search='';
  const request=new Promise((resolve,reject)=>{
    const endpoints=[canonical.href];
    if(canonical.pathname.includes('/commons/thumb/'))endpoints.push(canonical.href.replace(/\/\/(?:upload|thumb)\.wikimedia\.org/,canonical.hostname==='upload.wikimedia.org'?'//thumb.wikimedia.org':'//upload.wikimedia.org'));
    function attempt(at){execFile('curl.exe',['-fsSL','--max-time','18','-A','TravelMate/1.0 destination-photo-cache','-o',file+'.partial',endpoints[at]],{windowsHide:true},(error,stdout,stderr)=>{
      if(error){if(at+1<endpoints.length){attempt(at+1);return;}pending.delete(file);reject(new Error(stderr?.trim()||error.message));}
      else if(!isPhoto(file+'.partial')){fs.unlinkSync(file+'.partial');pending.delete(file);reject(new Error('Image endpoint returned a non-photo response'));}
      else{fs.renameSync(file+'.partial',file);resolve(file);}
    });}attempt(0);
  });pending.set(file,request);return request;
}
const result={...before,preparedAt:new Date().toISOString(),curationVersion:1,countries:[],unresolved:[]};
let next=0;
await Promise.all(Array.from({length:4},async()=>{
 while(next<countries.length){
  const country=countries[next++],review=plan.countries[country.code];
  const entry={code:country.code,id:country.id,name:country.name,wikidataId:country.wikidataId,status:'unresolved',photos:[]};
  for(const candidate of candidates.filter(c=>c.code===country.code&&!(review.excludePhotos||[]).some(e=>fileKey(e.file)===fileKey(c.file)))){
   const page=metadata.get('File:'+candidate.file.replaceAll('_',' ')),info=page?.imageinfo?.[0],meta=info?.extmetadata||{};
   const creator=plain(meta.Artist?.value),license=plain(meta.LicenseShortName?.value),description=plain(meta.ImageDescription?.value),categories=plain(meta.Categories?.value);
   const gpsLat=Number(meta.GPSLatitude?.value),gpsLon=Number(meta.GPSLongitude?.value);
   const photographedCountry=Number.isFinite(gpsLat)&&Number.isFinite(gpsLon)?countryAt(index,gpsLat,gpsLon):null;
   const forbidden=/\b(flag|flags|coat of arms|locator|map|logo|seal|drawing|illustration|collage|montage|stamps|Dannebrog|harta|political division|divisi.n pol.tica)\b/i;
   const satellite=/satellite|landsat|blue marble|from (?:the )?(?:ISS|space)|ISS\d|^ISS-/i;
   const permission=plain(meta.Permission?.value);
   const originalYear=plain(meta.DateTimeOriginal?.value).match(/\b(1[789]\d{2}|20\d{2})\b/);
   const invalid=!info||!creator||! /^(CC BY(?:-SA)? [\d.]+|CC0(?: 1\.0)?|Public domain)$/i.test(license)||plain(meta.Restrictions?.value)||!/^image\/(jpeg|png|webp)$/.test(info.mime||'')
    ||forbidden.test(candidate.file.replaceAll('_',' '))||/(?:^|\|)(?:Maps of|Locator maps|Topographic maps|Political maps|National flags|Flags of)\b/i.test(categories)
    ||/\b(AI.generated|AI generated|drawing|illustration|engraving|lithograph|watercolou?r|oil on canvas|locator map|political map)\b/i.test(description)
    ||/(?:^|\|)(?:Engravings|Lithographs|Paintings|Black and white photographs|Historical photographs)\b/i.test(categories)
    ||/man carries a huge hammerhead|close-up|Sao Tome banner Eggs|Turkmenistan banner Carpets|Japanese lanterns/i.test(candidate.file.replaceAll('_',' '))
    ||(!country.code.startsWith('WD-')&&satellite.test(candidate.file+' '+description+' '+categories))
    ||/always.{0,30}visible|on the picture|in the picture|on the image|immediately next to|in close relation to the image/i.test(permission)
    ||Math.min(info.width||0,info.height||0)<270||(!candidate.allowPortrait&&(info.width||0)<(info.height||0))
    ||(originalYear&&Number(originalYear[1])<1980)
    // Camera coordinates can sit across a border while depicting a verified landmark
    // (e.g. St Peter's Basilica photographed from Rome). Verify the subject identity.
    ||(!country.code.startsWith('WD-')&&candidate.origin==='reviewed-destination'&&photographedCountry&&photographedCountry.code!==country.code);
   if(invalid){rejected.push({code:country.code,file:candidate.file,reason:'Photo, source resolution or reusable-license validation failed'});continue;}
   if(entry.photos.some(p=>p.sourceUrl===info.descriptionurl))continue;
   try{
    // Wide banners at 960px are only ~137px high. Use their native originals instead of upscaling.
    let src=info.thumbheight>=300?info.thumburl:info.url;
    if(!/^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//.test(src||''))continue;
    let original;
    try{original=await download(src);}catch{
      // Use an actual, supported-size image transform, never a page redirect.
      const source=new URL(info.url),width=info.width/info.height>4?1920:960;
      const filename=source.pathname.split('/').at(-1);
      source.hostname='thumb.wikimedia.org';source.search='';
      source.pathname=source.pathname.replace('/commons/','/commons/thumb/')+'/'+width+'px-'+filename;
      src=source.href;original=await download(src);
    }
    const focus=candidate.focus||[.5,.5];
    const filename=country.code+'-'+hash(src+':landmark-focus-432x270-v3:'+focus.join(',')).slice(0,12)+'.webp';
    const output='public/discovery/country-photos/'+filename;
    const image=sharp(original).rotate(),dimensions=await image.metadata();
    const width=dimensions.autoOrient?.width||dimensions.width,height=dimensions.autoOrient?.height||dimensions.height;
    if(width<432||height<270)throw new Error('Source too small for a sharp 432x270 card');
    const cropWidth=Math.round(Math.min(width,height*1.6)),cropHeight=Math.round(cropWidth/1.6);
    const left=Math.max(0,Math.min(width-cropWidth,Math.round(width*focus[0]-cropWidth/2)));
    const top=Math.max(0,Math.min(height-cropHeight,Math.round(height*focus[1]-cropHeight/2)));
    if(!fs.existsSync(output))await image.extract({left,top,width:cropWidth,height:cropHeight}).resize(432,270,{fit:'cover',withoutEnlargement:true}).webp({quality:84,effort:5}).toFile(output);
    const cc=license.match(/^CC (BY(?:-SA)?) ([\d.]+)$/i),licenseUrl=cc?`https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/`:/^CC0/.test(license)?'https://creativecommons.org/publicdomain/zero/1.0/':'https://creativecommons.org/publicdomain/mark/1.0/';
    const title=plain(meta.ObjectName?.value)||candidate.file;
    entry.photos.push({src:'/discovery/country-photos/'+filename,providerUrl:src,title,alt:`${candidate.place||review.place} — ${country.name}`,creator,license,licenseUrl,sourceUrl:info.descriptionurl,evidence:candidate.evidence,origin:candidate.origin,description:description.slice(0,1200),place:candidate.place||review.place,focus,sourceDimensions:[width,height],crop:{left,top,width:cropWidth,height:cropHeight},changes:'Subject-focused crop, resized to 432 × 270 without upscaling, encoded as WebP; adaptations retain the linked license.'});
    if(entry.photos.length>=2)break;
   }catch(error){rejected.push({code:country.code,file:candidate.file,reason:error.message.slice(0,250)});}
  }
  if(entry.photos.length)entry.status='ready';else result.unresolved.push({code:country.code,name:country.name,reason:review.reason||'No suitable sharp destination photo verified; no unrelated substitute'});
  if(before.countries.find(c=>c.code===country.code)?.photos[0]?.sourceUrl!==entry.photos[0]?.sourceUrl)changed.push(country.code);
  result.countries.push(entry);atomic(path.join(audit,'progress.json'),result);console.log(country.code,entry.status,entry.photos.length,entry.photos[0]?.place||'');
 }
}));
result.countries.sort((a,b)=>a.name.localeCompare(b.name,'en'));result.unresolved.sort((a,b)=>a.name.localeCompare(b.name,'en'));
atomic(path.join(audit,'candidate-manifest.json'),result);
atomic(path.join(audit,'review-results.json'),{total:countries.length,ready:result.countries.filter(c=>c.status==='ready').length,changed,identityRejected,rejected,unresolved:result.unresolved});
// Never reduce existing ISO country coverage on an incomplete provider run.
const missingIso=result.isoCodes.filter(code=>result.countries.find(c=>c.code===code)?.status!=='ready');
const lostCoverage=before.countries.filter(c=>c.status==='ready'&&result.countries.find(entry=>entry.code===c.code)?.status!=='ready').map(c=>c.code);
if(missingIso.length||lostCoverage.length){console.error('NOT PUBLISHED. ISO photo gaps:',missingIso.join(', '),'New geographic-area gaps:',lostCoverage.join(', '));process.exitCode=1;}
else if(process.argv.includes('--publish')){atomic(manifestPath,result);console.log('PUBLISHED',result.countries.filter(c=>c.status==='ready').length,'/',result.total,'source choices changed',changed.length);}
else console.log('READY FOR VISUAL REVIEW',result.countries.filter(c=>c.status==='ready').length,'/',result.total,'source choices changed',changed.length);
