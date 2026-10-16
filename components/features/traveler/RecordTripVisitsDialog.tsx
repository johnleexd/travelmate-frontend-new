'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { SavedTrip, TripVisitCandidatesResponse, TripVisitsRecordResponse } from '@/lib/contracts';
import { localDateInputValue } from '@/lib/date';
import { handleResponse } from '@/services/api.service';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import { ActivityPhoto } from '@/components/common/ActivityPhoto';
import styles from './RecordTripVisitsDialog.module.css';

export function RecordTripVisitsDialog({ trip, onClose, onSaved }: { trip: SavedTrip; onClose: () => void; onSaved: (result: TripVisitsRecordResponse) => void }) {
  const id = useId(), container = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null), all = useRef<HTMLInputElement>(null), pending = useRef(false);
  const [result, setResult] = useState<TripVisitCandidatesResponse | null>(null), [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [attempt, setAttempt] = useState(0), [date, setDate] = useState('');
  useModalAccessibility({ active: true, containerRef: container, initialFocusRef: close, onClose: () => { if (!pending.current) onClose(); } });
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/platform/trips/${encodeURIComponent(trip.id)}/visit-candidates`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(handleResponse<TripVisitCandidatesResponse>).then(data => {
        if (data.tripId !== trip.id || !Array.isArray(data.places)) throw new Error('The places do not match this trip. Try again.');
        if (!controller.signal.aborted) {
          const selectable = data.places.filter(place => !place.alreadyRecorded);
          setResult(data);
          setSelected(new Set(trip.status === 'completed' ? selectable.map(place => place.key) : []));
          if (trip.status === 'completed') {
            const today = localDateInputValue();
            const completedDate = trip.completedAt?.slice(0, 10);
            const preferred = completedDate && completedDate <= today ? completedDate : trip.endDate <= today ? trip.endDate : today;
            setDate(preferred);
          }
        }
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Saved places could not load.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [trip.id, trip.status, trip.completedAt, trip.endDate, attempt]);
  const available = result?.places.filter(place => !place.alreadyRecorded) || [];
  useEffect(() => { if (all.current) all.current.indeterminate = selected.size > 0 && selected.size < available.length; }, [selected.size, available.length]);
  async function save() {
    if (pending.current || !result || !selected.size || !date) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await handleResponse<{ result: TripVisitsRecordResponse }>(await fetch('/api/platform', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record-trip-visits', tripId: trip.id, places: available.filter(place => selected.has(place.key)).map(({ key, fingerprint }) => ({ key, fingerprint })), visitDate: date, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }), signal: AbortSignal.timeout(25000) }));
      onSaved(response.result); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Visited places could not be saved. Your selection is kept; try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return createPortal(<div className={styles.backdrop}>
    <div ref={container} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-helper`} tabIndex={-1} className={styles.dialog}>
      <header className={styles.header}><div><h2 id={`${id}-title`}>Record visited places</h2><p className={styles.destination}>{result?.destination || trip.destination}</p><p id={`${id}-helper`}>Select the places you actually visited.</p></div><button ref={close} type="button" disabled={busy} onClick={onClose} aria-label="Close record visited places"><X size={22}/></button></header>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
        <div className={styles.body}>
          {loading && <p role="status">Loading saved itinerary places…</p>}
          {!loading && !result && <button type="button" onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1); }}>Retry loading places</button>}
          {result && <>
            {!!result.places.length && <label className={styles.selectAll}><input ref={all} type="checkbox" checked={available.length > 0 && selected.size === available.length} disabled={busy || !available.length} onChange={event => setSelected(new Set(event.target.checked ? available.map(place => place.key) : []))}/>Select all</label>}
            {!result.places.length && <p>No recordable places were found in this itinerary. Open the itinerary and add or find named activities first, or use Record a visit in Visited places.</p>}
            <ul className={styles.list}>{result.places.map((place, index) => <li key={place.key} className={styles.row}>
              <input id={`${id}-place-${index}`} type="checkbox" checked={place.alreadyRecorded || selected.has(place.key)} disabled={busy || place.alreadyRecorded} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(place.key); else next.delete(place.key); return next; })}/>
              <div className={styles.photoColumn}><ActivityPhoto src={place.imageUrl} attribution={place.imageAttribution} alt={place.name} sizes="72px" frameClassName={styles.photo} creditClassName={styles.credit} emptyMessage="Photo unavailable"/></div>
              <label htmlFor={`${id}-place-${index}`} className={styles.place}><strong>{place.name}</strong><span>{place.destination}</span>{place.alreadyRecorded && <em>Already recorded</em>}</label>
            </li>)}</ul>
            {available.length > 0 && <div className={styles.date}><label htmlFor={`${id}-date`}>Visit date</label><input id={`${id}-date`} name="visitDate" type="date" required value={date} aria-describedby={`${id}-date-help`} max={localDateInputValue()} disabled={busy} onChange={event => setDate(event.target.value)}/><span id={`${id}-date-help`}>Enter the actual visit date for the selected places. Planned trip dates are not used.</span></div>}
          </>}
        </div>
        <footer className={styles.footer}>
          <p role="status" aria-live="polite"><strong>{selected.size} {selected.size === 1 ? 'place' : 'places'} selected</strong></p>
          <p>{trip.status === 'completed'
            ? 'This trip is marked as done. Saving adds the selected places to Visited places.'
            : 'Saving adds the selected places to Visited places. You can mark the trip as done separately.'}</p>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.buttons}><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={styles.primary} disabled={busy || loading || !selected.size || !date}>{busy ? 'Saving visited places…' : 'Save visited places'}</button></div>
        </footer>
      </form>
    </div>
  </div>, document.body);
}
