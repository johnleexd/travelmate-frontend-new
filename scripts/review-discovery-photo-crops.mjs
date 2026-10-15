import fs from 'node:fs';
import sharp from 'sharp';
const audit='../audit/2026-10-15/globe-photo-curation';
const manifest=JSON.parse(fs.readFileSync(process.argv.slice(2).find(value=>value.endsWith('.json'))||audit+'/candidate-manifest.json','utf8'));
const fallback=process.argv.includes('--fallback');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const perSheet=48,columns=6,tileWidth=240,tileHeight=182;
for(let start=0;start<manifest.countries.length;start+=perSheet){
 const list=manifest.countries.slice(start,start+perSheet),composite=[];
 for(let i=0;i<list.length;i++){
  const country=list[i],photo=country.photos[fallback?1:0],left=(i%columns)*tileWidth,top=Math.floor(i/columns)*tileHeight;
  if(photo)composite.push({input:await sharp('public'+photo.src).resize(240,150).toBuffer(),left,top});
  const label=escape(country.code+' '+country.name).slice(0,100),place=escape(photo?.place||(fallback?'NO ALTERNATE':'UNRESOLVED')).slice(0,110);
  const svg=Buffer.from(`<svg width="240" height="32"><rect width="240" height="32" fill="white"/><text x="4" y="12" font-family="Arial" font-size="10">${label}</text><text x="4" y="26" font-family="Arial" font-size="9" fill="#444">${place}</text></svg>`);
  composite.push({input:svg,left,top:top+150});
 }
 await sharp({create:{width:columns*tileWidth,height:Math.ceil(list.length/columns)*tileHeight,channels:3,background:'#e3e3e3'}}).composite(composite).jpeg({quality:91}).toFile(audit+'/'+(fallback?'fallback-':'')+'contact-'+(start/perSheet+1)+'.jpg');
}
console.log('Created',Math.ceil(manifest.countries.length/perSheet),'review sheets');
