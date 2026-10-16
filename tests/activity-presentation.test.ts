import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityPresentation, shortWeatherWarning } from '../lib/activity-presentation.ts';
import type { DayActivity } from '../lib/contracts.ts';

const item = { title:'Visit Casa Gorordo Museum',description:'Nearby attraction — Municipality unconfirmed; outside Cordova. 7.51 km straight-line from the selected city centre; 53 minutes each way using selected road transport at an assumed 20 km/h, including a 30-minute buffer. Return time is reserved; confirm the actual route and transport. Opening hours need confirmation. Historic house and museum in Cebu City, Philippines. Suggested 120-minute visit. Allow at least 32 minutes from the previous stop (estimate). Address: Eduardo Aboitiz Street.', category:'activity', time:'09:53 AM',durationMinutes:120, estimatedCost:0,icon:'map',place:{ city:'Locality unconfirmed', country:'Philippines', locationScope:'nearby', openingHours:'Opening hours need confirmation' } } as DayActivity;
test('legacy descriptions are shortened without mutating their stored details or qualifications',()=>{
  const before=JSON.stringify(item), result=activityPresentation(item);
  assert.equal(result.description,'Historic house and museum in Cebu City, Philippines.');
  assert.deepEqual(result.badges,['Outside selected destination','Location unconfirmed','Hours unverified','Route unverified']);
  assert.equal(result.location,'');assert.equal(JSON.stringify(item),before);
  assert.equal(activityPresentation({...item,description:item.description+' Ballesteros Street. Cebu City.'}).description,result.description);
});
test('qualified locations stay accurate; user locations never become verified claims',()=>{
  const known={...item,description:'A museum with local history.',place:{...item.place!,city:'Cebu City',openingHours:'09:00–17:00'}};
  assert.equal(activityPresentation(known).location,'Cebu City, Philippines');
  assert.deepEqual(activityPresentation(known).badges,['Outside selected destination']);
  const manual={...known,place:undefined,location:'My meeting point'};
  assert.equal(activityPresentation(manual).location,'Entered location: My meeting point');
  assert.ok(activityPresentation(manual).badges.includes('Location unconfirmed'));
});
test('long natural descriptions stay concise and weather cautions are combined without changing source text',()=>{
  const description='A gallery featuring local painters and sculpture. '.repeat(10);
  assert.ok(activityPresentation({...item,description}).description.length<=180);
  const alerts=['Heavy rain and strong winds expected. Keep plans flexible.','Heavy rain and strong winds expected. Keep plans flexible.'];
  assert.equal(shortWeatherWarning(alerts),'Rain risk · Strong winds. Check weather details.');
  assert.equal(alerts[0],'Heavy rain and strong winds expected. Keep plans flexible.');
});
