import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stayPreferenceScore} from '../lib/stay-preferences.ts';
test('stay preference ranks reported metadata independently of style and unknown prices',()=>{
 const resort={name:'Reported resort',type:'Resort',rating:4,distanceKm:8};
 const hostel={name:'Reported hostel',type:'Hostel',rating:2,distanceKm:1};
 assert.ok(stayPreferenceScore(resort,'resort','budget')>stayPreferenceScore(hostel,'resort','budget'));
 assert.ok(stayPreferenceScore(hostel,'budget-friendly','luxury')>stayPreferenceScore(resort,'budget-friendly','luxury'));
 for(const style of ['budget','balanced','comfort','luxury','family-friendly'])assert.ok(Number.isFinite(stayPreferenceScore(hostel,'no preference',style)));
 assert.ok(stayPreferenceScore(hostel,'central location','comfort')>stayPreferenceScore(resort,'central location','comfort'));
 assert.ok(stayPreferenceScore({...hostel,amenities:['Family rooms','Kitchen']},'family-friendly','balanced')>stayPreferenceScore(hostel,'family-friendly','balanced'));
});
