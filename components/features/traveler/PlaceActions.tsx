'use client';
import { useRef, useState } from 'react';
import { Check, MapPin, X } from 'lucide-react';
import { placeMapUrl } from '@/lib/place-map';
import { localDateInputValue } from '@/lib/date';
import { handleResponse } from '@/services/api.service';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import type { DayActivity, VisitRecordResponse } from '@/lib/contracts';

export function RecordVisitDialog({ name, destination, trip, onClose, onRecorded }: { name?: string; destination?: string; trip?: { tripId: string; dayIndex: number; activityIndex: number; activityTitle: string; placeId?: string }; onClose: () => void; onRecorded?: (result: VisitRecordResponse) => void }) {
  const container = useRef<HTMLDivElement>(null), focus = useRef<HTMLInputElement>(null), pending = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useModalAccessibility({ active: true, containerRef: container, initialFocusRef: focus, onClose: () => { if (!pending.current) onClose(); } });
  async function submit(form: HTMLFormElement) {
    if (pending.current) return;
    const fields = new FormData(form); pending.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/platform', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'record-visit', ...trip,
        name: fields.get('name') ?? name, destination: fields.get('destination') ?? destination, visitDate: fields.get('visitDate'), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
      const result = await handleResponse<{ result: VisitRecordResponse }>(response);
      onRecorded?.(result.result); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Visit could not be recorded. Try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-4">
    <div ref={container} role="dialog" aria-modal="true" aria-labelledby="visit-title" className="w-full max-w-md rounded-xl border border-white/15 bg-[#132d26] p-5 text-white shadow-2xl">
      <div className="flex items-start justify-between gap-3"><h2 id="visit-title" className="text-xl font-bold">Record a visit</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close record visit" className="min-h-10 min-w-10"><X size={20}/></button></div>
      <p className="mt-2 text-sm text-white/60">Record a place you have visited. Planning a trip or opening its map does not add a visit.</p>
      <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); void submit(event.currentTarget); }}>
        {trip ? <p className="font-semibold">{name}<span className="mt-1 block text-xs font-normal text-white/60">{destination}</span></p> : <><label className="block text-sm">Place name<input required name="name" minLength={2} maxLength={160} defaultValue={name} className="mt-1 min-h-11 w-full rounded border border-white/20 bg-[#071813] px-3"/></label><label className="block text-sm">Destination<input required name="destination" minLength={2} maxLength={120} defaultValue={destination} placeholder="City, country" className="mt-1 min-h-11 w-full rounded border border-white/20 bg-[#071813] px-3"/></label></>}
        <label className="block text-sm">Visit date<input ref={focus} required name="visitDate" type="date" defaultValue={localDateInputValue()} max={localDateInputValue()} className="mt-1 min-h-11 w-full rounded border border-white/20 bg-[#071813] px-3"/></label>
        <p className="text-xs text-white/55">The same place and date are recorded once. Return visits on another date are welcome.</p>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded border border-white/20 px-4">Cancel</button><button disabled={busy} className="min-h-11 rounded bg-amber-300 px-4 font-bold text-[#14231f]">{busy ? 'Recording...' : 'Mark as visited'}</button></div>
      </form>
    </div>
  </div>;
}

export function PlaceActions({ activity, destination, tripId, dayIndex, activityIndex, canRecord = true }: { activity: DayActivity; destination: string; tripId?: string | null; dayIndex: number; activityIndex: number; canRecord?: boolean }) {
  const [open, setOpen] = useState(false), [message, setMessage] = useState('');
  if (activity.category !== 'activity' && !activity.place) return null;
  const name = activity.place?.name || activity.title;
  return <div className="mt-3">
    <div className="flex flex-wrap gap-2"><a href={placeMapUrl({ name, destination, latitude: activity.place?.latitude, longitude: activity.place?.longitude })} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${name} on Google Maps (opens a new tab)`} className="inline-flex min-h-10 items-center gap-1.5 rounded border border-white/20 px-3 text-xs font-semibold text-cyan-200"><MapPin size={14}/>Visit · map</a>
      {canRecord && <button type="button" disabled={!tripId} onClick={() => setOpen(true)} title={!tripId ? 'Save this itinerary and any changes before recording a visit.' : undefined} className="inline-flex min-h-10 items-center gap-1.5 rounded border border-amber-300/30 px-3 text-xs font-semibold text-amber-300 disabled:opacity-40"><Check size={14}/>Mark as visited</button>}</div>
    {canRecord && !tripId && <p className="mt-1 text-[10px] text-white/45">Save changes to record a visit from this plan.</p>}
    {message && <p role="status" className="mt-2 text-xs text-emerald-300">{message}</p>}
    {open && tripId && <RecordVisitDialog name={name} destination={destination} trip={{ tripId, dayIndex, activityIndex, activityTitle: activity.title, placeId: activity.place?.placeId }} onClose={() => setOpen(false)} onRecorded={result => setMessage(result.alreadyRecorded ? 'This place and date are already in your visited history.' : 'Visit saved to your personal history.')}/>}
  </div>;
}
