'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CalendarDays, ChevronDown, MessageSquare, RefreshCw, Search, Star, X } from 'lucide-react';
import type { FeedbackDetailResponse, FeedbackEntry, FeedbackItineraryResponse, FeedbackListResponse } from '@/lib/contracts';
import { FEEDBACK_CATEGORY_LABELS } from '@/lib/feedback';
import { handleResponse } from '@/services/api.service';
import { UserAvatar } from '@/components/common/UserAvatar';
import { ItineraryWorkspace } from '@/components/features/traveler/ItineraryWorkspace';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import { formatMoney } from '@/lib/domain';

const button = 'min-h-11 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#ffcf70] disabled:opacity-40';
const input = 'mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#0b1d1a]/45 px-3 text-sm text-white/85 outline-none focus:border-[#ffcf70]/60 focus:ring-1 focus:ring-[#ffcf70]/30';
const noAction = () => undefined;

export function UserFeedbackView({ feedbackId, onLinkedFeedbackClose }: { feedbackId?: string; onLinkedFeedbackClose?: () => void }) {
  const [search, setSearch] = useState('');
  const [showDates, setShowDates] = useState(false);
  const [rating, setRating] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<FeedbackListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRevision, setDetailRevision] = useState(0);
  const [selected, setSelected] = useState<FeedbackEntry | null>(null);
  const [trip, setTrip] = useState<FeedbackItineraryResponse['itinerary'] | null>(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [tripError, setTripError] = useState('');
  const [tripRevision, setTripRevision] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalAccessibility({ active: Boolean(selected), containerRef: modalRef, initialFocusRef: closeRef, onClose: closeFeedback });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries({ rating, sentiment, from, to, q: search.trim() })) if (value) params.set(key, value);
    let current = true;
    const timer = setTimeout(() => {
      if (from && to && from > to) { setError('Start date cannot be after end date.'); setData(null); setLoading(false); return; }
      setLoading(true); setError(''); setData(null);
      void fetch(`/api/feedback?${params}`, { signal: controller.signal, cache: 'no-store' }).then(handleResponse<FeedbackListResponse>).then(result => {
        if (current) { setData(result); setLoading(false); }
      }).catch((error: unknown) => { if (current && !controller.signal.aborted) { setError(error instanceof Error ? error.message : 'Could not load feedback.'); setLoading(false); } });
    }, search ? 250 : 0);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [rating, sentiment, from, to, search, page, revision]);

  useEffect(() => {
    if (!selected?.itinerary) return;
    const controller = new AbortController();
    let current = true;
    void fetch(`/api/feedback/${encodeURIComponent(selected.id)}/itinerary`, { signal: controller.signal, cache: 'no-store' }).then(handleResponse<FeedbackItineraryResponse>).then(result => {
      if (current) { setTrip(result.itinerary); setTripLoading(false); }
    }).catch((error: unknown) => { if (current && !controller.signal.aborted) { setTripError(error instanceof Error ? error.message : 'Could not load the itinerary.'); setTripLoading(false); } });
    return () => { current = false; controller.abort(); };
  }, [selected, tripRevision]);

  useEffect(() => {
    if (!feedbackId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSelected(null); setTrip(null); setDetailError(''); setDetailLoading(true);
      void fetch('/api/feedback/' + encodeURIComponent(feedbackId), { cache: 'no-store', signal: controller.signal })
        .then(handleResponse<FeedbackDetailResponse>).then(({ entry }) => {
          if (controller.signal.aborted) return;
          setSelected(entry); setTrip(null); setTripError(''); setTripLoading(Boolean(entry.itinerary)); setDetailLoading(false);
        }).catch((error: unknown) => {
          if (!controller.signal.aborted) { setDetailLoading(false); setDetailError(error instanceof Error ? error.message : 'Could not load feedback details.'); }
        });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [feedbackId, detailRevision]);

  function closeFeedback() { setSelected(null); onLinkedFeedbackClose?.(); }
  function openFeedback(entry: FeedbackEntry) {
    onLinkedFeedbackClose?.(); setDetailLoading(false); setDetailError('');
    setSelected(entry); setTrip(null); setTripError(''); setTripLoading(Boolean(entry.itinerary));
  }
  function changeFilter(setter: (value: string) => void, value: string) { setLoading(true); setData(null); setter(value); setPage(1); }
  const first = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return <div className="space-y-5">

    <div className="flex flex-wrap items-center justify-between gap-3"><p aria-live="polite" className="text-sm text-white/55">{data ? data.total.toLocaleString() + ' feedback entries matching these filters' : 'Itinerary quality feedback from travelers.'}</p><button className={button + ' inline-flex items-center gap-2 text-white/75'} disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15}/>Refresh feedback</button></div>
    <section aria-label="Feedback history" className="min-w-0 rounded-2xl border border-white/10 bg-[#102824] p-4 sm:p-6">
      <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_180px]">
        <label className="relative block sm:col-span-2 xl:col-span-1"><span className="sr-only">Search feedback</span><Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"/><input type="search" maxLength={200} placeholder="Search feedback, traveler or itinerary…" value={search} onChange={event => changeFilter(setSearch, event.target.value)} className={input + ' mt-0 pl-11 placeholder:text-white/35'}/></label>
        <label className="text-xs font-medium text-white/55">Rating<select aria-label="Rating" value={rating} onChange={event => changeFilter(setRating, event.target.value)} className={input}><option value="">All ratings</option>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}</select></label>
        <label className="text-xs font-medium text-white/55">Sentiment<select aria-label="Sentiment" value={sentiment} onChange={event => changeFilter(setSentiment, event.target.value)} className={input}><option value="">All sentiments</option><option value="not_analyzed">Not analyzed</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></select></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs leading-5 text-white/35">Traveler comments and ratings for saved itineraries.</p><button type="button" aria-expanded={showDates} aria-controls="feedback-date-filters" onClick={() => setShowDates(value => !value)} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-medium text-[#ffcf70]/80 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#ffcf70]"><CalendarDays size={14}/>{from || to ? 'Date filters applied' : 'Date filters'}<ChevronDown size={14} className={showDates ? 'rotate-180' : ''}/></button></div>
      {showDates && <div id="feedback-date-filters" className="mt-3 grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-2"><label className="text-xs text-white/55">From date<input type="date" value={from} onChange={event => changeFilter(setFrom, event.target.value)} className={input}/></label><label className="text-xs text-white/55">To date<input type="date" value={to} onChange={event => changeFilter(setTo, event.target.value)} className={input}/></label><p className="text-xs text-white/40 sm:col-span-2">Dates include both endpoints in UTC.</p></div>}
      {detailLoading && <p role="status" className="mt-5 p-5 text-sm text-white/60">Loading feedback details…</p>}
      {detailError && <div role="alert" className="mt-5 rounded-xl border border-red-400/25 p-5 text-sm text-red-300"><p>{detailError}</p><button className={button} onClick={() => setDetailRevision(value => value + 1)}>Retry feedback details</button></div>}
      {loading && <p role="status" className="mt-5 p-5 text-sm text-white/60">Loading feedback…</p>}
      {error && <div role="alert" className="mt-5 rounded-xl border border-red-400/25 p-5 text-sm text-red-300"><p>{error}</p><button className={button + ' mt-4'} onClick={() => setRevision(value => value + 1)}>Retry feedback</button></div>}
      {data && !loading && <>
        <div role="region" aria-label="User feedback records" className="mt-4 min-w-0">
          <ul className="divide-y divide-white/10">{data.entries.map(entry => <li key={entry.id} className="flex min-w-0 gap-3 py-6 first:pt-4 sm:gap-4">
            <UserAvatar user={entry.user ?? { name: 'Deleted user' }}/>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2 className="break-words text-sm font-semibold text-white/90 [overflow-wrap:anywhere]">{entry.user?.name || 'Deleted user'}</h2>
                <span role="img" aria-label={entry.rating + ' out of 5 stars'} className="flex shrink-0 gap-0.5 text-[#ffcf70]">{[1,2,3,4,5].map(value => <Star aria-hidden="true" key={value} size={14} fill={value <= entry.rating ? 'currentColor' : 'none'} className={value <= entry.rating ? '' : 'text-white/25'}/>)}</span>
                <span title={entry.sentiment === 'not_analyzed' ? 'Sentiment has not been analyzed.' : undefined} className={'rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ' + (entry.sentiment === 'positive' ? 'border-emerald-300/15 bg-emerald-300/10 text-emerald-200' : entry.sentiment === 'negative' ? 'border-red-300/15 bg-red-300/10 text-red-300' : entry.sentiment === 'neutral' ? 'border-[#ffcf70]/15 bg-[#ffcf70]/10 text-[#ffcf70]' : 'border-white/10 bg-white/5 text-white/45')}>{entry.sentiment === 'not_analyzed' ? 'Not analyzed' : entry.sentiment}</span>
              </div>
              <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-6">
                <div className="min-w-0 flex-1"><p className="line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-white/65 [overflow-wrap:anywhere]">{entry.comment}</p><p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-white/35"><span className="text-white/50">{entry.itinerary?.destination || 'Itinerary unavailable'}</span><span aria-hidden="true">·</span><span>{FEEDBACK_CATEGORY_LABELS[entry.category]}</span><span aria-hidden="true">·</span><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}</time></p></div>
                <button type="button" aria-label={'View details for feedback from ' + (entry.user?.name || 'Deleted user')} onClick={() => openFeedback(entry)} className="inline-flex min-h-11 shrink-0 items-center justify-start gap-2 self-start rounded-lg text-xs font-semibold text-[#ffcf70] transition-colors hover:text-[#ffe3aa] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffcf70] sm:px-2">View details<ArrowRight size={15}/></button>
              </div>
            </div>
          </li>)}</ul>
        </div>
        {data.total === 0 && <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-4 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[#ffcf70]/10 text-[#ffcf70]"><MessageSquare size={22}/></span><h2 className="text-sm font-semibold">No feedback found</h2><p className="max-w-sm text-sm leading-6 text-white/45">No feedback matches these filters. Travelers can submit feedback from their saved trips.</p></div>}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5"><p role="status" className="text-xs text-white/45">Showing {first.toLocaleString()}–{last.toLocaleString()} of {data.total.toLocaleString()} feedback entries</p><div className="flex flex-wrap items-center gap-3"><button disabled={data.page <= 1} className={button} onClick={() => { setLoading(true); setPage(data.page - 1); }}>Previous page</button><span className="text-xs text-white/40">Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><button disabled={last >= data.total} className={button} onClick={() => { setLoading(true); setPage(data.page + 1); }}>Next page</button></div></div>
      </>}
    </section>
    {selected && createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 text-slate-100 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) closeFeedback(); }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title" tabIndex={-1} className="flex max-h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-5xl flex-col border border-white/20 bg-[#102622] shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/15 p-4 sm:px-6"><h2 id="feedback-dialog-title" className="text-lg font-bold">Feedback details</h2><button ref={closeRef} type="button" aria-label="Close feedback details" className="grid size-11 shrink-0 place-items-center border border-white/20 hover:bg-white/10" onClick={closeFeedback}><X size={20}/></button></div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <p className="break-all text-xs text-white/50">Feedback ID: {selected.id}</p><p className="mt-3 text-sm">{selected.user?.name || 'Deleted user'} · {selected.rating}/5 · {FEEDBACK_CATEGORY_LABELS[selected.category]} · <span className="capitalize">{selected.sentiment === 'not_analyzed' ? 'Not analyzed' : selected.sentiment}</span></p>
          {selected.user && <p className="mt-2 text-xs text-white/55">{selected.user.email}</p>}
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]">{selected.comment}</p>
          <h3 className="mt-6 border-t border-white/15 pt-5 text-lg font-bold">Related itinerary</h3>
          <p className="mt-2 text-xs text-white/50">This view shows the current saved itinerary, which may have changed since this feedback was submitted.</p>
          {tripLoading && <p role="status" className="mt-4 text-sm">Loading itinerary…</p>}
          {tripError && <div role="alert" className="mt-4 text-sm text-red-300"><p>{tripError}</p><button className={`${button} mt-3`} onClick={() => { setTripError(''); setTripLoading(true); setTripRevision(value => value + 1); }}>Retry itinerary</button></div>}
          {!selected.itinerary && <p className="mt-4 text-sm text-white/55">The related itinerary is no longer available.</p>}
          {trip && <><p className="mt-4 break-all text-xs text-white/55">Itinerary ID: {trip.id}</p><p className="mt-2 text-sm">{trip.destination} · {trip.startDate} – {trip.endDate} · {trip.travelers} traveler{trip.travelers === 1 ? '' : 's'} · {formatMoney(trip.budget, trip.currency)}</p>{trip.itinerary ? <ItineraryWorkspace readOnly itinerary={trip.itinerary} weather={null} manualDirty={false} editingTripId={trip.id} busy={false} travelers={trip.travelers} referenceCurrency={trip.currency} exchangeQuotes={{}} onSave={noAction} onReorderActivity={noAction} onEditActivity={noAction} onRemoveActivity={noAction} onOpenDay={noAction}/> : <p className="mt-4 text-sm text-amber-200">This saved itinerary uses an unsupported or invalid format. Its metadata is shown above.</p>}</>}
        </div>
      </div>
    </div>, document.body)}
  </div>;
}
