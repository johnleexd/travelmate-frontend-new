// Isolated browser verification: real public catalogue services, dummy user, empty
// hotel fixture. It never queries user records or persists a generated trip.
import fs from 'node:fs';
import http from 'node:http';
import { searchGlobalLocationsPage } from '../../travelmate-backend-api/src/services/destination/global-location-search.ts';
import { searchDestinationAreas, selectedAreaParent } from '../../travelmate-backend-api/src/services/destination/destination-areas.ts';
import { resolveDestination } from '../../travelmate-backend-api/src/services/destination/location-resolution.ts';
import { resolveAdministrativeLocation } from '../../travelmate-backend-api/src/services/destination/philippine-catalogue.ts';
import { resolveDestinationContext } from '../../travelmate-backend-api/src/services/destination/destination-context-service.ts';
import { validateDestinationAnchor } from '../../travelmate-backend-api/src/services/itinerary/grounded-places.ts';
const audit = '../audit/2026-10-14/worldwide-locations';
const noProvider = async () => { throw Error('Unresolved coordinates need a live geocoder; this isolated UI verification uses the stored official crosswalk.'); };
const user = { id:'administrative-ui-fixture', name:'UI Test Traveler', email:'ui@example.test', role:'traveler', accountStatus:'active', emailVerified:true };
const workspace = { user, trips:[],notifications:[],listings:[],bookings:[],itineraryVersions:[],itineraryGenerations:[],directory:[],moderation:[],audit:[] };
const requests=[];
const record = entry => { requests.push(entry); fs.writeFileSync(audit+'/browser-requests.json',JSON.stringify(requests,null,2)); };
const reply=(response,status,value)=>{response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(value));};
const proxy=http.createServer(async(request,response)=>{
  const url=new URL(request.url||'/','http://localhost:3005');
  if(url.pathname.startsWith('/api/')) {
    try {
      const params=url.searchParams;
      if(url.pathname==='/api/itinerary' && request.method==='POST') {
        let text=''; for await(const chunk of request) text+=chunk;
        const body=JSON.parse(text); const accepted=await validateDestinationAnchor(body.destination,body.destinationDetails,body.latitude,body.longitude,noProvider);
        record({kind:'generation',destination:body.destination,selected:accepted,validated:true});
        reply(response,503,{error:'The selected location passed generation validation. This isolated verification does not generate or save a trip.'});return;
      }
      if(request.method!=='GET' && request.method!=='HEAD') {reply(response,403,{error:'Isolated verification does not write account or trip records.'});return;}
      if(url.pathname==='/api/platform') {reply(response,200,workspace);return;}
      if(url.pathname==='/api/auth') {reply(response,200,{user});return;}
      if(url.pathname==='/api/locations') {reply(response,200,await searchGlobalLocationsPage(params.get('q')||'',Number(params.get('offset')||0),noProvider));return;}
      if(url.pathname==='/api/locations/areas') {const data=await searchDestinationAreas(selectedAreaParent(Number(params.get('parentId')),params.get('countryCode')||''),params.get('query')||'',Number(params.get('offset')||0),noProvider);record({kind:'area',query:params.get('query')||'',offset:Number(params.get('offset')||0),total:data.total,ids:data.areas.map(p=>p.administrativeCode)});reply(response,200,data);return;}
      if(url.pathname==='/api/locations/resolve') {reply(response,200,params.has('locationId')?{location:await resolveAdministrativeLocation(Number(params.get('locationId')),params.get('countryCode')||'',noProvider),candidates:[],areas:[],message:''}:await resolveDestination(params.get('q')||'',noProvider,params.get('secondary')==='true'));return;}
      if(url.pathname==='/api/destination-context') {reply(response,200,resolveDestinationContext(params.get('countryCode')||'',params.get('city')||''));return;}
      if(url.pathname==='/api/accommodations') {record({kind:'accommodations',parameters:Object.fromEntries(params)});reply(response,200,{configured:false,accommodations:[],nearbyAccommodations:[],providerAccommodations:[],status:'no-results',message:'No accommodation results in this isolated verification. Your destination remains selected; choose accommodation later.'});return;}
      reply(response,503,{error:'Unavailable in isolated verification.'});return;
    } catch(error) {reply(response,400,{error:error.message});return;}
  }
  const target=http.request({hostname:'127.0.0.1',port:3000,path:request.url,method:request.method,headers:{...request.headers,host:'localhost:3000',origin:'http://localhost:3000',cookie:'travelmate_session=isolated-administrative-ui-fixture'}},upstream=>{
    const headers={...upstream.headers,'cache-control':'no-store'};delete headers['set-cookie'];response.writeHead(upstream.statusCode||502,headers);upstream.pipe(response);
  });target.on('error',()=>{response.writeHead(502);response.end('Local frontend unavailable');});request.pipe(target);
});
proxy.on('upgrade',(request,socket,head)=>{
  const target=http.request({hostname:'127.0.0.1',port:3000,path:request.url,headers:{...request.headers,host:'localhost:3000',origin:'http://localhost:3000'}});
  target.on('upgrade',(upstream,remote,extra)=>{
    socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(upstream.headers).map(([k,v])=>`${k}: ${v}\r\n`).join('')+'\r\n');
    if(head.length)remote.write(head);if(extra.length)socket.write(extra);remote.pipe(socket);socket.pipe(remote);
    remote.on('error',()=>socket.destroy());socket.on('error',()=>remote.destroy());
  });target.on('error',()=>socket.destroy());target.end();
});
proxy.listen(3005,'127.0.0.1',()=>console.log('Administrative selector verification: http://localhost:3005/dashboard?tab=planner'));
const stop=setInterval(()=>{if(fs.existsSync(audit+'/stop-browser')){clearInterval(stop);proxy.close();proxy.closeAllConnections();process.exit(0);}},1500);
