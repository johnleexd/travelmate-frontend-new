'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import type { VisitedPlace, VisitedPlacesResponse } from '@/lib/contracts';
import { handleResponse } from '@/services/api.service';
import { placeMapUrl } from '@/lib/place-map';
import { RecordVisitDialog } from './PlaceActions';

export function VisitedPlaces({ onOpenTrip }: { onOpenTrip: (id: string) => void }) {
  const [result, setResult] = useState<VisitedPlacesResponse | null>(null), [query, setQuery] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
  const [add, setAdd] = useState(false), [confirm, setConfirm] = useState<string | null>(null), [removing, setRemoving] = useState<string | null>(null);
  const paging = useRef(false), controller = useRef<AbortController | null>(null), version = useRef(0);
  useEffect(() => {
    const abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    const requestVersion = ++version.current;
    const timer = setTimeout(() => {
      setBusy(true); setError(''); setResult(null); paging.current = false;
      void fetch(`/api/platform/visited-places?q=${encodeURIComponent(query)}`, { signal: abort.signal }).then(handleResponse<VisitedPlacesResponse>).then(data => {
        if (requestVersion === version.current) setResult(data);
      }).catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Visited places could not load.'); }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    }, query ? 300 : 0);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query, refresh]);
  async function more() {
    if (paging.current || !result?.page.nextCursor) return;
    paging.current = true; const currentVersion = version.current; setBusy(true); setError('');
    try {
      const page = await handleResponse<VisitedPlacesResponse>(await fetch(`/api/platform/visited-places?q=${encodeURIComponent(query)}&cursor=${encodeURIComponent(result.page.nextCursor)}`, { signal: controller.current?.signal }));
      if (currentVersion === version.current) setResult(previous => previous ? { ...page, visits: [...previous.visits, ...page.visits.filter(row => !previous.visits.some(item => item.id === row.id))] } : page);
    } catch (cause) { if (currentVersion === version.current && !controller.current?.signal.aborted) setError(cause instanceof Error ? cause.message : 'More visits could not load.'); }
    finally { if (currentVersion === version.current) { paging.current = false; setBusy(false); } }
  }
  async function remove(row: VisitedPlace) {
    if (paging.current) return; paging.current = true; setRemoving(row.id); setError('');
    try {
      await handleResponse(await fetch('/api/platform', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove-visit', id: row.id }) }));
      setMessage('Visit removed. Your saved trip is unchanged.'); setConfirm(null); setRefresh(v => v + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Visit could not be removed.'); }
    finally { paging.current = false; setRemoving(null); }
  }
  return <section className="min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Your visited places</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/55">A personal record of places you have visited. Saved plans and completed trips stay separate.</p></div><button onClick={() => setAdd(true)} className="inline-flex min-h-11 items-center gap-2 bg-amber-300 px-4 text-sm font-bold text-[#14231f]"><Plus size={16}/>Record a visit</button></div>
    <label className="mt-5 block max-w-md text-xs text-white/65">Search place or destination<input value={query} maxLength={100} onChange={event => setQuery(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-white/20 bg-[#071813] px-3 text-sm text-white"/></label>
    {message && <p role="status" className="mt-4 text-sm text-emerald-300">{message}</p>}
    {error && <div role="alert" className="mt-4 text-sm text-red-300">{error}<button onClick={() => setRefresh(v => v + 1)} className="ml-3 min-h-10 underline">Retry</button></div>}
    {busy && !result && <div role="status" className="mt-6 grid animate-pulse gap-4 sm:grid-cols-2"><span className="h-40 rounded-lg bg-white/5"/><span className="h-40 rounded-lg bg-white/5"/><span className="sr-only">Loading visited places...</span></div>}
    {result && <><p className="mt-5 text-xs text-white/45">{result.page.total} {result.page.total === 1 ? 'visit' : 'visits'}{query ? ' matching your search' : ' recorded'}</p>{!result.visits.length ? <div className="mt-4 rounded-lg border border-dashed border-white/20 p-8 text-sm text-white/55">{query ? 'No visits match this search.' : 'No visits yet. Use Mark as visited on a saved itinerary, or record a past visit here.'}</div> : <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{result.visits.map(row => <article key={row.id} className="min-w-0 rounded-xl border border-white/15 bg-[#112a23] p-4"><p className="text-xs font-bold text-amber-300">Visited {row.visitDate}</p><h3 className="mt-2 font-bold [overflow-wrap:anywhere]">{row.name}</h3><p className="mt-1 text-sm text-white/55">{row.destination}</p><p className="mt-2 text-[10px] text-white/40">{row.placeKey.startsWith('wikidata:') ? 'Place identity from Wikidata · visit recorded by you' : 'Place and visit recorded by you'}</p><div className="mt-4 flex flex-wrap gap-2"><a href={placeMapUrl(row)} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${row.name} on Google Maps (opens a new tab)`} className="inline-flex min-h-10 items-center gap-2 border border-white/20 px-3 text-xs text-cyan-200"><MapPin size={14}/>Visit · map</a>{row.tripId && <button onClick={() => onOpenTrip(row.tripId!)} className="min-h-10 border border-white/20 px-3 text-xs">Open trip</button>}<button disabled={!!removing} onClick={() => setConfirm(row.id)} aria-label={`Remove visit to ${row.name}`} className="min-h-10 px-3 text-red-300"><Trash2 size={16}/></button></div>{confirm === row.id && <div className="mt-3 border-t border-white/10 pt-3 text-xs"><p>Remove this visit from your history?</p><div className="mt-2 flex gap-3"><button disabled={!!removing} onClick={() => void remove(row)} className="min-h-10 text-red-300">{removing === row.id ? 'Removing...' : 'Remove visit'}</button><button disabled={!!removing} onClick={() => setConfirm(null)} className="min-h-10">Cancel</button></div></div>}</article>)}</div>}{result.page.hasMore && <button disabled={busy} onClick={() => void more()} className="mt-5 min-h-11 rounded border border-white/20 px-5 text-sm">{busy ? 'Loading...' : 'Load more visits'}</button>}</>}
    {add && <RecordVisitDialog onClose={() => setAdd(false)} onRecorded={record => { setMessage(record.alreadyRecorded ? 'This place and date are already recorded.' : 'Visit saved.'); setRefresh(v => v + 1); }}/>}</section>;
}
