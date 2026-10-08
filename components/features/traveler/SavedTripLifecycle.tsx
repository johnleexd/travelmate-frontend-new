'use client';

import Image from 'next/image';
import { PlacePhoto } from '@/components/common/PlacePhoto';
import { TripFeedbackForm } from './TripFeedbackForm';
import { SavedAccommodation } from './SavedAccommodation';
import { DeleteTripDialog } from './DeleteTripDialog';
import { useEffect, useRef, useState } from 'react';
import { Archive, Check, ChevronDown, Eye, History, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { formatMoney, type ItineraryGenerationSummary, type ItineraryVersion, type SavedTrip } from '@/lib/domain';
import type { ItineraryResponse, PageInfo } from '@/lib/contracts';
import { localDateInputValue } from '@/lib/date';
import { savedTripCoverImage } from '@/lib/place-image';

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
  onEdit: (trip: SavedTrip) => void;
  onAction: (body: Record<string, unknown>, message: string) => Promise<boolean>;
  onDelete: (trip: SavedTrip, onError: (message: string) => void) => Promise<boolean>;
};

function sourceLabel(value: unknown): string {
  const source = value && typeof value === 'object' ? (value as Partial<ItineraryResponse>).source : undefined;
  return source === 'openai' ? 'OpenAI generated' : source === 'gemini' ? 'Gemini generated' : source === 'mock' ? 'Demo / estimated fallback' : 'Saved plan';
}

const versionLabels: Record<ItineraryVersion['kind'], string> = {
  saved: 'Initial save', regenerated: 'Regenerated plan', manual_edit: 'Manual edit', duplicated: 'Duplicated plan', restored: 'Restored version',
};

export function SavedTripLifecycle({ trips, versions, generations, busy, tripsPage, versionPages, onLoadMoreTrips, onLoadVersions, onPlanFirstTrip, onView, onEdit, onAction, onDelete }: Props) {
  const [feedbackTrip, setFeedbackTrip] = useState<string | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<SavedTrip | null>(null);
  const [filter, setFilter] = useState<SavedTrip['status']>('active');
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
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div><h2 id="saved-plans-heading" className="text-xl font-black tracking-[-0.03em]">Saved plans</h2><p className="mt-1 text-sm text-white/45">Keep your plans, mark finished travels as done, and revisit every saved itinerary.</p></div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 p-1 text-xs font-bold" aria-label="Saved trip filters">{([['active', 'Active', activeTrips.length], ['completed', 'Completed', completedTrips.length], ['archived', 'Archived', archivedTrips.length]] as const).map(([status, label, count]) => <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)} className={`rounded-md px-3 py-2 ${filter === status ? 'bg-[#f1ead8] text-[#14231f]' : 'text-white/55 hover:bg-white/5'}`}>{label} {count}</button>)}</div>
      </div>

      {visibleTrips.length === 0 ? <div className="mt-5 border border-dashed border-white/15 p-8 text-center"><p className="text-white/48">{filter === 'archived' ? 'No archived trips.' : filter === 'completed' ? 'No completed trips yet. Mark a saved trip as done after your travels.' : 'No active trips. Generate a plan and TravelMate will save it automatically.'}</p>{filter === 'active' && <button type="button" onClick={onPlanFirstTrip} className="mt-5 bg-amber-300 px-5 py-2.5 text-sm font-bold text-[#14231f]">Plan your first trip</button>}</div> : <div className="mt-5 grid gap-4 xl:grid-cols-2">{visibleTrips.map((trip) => {
        const tripVersions = versions.filter((version) => version.tripId === trip.id).sort((a, b) => b.version - a.version);
        const expanded = expandedTrip === trip.id;
        const past = trip.endDate < localDateInputValue();
        const cover = savedTripCoverImage(trip.itinerary, trip.destinationCountryCode);
        const country = trip.destinationCountry || trip.destinationCountryCode || 'destination';
        return <article key={trip.id} className="group min-w-0 overflow-hidden border border-white/10 bg-[#102622] transition-colors duration-300 hover:border-white/25">
          <div className="relative min-h-[240px] overflow-hidden p-5 sm:p-6">
            {cover && (cover.kind === 'destination-photo' ? <PlacePhoto src={cover.src} alt={`${country} visual for the saved trip to ${trip.destination}`} sizes="(max-width: 1280px) 100vw, 50vw" className="object-cover opacity-70 transition-transform duration-700 ease-out group-hover:scale-105"/> : <Image src={cover.src} alt={`${country} visual for the saved trip to ${trip.destination}`} fill sizes="(max-width: 1280px) 100vw, 50vw" className="object-cover opacity-35 saturate-[.8] transition-transform duration-700 ease-out group-hover:scale-105" />)}
            <div aria-hidden="true" className={`absolute inset-0 ${cover ? 'bg-[linear-gradient(100deg,rgba(5,24,21,.98)_0%,rgba(5,24,21,.86)_48%,rgba(5,24,21,.42)_100%)]' : 'bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.13),transparent_42%)]'}`} />
            <div className="relative z-10"><div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between"><div className="min-w-0"><span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${trip.status === 'archived' ? 'text-amber-200' : past ? 'text-white/50' : 'text-emerald-200'}`}>{trip.status === 'archived' ? 'Archived trip' : trip.status === 'completed' ? 'Completed trip' : past ? 'Previous trip' : 'Upcoming trip'}</span><h3 className="mt-1 max-w-xl break-words text-xl font-bold text-white drop-shadow-md">{trip.destination}</h3><p className="mt-1 text-xs text-white/70">{trip.startDate} – {trip.endDate} · {trip.travelers} traveler{trip.travelers === 1 ? '' : 's'}</p></div><strong className="shrink-0 bg-[#081b18]/70 px-2.5 py-1.5 font-mono text-sm text-amber-200 backdrop-blur-sm">{formatMoney(trip.budget, trip.currency)}</strong></div><p className="mt-3 text-xs text-cyan-100">{sourceLabel(trip.itinerary)} · updated {new Date(trip.updatedAt || trip.createdAt).toLocaleString()}</p>
            {trip.completedAt && <p className="mt-2 text-xs font-semibold text-emerald-200">Travel completed · {new Date(trip.completedAt).toLocaleDateString()}</p>}
            <SavedAccommodation trip={trip}/>
            <div className="mt-5 flex flex-wrap gap-2">
              {trip.status !== 'archived' && <><button disabled={busy} onClick={() => onView(trip)} className="inline-flex items-center gap-1.5 border border-white/25 bg-[#081b18]/55 px-3 py-2 text-xs font-bold backdrop-blur-sm hover:bg-white/10"><Eye size={14}/>View</button>{trip.status === 'active' && <button disabled={busy} onClick={() => onEdit(trip)} className="inline-flex items-center gap-1.5 border border-white/25 bg-[#081b18]/55 px-3 py-2 text-xs font-bold backdrop-blur-sm hover:bg-white/10"><Pencil size={14}/>Edit</button>}</>}
              {trip.status !== 'archived' && <button type="button" disabled={busy} onClick={() => void toggleCompleted(trip)} className="inline-flex items-center gap-1.5 rounded border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-300/20">{trip.status === 'completed' ? <RotateCcw size={14}/> : <Check size={14}/>} {trip.status === 'completed' ? 'Mark as not done' : 'Mark as done'}</button>}
              <button type="button" disabled={busy} aria-expanded={feedbackTrip === trip.id} onClick={() => setFeedbackTrip(feedbackTrip === trip.id ? null : trip.id)} className="inline-flex items-center gap-1.5 border border-white/25 bg-[#081b18]/55 px-3 py-2 text-xs font-bold hover:bg-white/10">Rate this trip</button>
              <button disabled={busy} onClick={() => void onAction({ action: trip.status === 'archived' ? 'restore-trip' : 'archive-trip', id: trip.id }, trip.status === 'archived' ? trip.completedAt ? 'Trip restored to completed travels.' : 'Trip restored to active plans.' : 'Trip archived.')} className="inline-flex items-center gap-1.5 border border-amber-300/35 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-300/10">{trip.status === 'archived' ? <RotateCcw size={14}/> : <Archive size={14}/>} {trip.status === 'archived' ? 'Restore trip' : 'Archive'}</button>
              <button disabled={busy} aria-expanded={expanded} onClick={() => setExpandedTrip(expanded ? null : trip.id)} className="inline-flex items-center gap-1.5 border border-cyan-300/30 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-300/10"><History size={14}/>Version history<ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`}/></button>
              {trip.status === 'archived' && <button disabled={busy} onClick={() => setDeletingTrip(trip)} className="inline-flex items-center gap-1.5 border border-red-800 px-3 py-2 text-xs font-bold text-red-300"><Trash2 size={14}/>Delete permanently</button>}
            </div>
            {cover?.attribution && <a href={cover.attribution.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 block w-fit max-w-full truncate text-[9px] text-white/45 hover:text-white/75">Photo: {cover.attribution.creator} · {cover.attribution.license}</a>}
            </div>
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
    </section>
  );
}
