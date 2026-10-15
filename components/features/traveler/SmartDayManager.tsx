'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { NavigationMode } from '@/lib/contracts';
import { acceptDayReplan, loadManagedTrip, previewDayReplan, updateManagedActivity, type ActivityAction, type DayReplanPreview, type ManagedTripState } from '@/services/smart-itinerary.service';
import { timelineSchedule, timelineCost } from '@/lib/trip-map-timeline';
import styles from './SavedTripMap.module.css';
const label=(status:string)=>status[0].toUpperCase()+status.slice(1);
export function SmartDayManager({tripId,dayIndex,selectedActivityId,selectedIndex,mode,onSaved}:{tripId:string;dayIndex:number;selectedActivityId?:string;selectedIndex:number;mode:NavigationMode;onSaved:(state:ManagedTripState,activityId?:string)=>void}) {
  const [state,setState]=useState<ManagedTripState|null>(null),[attempt,setAttempt]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [action,setAction]=useState<{type:ActivityAction;activityId:string}|null>(null),[replanDay,setReplanDay]=useState<number|null>(null),[preview,setPreview]=useState<DayReplanPreview|null>(null);
  const active=useRef(true),locked=useRef(false),controller=useRef<AbortController|null>(null);
  useEffect(()=> {
    active.current=true; const loading=new AbortController();
    void loadManagedTrip(tripId,loading.signal).then(value=> {
      if(!value.trip||value.trip.id!==tripId||!Array.isArray(value.trip.itinerary?.days)||!value.revision) throw new Error('This management view does not match the selected saved trip.');
      if(!loading.signal.aborted){setState(value);setError('');}
    }).catch(reason=>{if(!loading.signal.aborted)setError(reason instanceof Error?reason.message:'Activity management could not load.');});
    return ()=>{active.current=false;loading.abort();controller.current?.abort();};
  },[tripId,attempt]);
  const day=state?.trip.itinerary.days[dayIndex],selected=selectedActivityId?day?.activities.find(activity=>activity.id===selectedActivityId):day?.activities[selectedIndex];
  const selectedAction=action?.activityId===selected?.id?action:null,currentPreview=preview?.dayIndex===dayIndex?preview:null;
  const canManage=state?.canManage===true,selectedStatus=selected?.status||'planned';
  async function run<T>(work:(signal:AbortSignal)=>Promise<T>,success:(value:T)=>void) {
    if(locked.current)return;locked.current=true;setBusy(true);setError('');const request=new AbortController();controller.current=request;
    try {const result=await work(request.signal);if(active.current&&!request.signal.aborted)success(result);}
    catch(reason){if(active.current&&!request.signal.aborted)setError(reason instanceof Error?reason.message:'This change could not be saved. Your itinerary remains available.');}
    finally{if(controller.current===request){locked.current=false;if(active.current)setBusy(false);}}
  }
  function startAction(type:ActivityAction){if(!selected?.id||busy)return;setAction({type,activityId:selected.id});setReplanDay(null);setPreview(null);setError('');}
  function submitActivity(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!state||!selected?.id||!selectedAction)return;
    const fields=new FormData(event.currentTarget),type=selectedAction.type;
    const changes=type==='reschedule'?{dayIndex:Number(fields.get('dayIndex')),time:String(fields.get('time')||''),...(fields.get('durationMinutes')?{durationMinutes:Number(fields.get('durationMinutes'))}:{})}:type==='edit'?{title:String(fields.get('title')||''),time:String(fields.get('time')||''),description:String(fields.get('description')||''),location:String(fields.get('location')||''),estimatedCost:Number(fields.get('estimatedCost')),...(fields.get('durationMinutes')?{durationMinutes:Number(fields.get('durationMinutes'))}:{})}:undefined;
    const id=selected.id;
    void run(signal=>updateManagedActivity(tripId,id,state.revision,type,changes,signal),value=>{setState(value);setAction(null);onSaved(value,id);});
  }
  function submitReplan(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!state)return;const fields=new FormData(event.currentTarget);
    void run(signal=>previewDayReplan(tripId,state.revision,dayIndex,String(fields.get('fromTime')),String(fields.get('toTime')),mode,signal),value=>{if(value.dayIndex!==dayIndex||value.revision!==state.revision)throw new Error('This day preview is out of date.');setPreview(value);});
  }
  function cancelPreview(){if(busy){controller.current?.abort();locked.current=false;setBusy(false);}setPreview(null);setReplanDay(null);setError('');}
  return <section className={styles.management} aria-label="Smart itinerary management" aria-busy={busy}>
    <div className={styles.managementHeading}><strong>Manage your day</strong><button type="button" disabled={!canManage||busy} onClick={()=>{setReplanDay(dayIndex);setAction(null);setPreview(null);setError('');}}>Replan My Day</button></div>
    {!state&&!error&&<p role="status">Loading activity controls…</p>}
    {state&&!canManage&&<p>Reopen this trip to change its activities. Your historical itinerary remains available.</p>}
    {selected&&<><p><strong>{selected.title}</strong> · {label(selectedStatus)}</p><div className={styles.managementActions}>
      {selectedStatus==='completed'?<button type="button" disabled={!canManage||busy} onClick={()=>startAction('plan')}>Undo completion</button>:<button type="button" disabled={!canManage||busy} onClick={()=>startAction('complete')}>Mark as Completed</button>}
      {selectedStatus==='skipped'?<button type="button" disabled={!canManage||busy} onClick={()=>startAction('plan')}>Restore to Planned</button>:<button type="button" disabled={!canManage||busy||selectedStatus==='completed'} onClick={()=>startAction('skip')}>Skip Activity</button>}
      <button type="button" disabled={!canManage||busy||selectedStatus==='completed'} onClick={()=>startAction('edit')}>Edit Activity</button><button type="button" disabled={!canManage||busy||selectedStatus==='completed'} onClick={()=>startAction('reschedule')}>Reschedule Activity</button>
    </div>{selectedStatus==='completed'&&<p>Completed activity details are protected. Undo completion before editing.</p>}</>}
    {selected&&selectedAction&&<form key={selected.id+selectedAction.type} onSubmit={submitActivity} className={styles.managementForm}>
      <strong>{selectedAction.type==='edit'?'Edit activity':selectedAction.type==='reschedule'?'Reschedule activity':'Confirm '+(selectedAction.type==='complete'?'completion':selectedAction.type==='skip'?'skip':'restore to Planned')}</strong>
      <p>{selectedAction.type==='skip'?'The activity and its cost stay recorded. It will be excluded from remaining-day replanning.':'Changes save only when you confirm below.'}</p>
      {selectedAction.type==='edit'&&<><label>Activity name<input name="title" required maxLength={160} defaultValue={selected.title}/></label><label>Exact place/location<input name="location" maxLength={200} defaultValue={selected.location||''} placeholder={selected.place?.name||'Enter an exact place'}/></label><label>Description<textarea name="description" maxLength={1000} defaultValue={selected.description}/></label><label>Estimated cost ({state?.trip.currency})<input name="estimatedCost" type="number" min="0" max="10000000" step={state?.trip.currency==='JPY'?'1':'0.01'} required defaultValue={selected.estimatedCost}/></label></>}
      {selectedAction.type==='reschedule'&&<label>Saved day<select name="dayIndex" defaultValue={dayIndex}>{state?.trip.itinerary.days.map((day,index)=><option key={day.date} value={index}>Day {day.day} · {day.date}</option>)}</select></label>}
      {['edit','reschedule'].includes(selectedAction.type)&&<><label>Time (destination local){selectedAction.type==='reschedule'?<input name="time" type="time" required defaultValue={timelineSchedule(selected).start!==null?String(Math.floor(timelineSchedule(selected).start!/60)).padStart(2,'0')+':'+String(timelineSchedule(selected).start!%60).padStart(2,'0'):''}/>:<input name="time" required maxLength={30} defaultValue={selected.time} placeholder="09:00 or Flexible"/>}</label><label>Duration (minutes)<input name="durationMinutes" type="number" min="15" max="720" step="1" defaultValue={selected.durationMinutes??timelineSchedule(selected).duration??''}/></label></>}
      <div className={styles.managementActions}><button type="button" disabled={busy} onClick={()=>setAction(null)}>Cancel change</button><button className={styles.primary} disabled={busy}>{busy?'Saving…':selectedAction.type==='complete'?'Confirm completion':selectedAction.type==='skip'?'Confirm skip':selectedAction.type==='plan'?'Confirm Planned':'Save activity changes'}</button></div>
    </form>}
    {replanDay===dayIndex&&state&&<div className={styles.managementForm}>
      <form onSubmit={submitReplan}><strong>Remaining time · Day {day?.day}</strong><p>{day?.date} · Destination local time. Choose the time still available. Completed and skipped activities remain recorded.</p><div className={styles.managementTime}><label>Available from<input name="fromTime" type="time" required disabled={busy||!!currentPreview}/></label><label>Finish by<input name="toTime" type="time" required disabled={busy||!!currentPreview}/></label></div><p>Uses saved durations and places, available opening references and {mode} travel estimates. Missing durations must be set first.</p><button className={styles.primary} disabled={busy||!!currentPreview}>{busy?'Preparing…':'Preview revised day'}</button></form>
      {currentPreview&&<section aria-label="Replan preview"><h4>Proposed day · {currentPreview.provider==='openai'?'OpenAI':'Gemini'}</h4><ul>{currentPreview.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul><ol className={styles.replanActivities}>{currentPreview.activities.map(activity=>{const prior=day?.activities.find(item=>item.id===activity.id);return <li key={activity.id}><strong>{activity.title}</strong><span>{label(activity.status||'planned')} · {timelineSchedule(activity).label}</span>{prior?.time!==activity.time&&<span>Previously: {prior?.time||'Time not set'}</span>}<span>{timelineCost(activity.estimatedCost,state.trip.currency)}</span></li>;})}</ol><p>Unscheduled remaining activities are retained as Flexible. Saved costs and historical records are preserved.</p><button type="button" className={styles.primary} disabled={busy} onClick={()=>void run(signal=>acceptDayReplan(tripId,currentPreview,signal),value=>{setState(value);setPreview(null);setReplanDay(null);onSaved(value,selected?.id);})}>{busy?'Saving…':'Accept revised day'}</button></section>}
      <button type="button" disabled={busy&&!!currentPreview} onClick={cancelPreview}>Cancel replanning</button>
    </div>}
    {selected?.managementHistory?.length ? <details className={styles.activityHistory}><summary>Activity history ({selected.managementHistory.length})</summary><ol>{selected.managementHistory.map((entry,index)=><li key={index}>{label(entry.status)} · {entry.action} · {entry.toDate} {entry.toTime}<small>Recorded {new Date(entry.at).toLocaleString()}</small></li>)}</ol></details>:null}
    {error&&<p role="alert">{error}</p>}{error&&<button type="button" disabled={busy} onClick={()=>{setError('');setState(null);setAction(null);setPreview(null);setReplanDay(null);setAttempt(value=>value+1);}}>Reload saved activities</button>}
  </section>;
}
