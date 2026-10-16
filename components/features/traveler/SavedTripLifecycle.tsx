'use client';

import { SavedTripCoverPhoto } from './SavedTripCoverPhoto';
import { TripFeedbackForm } from './TripFeedbackForm';
import { SavedAccommodation } from './SavedAccommodation';
import { DeleteTripDialog } from './DeleteTripDialog';
import { RecordTripVisitsDialog } from './RecordTripVisitsDialog';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './SavedTripCards.module.css';
import mapStyles from './SavedTripMap.module.css';
import { savedAccommodation } from '@/lib/saved-accommodation';
import { Archive, BedDouble, CalendarDays, Check, ChevronDown, Clock3, Eye, History, MoreHorizontal, MapPinned, MapPin, Pencil, RotateCcw, Star, Trash2, UserRound } from 'lucide-react';
import { formatMoney, type ItineraryGenerationSummary, type ItineraryVersion, type SavedTrip } from '@/lib/domain';
import type { ItineraryResponse, PageInfo, TripVisitsRecordResponse } from '@/lib/contracts';
import { localDateInputValue } from '@/lib/date';
import { savedTripCoverImage, type SavedTripCoverImage } from '@/lib/place-image';
import { resolveSavedTripCovers } from '@/lib/saved-trip-photo-selection';

type Props = {
  trips: SavedTrip[];
  versions: ItineraryVersion[];
  generations: ItineraryGenerationSummary[];
  busy: boolean;
  tripsPage?: PageInfo;
  versionPages?: Record<string, PageInfo>;
  onLoadMoreTrips?: () => Promise<void>;
  onLoadVersions?: (tripId: string, cursor?: string) => Promise<void>;
  onPlanFirstTrip: () => void;
  onView: (trip: SavedTrip) => void;
  onMap: (trip: SavedTrip) => void;
  onEdit: (trip: SavedTrip) => void;
  onAction: (body: Record<string, unknown>, message: string) => Promise<boolean>;
  onDelete: (trip: SavedTrip, onError: (message: string) => void) => Promise<boolean>;
  onVisitsSaved: (result: TripVisitsRecordResponse) => void;
};

function sourceLabel(value: unknown): string {
  const source = value && typeof value === 'object' ? (value as Partial<ItineraryResponse>).source : undefined;
  return source === 'openai' ? 'OpenAI generated' : source === 'gemini' ? 'Gemini generated' : source === 'catalog' ? 'Verified place catalog' : source === 'mock' ? 'Demo / estimated fallback' : 'Saved plan';
}

const versionLabels: Record<ItineraryVersion['kind'], string> = {
  saved: 'Initial save', regenerated: 'Regenerated plan', manual_edit: 'Manual edit', duplicated: 'Duplicated plan', restored: 'Restored version',
};


/** Card-only disclosure state; the items retain their existing trip handlers. */
function SavedTripCardMenu({ destination, children }: { destination: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<'first' | 'last'>('first');

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    items?.[initialFocus.current === 'last' ? items.length - 1 : 0]?.focus();
    const outsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const outsideFocus = (event: FocusEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', outsideClick);
    document.addEventListener('focusin', outsideFocus);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outsideClick);
      document.removeEventListener('focusin', outsideFocus);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const navigateMenu = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      const focusable = Array.from(document.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'))
        .filter(element => element.getClientRects().length && !menuRef.current?.contains(element));
      const index = focusable.indexOf(triggerRef.current!);
      const next = focusable[index + (event.shiftKey ? -1 : 1)];
      if (next) { event.preventDefault(); setOpen(false); next.focus(); }
      else setOpen(false);
      return;
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') || []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length
      : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
    if (next !== null) { event.preventDefault(); items[next].focus(); }
  };

  return <div ref={containerRef} className={styles.menuContainer}>
    <button ref={triggerRef} type="button" aria-label={'More options for ' + destination} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} className={styles.menuTrigger}
      onClick={() => { initialFocus.current = 'first'; setOpen(value => !value); }}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); initialFocus.current = event.key === 'ArrowUp' ? 'last' : 'first'; setOpen(true); } }}><MoreHorizontal aria-hidden="true" size={21}/></button>
    {open && <div ref={menuRef} id={id} role="menu" aria-label={'Options for ' + destination} className={styles.menu} onKeyDown={navigateMenu}
      onClick={event => {
        const item = (event.target as HTMLElement).closest<HTMLButtonElement>('[role="menuitem"]');
        if (item && !item.disabled) { setOpen(false); triggerRef.current?.focus(); }
      }}>{children}</div>}
  </div>;
}

export function SavedTripLifecycle({ trips, versions, generations, busy, tripsPage, versionPages, onLoadMoreTrips, onLoadVersions, onPlanFirstTrip, onView, onMap, onEdit, onAction, onDelete, onVisitsSaved }: Props) {
  const [feedbackTrip, setFeedbackTrip] = useState<string | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<SavedTrip | null>(null);
  const [recordingTrip, setRecordingTrip] = useState<SavedTrip | null>(null);
  const [visitMessage, setVisitMessage] = useState('');
  const [filter, setFilter] = useState<SavedTrip['status']>('active');
  const [coverPhotos, setCoverPhotos] = useState<Record<string, SavedTripCoverImage | null>>({});
  useEffect(() => {
    let active = true;
    void resolveSavedTripCovers(trips).then(photos => { if (active) setCoverPhotos(photos); });
    return () => { active = false; };
  }, [trips]);
  const lifecyclePending = useRef(false);
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState('');
  useEffect(() => {
    if (!expandedTrip || !onLoadVersions) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setHistoryBusy(true); setHistoryError('');
      try { await onLoadVersions(expandedTrip); }
      catch (error) { if (active) setHistoryError(error instanceof Error ? error.message : 'Version history could not be loaded.'); }
      finally { if (active) setHistoryBusy(false); }
    });
    return () => { active = false; };
  }, [expandedTrip, onLoadVersions, trips]);
  const activeTrips = trips.filter((trip) => trip.status === 'active');
  const completedTrips = trips.filter((trip) => trip.status === 'completed');
  const archivedTrips = trips.filter((trip) => trip.status === 'archived');
  const visibleTrips = filter === 'archived' ? archivedTrips : filter === 'completed' ? completedTrips : activeTrips;

  async function toggleCompleted(trip: SavedTrip) {
    if (busy || lifecyclePending.current) return;
    lifecyclePending.current = true;
    const completed = trip.status === 'completed';
    try {
      if (await onAction({ action: completed ? 'reopen-trip' : 'complete-trip', id: trip.id }, completed ? 'Trip moved back to active plans.' : 'Trip marked as done. Your itinerary and selected hotel are saved in Completed.')) setFilter(completed ? 'active' : 'completed');
    } finally { lifecyclePending.current = false; }
  }

  return (
    <section aria-labelledby="saved-plans-heading">
      {visitMessage && <p role="status" className={styles.visitMessage}>{visitMessage}</p>}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div><h2 id="saved-plans-heading" className="text-xl font-black tracking-[-0.03em]">Saved plans</h2><p className="mt-1 text-sm text-white/45">Keep your plans, mark finished travels as done, and revisit every saved itinerary.</p></div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 p-1 text-xs font-bold" aria-label="Saved trip filters">{([['active', 'Active', activeTrips.length], ['completed', 'Completed', completedTrips.length], ['archived', 'Archived', archivedTrips.length]] as const).map(([status, label, count]) => <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)} className={`rounded-md px-3 py-2 ${filter === status ? 'bg-[#f1ead8] text-[#14231f]' : 'text-white/55 hover:bg-white/5'}`}>{label} {count}</button>)}</div>
      </div>

      {visibleTrips.length === 0 ? <div className="mt-5 border border-dashed border-white/15 p-8 text-center"><p className="text-white/48">{filter === 'archived' ? 'No archived trips.' : filter === 'completed' ? 'No completed trips yet. Mark a saved trip as done after your travels.' : 'No active trips. Generate a plan and TravelMate will save it automatically.'}</p>{filter === 'active' && <button type="button" onClick={onPlanFirstTrip} className="mt-5 bg-amber-300 px-5 py-2.5 text-sm font-bold text-[#14231f]">Plan your first trip</button>}</div> : <div className="mt-5 grid gap-4 xl:grid-cols-2">{visibleTrips.map((trip) => {
        const tripVersions = versions.filter((version) => version.tripId === trip.id).sort((a, b) => b.version - a.version);
        const expanded = expandedTrip === trip.id;
        const past = trip.endDate < localDateInputValue();
        const cover = coverPhotos[trip.id] || savedTripCoverImage(trip.itinerary, trip);
        return <article key={trip.id} className={styles.card}>
          <div className={styles.image}>
            <SavedTripCoverPhoto src={cover?.src} photoId={cover?.id} alt={cover?.label || 'Destination photo unavailable'}/>
            <span className={styles.status}><span aria-hidden="true" className={trip.status === 'active' ? styles.activeDot : styles.statusDot}/>{trip.status === 'archived' ? 'Archived trip' : trip.status === 'completed' ? 'Completed trip' : past ? 'Previous trip' : 'Upcoming trip'}</span>
          </div>
          <div className={styles.content}>
            <div className={styles.titleRow}>
              <h3 className={styles.destination}>{trip.destination}</h3>
              <SavedTripCardMenu destination={trip.destination}>
                <button type="button" role="menuitem" tabIndex={-1} disabled={busy} aria-expanded={feedbackTrip === trip.id} onClick={() => setFeedbackTrip(feedbackTrip === trip.id ? null : trip.id)}><Star aria-hidden="true" size={17}/>Rate this trip</button>
                <button role="menuitem" tabIndex={-1} disabled={busy} aria-expanded={expanded} onClick={() => setExpandedTrip(expanded ? null : trip.id)}><History aria-hidden="true" size={17}/>Version history<ChevronDown aria-hidden="true" size={13} className={expanded ? 'transition-transform rotate-180' : 'transition-transform'}/></button>
                <button role="menuitem" tabIndex={-1} disabled={busy} onClick={() => void onAction({ action: trip.status === 'archived' ? 'restore-trip' : 'archive-trip', id: trip.id }, trip.status === 'archived' ? trip.completedAt ? 'Trip restored to completed travels.' : 'Trip restored to active plans.' : 'Trip archived.')}>
                  {trip.status === 'archived' ? <RotateCcw aria-hidden="true" size={17}/> : <Archive aria-hidden="true" size={17}/>} {trip.status === 'archived' ? 'Restore trip' : 'Archive'}
                </button>
              </SavedTripCardMenu>
            </div>
            <div className={styles.details}>
              <span><CalendarDays aria-hidden="true" size={18}/><span><time dateTime={trip.startDate}>{new Date(trip.startDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time> – <time dateTime={trip.endDate}>{new Date(trip.endDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></span></span>
              <span><UserRound aria-hidden="true" size={18}/>{trip.travelers} traveler{trip.travelers === 1 ? '' : 's'}</span>
            </div>
            {trip.completedAt && <p className={styles.completed}>Travel completed · {new Date(trip.completedAt).toLocaleDateString()}</p>}
            <div className={styles.accommodation}>
              {savedAccommodation(trip) ? <SavedAccommodation trip={trip}/> : <div className={styles.emptyAccommodation}><span><BedDouble aria-hidden="true" size={22}/></span><div><p>No accommodation selected</p><p>Add an accommodation to complete your plan.</p></div></div>}
            </div>
            <div className={styles.budgetRow}>
              <div><p className={styles.budgetLabel}>Trip budget</p><strong className={styles.budget}>{formatMoney(trip.budget, trip.currency)}</strong></div>
              <p className={styles.updated} title={new Date(trip.updatedAt || trip.createdAt).toLocaleString()}><Clock3 aria-hidden="true" size={16}/>Updated <time dateTime={trip.updatedAt || trip.createdAt}>{new Date(trip.updatedAt || trip.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></p>
            </div>
            <div className={styles.actions}>
              {trip.status !== 'archived' && <><button disabled={busy} onClick={() => onView(trip)} className={styles.primaryButton}><Eye aria-hidden="true" size={18}/>View itinerary</button>{trip.status === 'active' && <button disabled={busy} onClick={() => onEdit(trip)} className={styles.editButton}><Pencil aria-hidden="true" size={17}/>Edit</button>}</>}
              {trip.status !== 'archived' && <button type="button" disabled={busy} onClick={() => void toggleCompleted(trip)} className={styles.doneButton}>{trip.status === 'completed' ? <RotateCcw aria-hidden="true" size={17}/> : <Check aria-hidden="true" size={17}/>} {trip.status === 'completed' ? 'Mark as not done' : 'Mark as done'}</button>}
              {trip.status === 'archived' && <button disabled={busy} onClick={() => setDeletingTrip(trip)} className={styles.deleteButton}><Trash2 aria-hidden="true" size={16}/>Delete permanently</button>}
            </div>
            <div className={styles.secondaryActions}><button type="button" disabled={busy} onClick={() => onMap(trip)} className={mapStyles.mapEntry}><MapPinned aria-hidden="true" size={16}/>View map / Navigate</button>{trip.status !== 'archived' && <button type="button" disabled={busy} onClick={() => { setVisitMessage(''); setRecordingTrip(trip); }} className={styles.visitButton}><MapPin aria-hidden="true" size={16}/>Record visited places</button>}</div>
            <p className={styles.source}>{sourceLabel(trip.itinerary)}</p>
            {cover?.attribution && <div className={styles.attribution}>
              {cover.scope === 'country' && <span>{cover.label} · </span>}
              {cover.provider === 'unsplash' ? <>Photo by <a href={cover.attribution.photographerUrl} target="_blank" rel="noreferrer">{cover.attribution.creator}</a> on <a href={cover.attribution.sourceUrl} target="_blank" rel="noreferrer">Unsplash</a></> : <><a href={cover.attribution.sourceUrl} target="_blank" rel="noreferrer">Photo: {cover.attribution.creator}</a> · <a href={cover.attribution.licenseUrl || cover.attribution.sourceUrl} target="_blank" rel="noreferrer">{cover.attribution.license}</a> · Cropped to fit</>}
            </div>}
          </div>
          {feedbackTrip === trip.id && <TripFeedbackForm key={trip.id} itineraryId={trip.id} destination={trip.destination}/>}
          {expanded && <div className="border-t border-white/10 bg-black/15 p-5">
            <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">Version history</h4>
            {historyBusy && <p role="status" className="mt-3 text-sm text-white/60">Loading version history...</p>}
            {historyError && <p role="alert" className="mt-3 text-sm text-amber-200">{historyError}</p>}
            {!historyBusy && !historyError && tripVersions.length === 0 && <p className="mt-3 text-sm text-white/40">No version snapshots are available for this legacy trip.</p>}
            <ol className="mt-3 space-y-2">{tripVersions.map((version, index) => <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-white/15 py-2 pl-3"><div><strong className="text-sm">Version {version.version} · {versionLabels[version.kind]}</strong><p className="text-xs text-white/40">{new Date(version.createdAt).toLocaleString()}</p></div>{index > 0 && trip.status === 'active' && <button disabled={busy || historyBusy} onClick={() => void onAction({ action: 'restore-itinerary-version', id: trip.id, versionId: version.id }, `Version ${version.version} restored with its trip details. A new recovery snapshot was created.`)} className="inline-flex items-center gap-1.5 border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/5"><RotateCcw size={13}/>Restore</button>}</li>)}</ol>
            {versionPages?.[trip.id]?.nextCursor && onLoadVersions && <button disabled={historyBusy} className="mt-3 border border-white/20 px-3 py-2 text-xs font-bold" onClick={async () => {
              setHistoryBusy(true); setHistoryError('');
              try { await onLoadVersions(trip.id, versionPages[trip.id].nextCursor!); }
              catch (error) { setHistoryError(error instanceof Error ? error.message : 'More versions could not be loaded.'); }
              finally { setHistoryBusy(false); }
            }}>Load older versions</button>}
          </div>}
        </article>;
      })}</div>}

      {tripsPage && <div className="mt-5"><p className="text-xs text-white/50">{trips.length} of {tripsPage.total} trips loaded. Active, completed and archived filters apply to loaded trips.</p>{tripsPage.nextCursor && onLoadMoreTrips && <button disabled={busy} onClick={() => void onLoadMoreTrips()} className="mt-3 border border-white/20 px-4 py-2 text-sm font-bold">Load more trips</button>}</div>}
      <div className="mt-8 border-t border-white/10 pt-6"><div className="flex items-center gap-3"><History size={18} className="text-cyan-200"/><div><h3 className="font-bold">Recent AI generations</h3><p className="text-xs text-white/40">Persistent request history helps prevent duplicate provider calls.</p></div></div>{generations.length === 0 ? <p className="mt-4 text-sm text-white/40">No generation attempts recorded yet.</p> : <div className="mt-4 grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-3">{generations.slice(0, 6).map((generation) => <div key={generation.id} className="bg-[#0b1d1a] p-4"><span className={`text-[10px] font-bold uppercase tracking-wider ${generation.status === 'completed' ? 'text-emerald-200' : generation.status === 'failed' ? 'text-red-300' : 'text-amber-200'}`}>{generation.status}</span><strong className="mt-1 block truncate text-sm">{generation.destination}</strong><p className="mt-1 text-[11px] text-white/35">{new Date(generation.createdAt).toLocaleString()}{generation.errorCode ? ` · ${generation.errorCode}` : ''}</p></div>)}</div>}</div>
      {deletingTrip && <DeleteTripDialog trip={deletingTrip} busy={busy} onClose={() => setDeletingTrip(null)} onConfirm={onError => onDelete(deletingTrip, onError)}/>}
      {recordingTrip && <RecordTripVisitsDialog
        key={recordingTrip.id}
        trip={recordingTrip}
        onClose={() => setRecordingTrip(null)}
        onSaved={result => {
          setVisitMessage(result.recorded ? `${result.recorded} visited ${result.recorded === 1 ? 'place' : 'places'} saved.${result.alreadyRecorded ? ` ${result.alreadyRecorded} already recorded.` : ''}` : 'These places are already recorded. No duplicates added.');
          setRecordingTrip(null);
          onVisitsSaved(result);
        }}
      />}
    </section>
  );
}
