'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, CalendarDays, LoaderCircle, Pencil, Plus, Save, Trash2, Users, WalletCards, X } from 'lucide-react';
import type { SavedTrip, TripDetailResponse } from '@/lib/contracts';
import { formatMoney } from '@/lib/domain';
import { isCurrencyCode } from '@/lib/currency-conversion';
import { moveActivity, removeActivity, upsertActivity } from '@/lib/itinerary-editor';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import { handleResponse, type DayActivity, type ItineraryResponse } from '@/services/api.service';
import { ActivityEditorDialog } from './TravelerItineraryDialogs';
import { SavedAccommodation } from './SavedAccommodation';

type Props = {
  trip: SavedTrip;
  onClose: () => void;
  onSave: (trip: SavedTrip, itinerary: ItineraryResponse) => Promise<void>;
  onChangeDetails: (trip: SavedTrip) => void;
};

function usablePlan(value: unknown): value is ItineraryResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as ItineraryResponse;
  return typeof candidate.destination === 'string' && isCurrencyCode(candidate.currency)
    && Number.isFinite(candidate.totalBudget) && candidate.totalBudget > 0 && !!candidate.budgetSummary
    && Number.isFinite(candidate.budgetSummary.total)
    && Array.isArray(candidate.days) && candidate.days.length > 0
    && candidate.days.every(day => !!day && Number.isFinite(day.totalCost) && Array.isArray(day.activities)
      && day.activities.every(activity => !!activity && typeof activity.title === 'string' && Number.isFinite(activity.estimatedCost)));
}

export function EditTripDialog({ trip: summary, onClose, onSave, onChangeDetails }: Props) {
  const [initialTrip] = useState(summary);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const mountedRef = useRef(true);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const [trip, setTrip] = useState<SavedTrip | null>(null);
  const [original, setOriginal] = useState<ItineraryResponse | null>(null);
  const [plan, setPlan] = useState<ItineraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [dayIndex, setDayIndex] = useState(0);
  const [editor, setEditor] = useState<{ dayIndex: number; activityIndex: number | null } | null>(null);
  const [activityError, setActivityError] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const dirty = useMemo(() => !!plan && !!original && JSON.stringify(plan) !== JSON.stringify(original), [plan, original]);

  function close() {
    if (sendingRef.current) return;
    if (discarding) { setDiscarding(false); return; }
    if (dirty) setDiscarding(true);
    else onClose();
  }
  useModalAccessibility({ active: true, containerRef: dialogRef, initialFocusRef: closeRef, onClose: close });
  useModalAccessibility({ active: !!editor, containerRef: activityRef, initialFocusRef: titleRef, onClose: () => setEditor(null) });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/platform/trips/${encodeURIComponent(initialTrip.id)}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        const { trip: loaded } = await handleResponse<TripDetailResponse>(response);
        if (!active) return;
        if (loaded.id !== initialTrip.id || loaded.status !== 'active') throw new Error('Only an active saved trip can be edited. Reload Saved trips to see its current status.');
        if (!usablePlan(loaded.itinerary)) throw new Error('This saved trip does not contain an editable itinerary.');
        setTrip(loaded); setOriginal(loaded.itinerary); setPlan(loaded.itinerary);
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : 'The saved itinerary could not be loaded.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [attempt, initialTrip]);
  useEffect(() => { if (discarding) keepEditingRef.current?.focus(); }, [discarding]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function changePlan(update: (current: ItineraryResponse) => ItineraryResponse) {
    if (!plan || sendingRef.current) return;
    try { setPlan(update(plan)); setError(''); setRemoving(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The activity could not be changed.'); }
  }
  function submitActivity(form: HTMLFormElement) {
    if (!plan || !editor) return;
    const fields = new FormData(form);
    try {
      setPlan(upsertActivity(plan, editor.dayIndex, editor.activityIndex, {
        title: String(fields.get('title') || ''), time: String(fields.get('time') || ''),
        description: String(fields.get('description') || ''), location: String(fields.get('location') || ''),
        durationMinutes: fields.get('durationMinutes') ? Number(fields.get('durationMinutes')) : undefined,
        travelMinutes: fields.get('travelMinutes') ? Number(fields.get('travelMinutes')) : undefined,
        estimatedCost: Number(fields.get('estimatedCost')), category: String(fields.get('category') || 'activity') as DayActivity['category'],
      }));
      setEditor(null); setActivityError(''); setError('');
    } catch (failure) { setActivityError(failure instanceof Error ? failure.message : 'The activity could not be updated.'); }
  }
  async function save() {
    if (!trip || !plan || !dirty || sendingRef.current) return;
    sendingRef.current = true; setSending(true); setError('');
    try { await onSave(trip, plan); if (mountedRef.current) onClose(); }
    catch (failure) { if (mountedRef.current) setError(failure instanceof Error ? failure.message : 'Your changes could not be saved. Try again.'); }
    finally { sendingRef.current = false; if (mountedRef.current) setSending(false); }
  }

  const day = plan?.days[dayIndex];
  const editingDay = editor ? plan?.days[editor.dayIndex] : undefined;
  const displayedTrip = trip || initialTrip;
  const spend = plan?.budgetSummary.plannedSpend ?? plan?.days.reduce((sum, current) => sum + current.totalCost, 0) ?? 0;
  const controlClass = 'grid size-9 shrink-0 place-items-center rounded-lg border border-white/15 text-white/65 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#ffcf70] disabled:opacity-30';

  return createPortal(<>
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#04120f]/85 p-3 text-white backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="edit-trip-title" aria-describedby="edit-trip-description" aria-busy={loading || sending} aria-hidden={editor ? true : undefined} inert={!!editor} tabIndex={-1} className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#102824] shadow-2xl outline-none sm:max-h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5 sm:px-6">
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#ffcf70]">Your saved plan</p><h2 id="edit-trip-title" className="mt-1 text-xl font-bold tracking-tight">Edit saved trip</h2><p id="edit-trip-description" className="mt-1 text-xs leading-5 text-white/55">Adjust your daily activities, then save your changes.</p></div>
          <button ref={closeRef} type="button" disabled={sending} aria-label="Close trip editor" onClick={close} className={controlClass}><X size={18}/></button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <h3 className="break-words text-lg font-bold">{displayedTrip.destination}</h3>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/65">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-2"><CalendarDays size={14}/>{displayedTrip.startDate} – {displayedTrip.endDate}</span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-2"><Users size={14}/>{displayedTrip.travelers} traveler{displayedTrip.travelers === 1 ? '' : 's'}</span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-2"><WalletCards size={14}/>{formatMoney(displayedTrip.budget, displayedTrip.currency)}</span>
          </div>
          <SavedAccommodation trip={displayedTrip}/>
          {loading ? <p role="status" className="mt-6 flex items-center gap-2 py-6 text-sm text-white/65"><LoaderCircle size={18} className="motion-safe:animate-spin"/>Loading saved itinerary…</p> : !plan ? <div className="mt-5"><p role="alert" className="text-sm text-amber-200">{error}</p><button type="button" onClick={() => { setLoading(true); setError(''); setAttempt(value => value + 1); }} className="mt-3 min-h-10 rounded-lg border border-white/20 px-4 text-sm font-semibold">Retry loading</button></div> : <>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-5">
              <label className="text-xs font-semibold text-white/65">Day to edit<select value={dayIndex} disabled={sending} onChange={event => { setDayIndex(Number(event.target.value)); setRemoving(null); }} className="mt-2 block min-h-11 rounded-lg border border-white/20 bg-[#081b18] px-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-[#ffcf70]">{plan.days.map((current, index) => <option key={current.day} value={index}>Day {current.day} · {current.date}</option>)}</select></label>
              <button type="button" disabled={sending || !day || day.activities.length >= 8} onClick={() => { setEditor({ dayIndex, activityIndex: null }); setActivityError(''); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#ffcf70]/35 px-3 text-xs font-bold text-[#ffcf70] hover:bg-[#ffcf70]/10 disabled:opacity-30"><Plus size={15}/>Add activity</button>
            </div>
            {day && <><p className="mt-4 text-sm font-semibold text-white/85">{day.theme}</p><ol className="mt-3 space-y-2">{day.activities.map((activity, index) => <li key={`${dayIndex}-${index}`} className="rounded-xl border border-white/10 bg-[#081b18]/50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-[#ffcf70]">{activity.time} · {activity.category}</p><h4 className="mt-1 break-words text-sm font-semibold">{activity.title}</h4><p className="mt-1 text-xs text-white/50">{formatMoney(activity.estimatedCost, plan.currency)} group estimate{activity.durationMinutes ? ` · ${activity.durationMinutes} min` : ''}</p></div><div className="flex shrink-0 gap-1.5">
                <button type="button" disabled={sending || index === 0} aria-label={`Move ${activity.title} earlier`} onClick={() => changePlan(current => moveActivity(current, dayIndex, index, -1))} className={controlClass}><ArrowUp size={15}/></button>
                <button type="button" disabled={sending || index === day.activities.length - 1} aria-label={`Move ${activity.title} later`} onClick={() => changePlan(current => moveActivity(current, dayIndex, index, 1))} className={controlClass}><ArrowDown size={15}/></button>
                <button type="button" disabled={sending} aria-label={`Edit ${activity.title}`} onClick={() => { setEditor({ dayIndex, activityIndex: index }); setActivityError(''); }} className={controlClass}><Pencil size={15}/></button>
                <button type="button" disabled={sending} aria-label={`Remove ${activity.title}`} onClick={() => setRemoving(index)} className={`${controlClass} text-red-200`}><Trash2 size={15}/></button>
              </div></div>
              {removing === index && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3"><p className="mr-auto text-xs text-white/65">Remove this activity from the draft?</p><button type="button" onClick={() => setRemoving(null)} className="min-h-9 px-3 text-xs font-semibold">Keep activity</button><button type="button" onClick={() => changePlan(current => removeActivity(current, dayIndex, index))} className="min-h-9 rounded-lg border border-red-300/25 px-3 text-xs font-semibold text-red-200">Remove activity</button></div>}
            </li>)}</ol>{day.activities.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/55">No activities for this day. Add one to start planning.</p>}</>}
            <div className="mt-5 flex flex-wrap justify-between gap-2 rounded-lg border border-white/10 bg-white/[.03] p-3 text-xs"><span className="text-white/55">Estimated spending</span><strong className="text-[#ffcf70]">{formatMoney(spend, plan.currency)}</strong></div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3"><p className="max-w-sm text-xs leading-5 text-white/45">Changing the destination, dates, travelers, or hotel requires an updated plan. Save or discard activity edits before changing trip details.</p><button type="button" disabled={sending || dirty} onClick={() => { if (trip) onChangeDetails(trip); }} className="min-h-10 rounded-lg border border-white/15 px-3 text-xs font-semibold text-white/70 hover:bg-white/5 disabled:opacity-35">Change trip details</button></div>
            {error && <p role="alert" className="mt-4 rounded-lg border border-red-300/25 bg-red-300/10 p-3 text-sm leading-5 text-red-200">{error}</p>}
          </>}
        </div>
        <footer className="shrink-0 border-t border-white/10 bg-[#102824] p-4 sm:px-6">
          {discarding ? <div role="alert" className="flex flex-wrap items-center gap-3"><p className="mr-auto text-sm text-amber-200">Discard your unsaved changes?</p><button ref={keepEditingRef} type="button" onClick={() => setDiscarding(false)} className="min-h-11 rounded-lg border border-white/20 px-4 text-sm font-semibold">Keep editing</button><button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-[#ffcf70] px-4 text-sm font-bold text-[#102824]">Discard changes</button></div> : <div className="flex flex-wrap items-center justify-end gap-3"><p role="status" className="mr-auto text-xs text-white/50">{sending ? 'Saving your trip…' : dirty ? 'Unsaved changes' : 'Your saved trip is up to date'}</p><button type="button" disabled={sending} onClick={close} className="min-h-11 rounded-lg border border-white/20 px-4 text-sm font-semibold text-white/75 hover:bg-white/5 disabled:opacity-40">Cancel</button><button type="button" disabled={!dirty || loading || sending} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#ffcf70] px-4 text-sm font-bold text-[#102824] hover:bg-[#ffdc91] disabled:cursor-not-allowed disabled:opacity-40">{sending ? <LoaderCircle size={15} className="motion-safe:animate-spin"/> : <Save size={15}/>} {sending ? 'Saving…' : 'Save changes'}</button></div>}
        </footer>
      </div>
    </div>
    {editor && editingDay && plan && <ActivityEditorDialog nested error={activityError} editor={editor} day={editingDay} activity={editor.activityIndex === null ? undefined : editingDay.activities[editor.activityIndex]} currency={plan.currency} modalRef={activityRef} titleRef={titleRef} onClose={() => setEditor(null)} onSubmit={submitActivity}/>}
  </>, document.body);
}
