import { handleResponse } from './api-response.ts';
import type { SavedTrip, DayActivity, ItineraryResponse, NavigationMode } from '@/lib/contracts';
export interface ManagedTripState { trip:SavedTrip & { itinerary:ItineraryResponse };revision:string;canManage:boolean }
export interface DayReplanPreview { token:string;revision:string;expiresAt:string;provider:'openai'|'gemini';dayIndex:number;activities:DayActivity[];warnings:string[];legs:{fromId:string;toId:string;minutes:number;source:'osrm'|'estimate'}[] }
export type ActivityAction='complete'|'skip'|'plan'|'edit'|'reschedule';
export async function managedTripRequest<T>(tripId:string,endpoint:string,body?:unknown,method='POST',signal?:AbortSignal):Promise<T> {
  const response=await fetch('/api/platform/trips/'+encodeURIComponent(tripId)+endpoint,{ method:body===undefined?'GET':method,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(100000)]):AbortSignal.timeout(100000),cache:'no-store' });
  return handleResponse<T>(response);
}
export function loadManagedTrip(tripId:string,signal:AbortSignal) { return managedTripRequest<ManagedTripState>(tripId,'/activities',undefined,'GET',signal); }
export function updateManagedActivity(tripId:string,activityId:string,revision:string,action:ActivityAction,changes:unknown,signal:AbortSignal) { return managedTripRequest<ManagedTripState>(tripId,'/activities/'+encodeURIComponent(activityId),{ revision,confirm:true,action,...(changes!==undefined?{changes}:{}) },'PATCH',signal); }
export function previewDayReplan(tripId:string,revision:string,dayIndex:number,fromTime:string,toTime:string,mode:NavigationMode,signal:AbortSignal) { return managedTripRequest<DayReplanPreview>(tripId,'/replan',{ revision,dayIndex,fromTime,toTime,mode },'POST',signal); }
export function acceptDayReplan(tripId:string,preview:DayReplanPreview,signal:AbortSignal) { return managedTripRequest<ManagedTripState>(tripId,'/replan/accept',{revision:preview.revision,token:preview.token,confirm:true},'POST',signal); }
